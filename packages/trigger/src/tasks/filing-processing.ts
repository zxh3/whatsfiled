import { logger, task } from "@trigger.dev/sdk/v3";
import { filingQueue, getDb } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getProcessor, hasProcessor } from "../processors/index.js";
import { secRateLimitedQueue } from "../queues/sec-rate-limited.js";

// Lock duration in milliseconds (5 minutes should be plenty for processing)
const LOCK_DURATION_MS = 5 * 60 * 1000;

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

export interface ProcessFilingPayload {
  /** Database ID of the filing queue entry to process */
  queueId: string;
}

export interface ProcessFilingResult {
  /** Whether processing succeeded */
  success: boolean;
  /** The database ID of the created filing (if successful) */
  filingId?: string;
  /** Whether this filing was skipped (already exists) */
  skipped?: boolean;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Process a single filing from the queue.
 *
 * This task:
 * 1. Acquires a distributed lock on the queue entry (prevents concurrent processing)
 * 2. Fetches the filing content from SEC EDGAR
 * 3. Dispatches to the appropriate processor based on form type
 * 4. Updates the queue entry status and releases the lock
 */
export const processFilingTask = task({
  id: "process-filing",
  queue: secRateLimitedQueue,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: ProcessFilingPayload): Promise<ProcessFilingResult> => {
    const { queueId } = payload;
    const db = getDb();
    const edgarClient = new EdgarClient({ userAgent: SEC_USER_AGENT });
    const now = new Date();
    const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS);

    // Atomically try to acquire lock and mark as processing
    // Only succeeds if: pending status AND (no lock OR lock expired)
    const [lockedEntry] = await db
      .update(filingQueue)
      .set({
        status: "processing",
        lockedUntil: lockUntil,
      })
      .where(
        and(
          eq(filingQueue.id, queueId),
          eq(filingQueue.status, "pending"),
          or(isNull(filingQueue.lockedUntil), lt(filingQueue.lockedUntil, now)),
        ),
      )
      .returning();

    // If we couldn't acquire the lock, check why
    if (!lockedEntry) {
      const [queueEntry] = await db
        .select()
        .from(filingQueue)
        .where(eq(filingQueue.id, queueId))
        .limit(1);

      if (!queueEntry) {
        throw new Error(`Queue entry not found: ${queueId}`);
      }

      // Already processed - success
      if (
        queueEntry.status === "completed" ||
        queueEntry.status === "skipped"
      ) {
        logger.info("Filing already processed, skipping", {
          queueId,
          status: queueEntry.status,
        });
        return { success: true, skipped: true };
      }

      // Being processed by another worker (lock not expired)
      if (
        queueEntry.status === "processing" &&
        queueEntry.lockedUntil &&
        queueEntry.lockedUntil > now
      ) {
        logger.info("Filing is locked by another worker, skipping", {
          queueId,
          lockedUntil: queueEntry.lockedUntil,
        });
        return { success: true, skipped: true };
      }

      // Failed status - don't retry here
      if (queueEntry.status === "failed") {
        logger.info("Filing is in failed status, skipping", { queueId });
        return { success: true, skipped: true };
      }

      // Unexpected state - throw to trigger retry
      throw new Error(
        `Could not acquire lock for queue entry: ${queueId} (status: ${queueEntry.status})`,
      );
    }

    logger.info("Processing filing", {
      queueId,
      fileName: lockedEntry.fileName,
      formType: lockedEntry.formType,
    });

    // Check if we have a processor for this form type
    if (!hasProcessor(lockedEntry.formType)) {
      const error = `No processor registered for form type: ${lockedEntry.formType}`;
      logger.error(error);
      await db
        .update(filingQueue)
        .set({
          status: "failed",
          lockedUntil: null,
          lastError: error,
          lastErrorAt: new Date(),
        })
        .where(eq(filingQueue.id, queueId));
      return { success: false, error };
    }

    try {
      // Fetch the filing content
      const content = await edgarClient.fetchFiling(lockedEntry.fileName);

      // Get the processor and process the filing
      const processor = getProcessor(lockedEntry.formType);
      if (!processor) {
        throw new Error(
          `Processor disappeared for form type: ${lockedEntry.formType}`,
        );
      }

      const result = await processor.process(
        {
          content,
          fileName: lockedEntry.fileName,
          indexMetadata: {
            companyName: lockedEntry.companyName,
            cik: lockedEntry.cik,
            dateFiled: lockedEntry.dateFiled,
            formType: lockedEntry.formType,
          },
        },
        db,
      );

      if (result.success) {
        // Mark as completed or skipped, release lock
        const status = result.skipped ? "skipped" : "completed";
        await db
          .update(filingQueue)
          .set({
            status,
            lockedUntil: null,
            processedAt: new Date(),
            lastError: null,
            lastErrorAt: null,
          })
          .where(eq(filingQueue.id, queueId));

        logger.info("Filing processed successfully", {
          queueId,
          filingId: result.filingId,
          skipped: result.skipped,
        });

        return {
          success: true,
          filingId: result.filingId,
          skipped: result.skipped,
        };
      } else {
        // Processor returned failure - release lock, set to pending for retry
        await db
          .update(filingQueue)
          .set({
            status: "pending",
            lockedUntil: null,
            retryCount: lockedEntry.retryCount + 1,
            lastError: result.error,
            lastErrorAt: new Date(),
          })
          .where(eq(filingQueue.id, queueId));

        throw new Error(result.error ?? "Unknown processor error");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Filing processing failed", {
        queueId,
        error: message,
      });

      // Release lock and set to pending for retry
      await db
        .update(filingQueue)
        .set({
          status: "pending",
          lockedUntil: null,
          retryCount: lockedEntry.retryCount + 1,
          lastError: message,
          lastErrorAt: new Date(),
        })
        .where(eq(filingQueue.id, queueId));

      throw error;
    }
  },
});
