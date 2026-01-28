import { logger, task } from "@trigger.dev/sdk/v3";
import { filingQueue, getDb } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { eq } from "drizzle-orm";
import { getProcessor, hasProcessor } from "../processors/index.js";
import { secRateLimitedQueue } from "../queues/sec-rate-limited.js";

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
 * 1. Fetches the filing content from SEC EDGAR
 * 2. Dispatches to the appropriate processor based on form type
 * 3. Updates the queue entry status
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

    // Get the queue entry
    const [queueEntry] = await db
      .select()
      .from(filingQueue)
      .where(eq(filingQueue.id, queueId))
      .limit(1);

    if (!queueEntry) {
      throw new Error(`Queue entry not found: ${queueId}`);
    }

    // Skip if already processed
    if (queueEntry.status === "completed" || queueEntry.status === "skipped") {
      logger.info("Filing already processed, skipping", {
        queueId,
        status: queueEntry.status,
      });
      return { success: true, skipped: true };
    }

    logger.info("Processing filing", {
      queueId,
      fileName: queueEntry.fileName,
      formType: queueEntry.formType,
    });

    // Check if we have a processor for this form type
    if (!hasProcessor(queueEntry.formType)) {
      const error = `No processor registered for form type: ${queueEntry.formType}`;
      logger.error(error);
      await db
        .update(filingQueue)
        .set({
          status: "failed",
          lastError: error,
          lastErrorAt: new Date(),
        })
        .where(eq(filingQueue.id, queueId));
      return { success: false, error };
    }

    // Mark as processing
    await db
      .update(filingQueue)
      .set({ status: "processing" })
      .where(eq(filingQueue.id, queueId));

    try {
      // Fetch the filing content
      const content = await edgarClient.fetchFiling(queueEntry.fileName);

      // Get the processor and process the filing
      const processor = getProcessor(queueEntry.formType);
      if (!processor) {
        throw new Error(
          `Processor disappeared for form type: ${queueEntry.formType}`,
        );
      }

      const result = await processor.process(
        {
          content,
          fileName: queueEntry.fileName,
          indexMetadata: {
            companyName: queueEntry.companyName,
            cik: queueEntry.cik,
            dateFiled: queueEntry.dateFiled,
            formType: queueEntry.formType,
          },
        },
        db,
      );

      if (result.success) {
        // Mark as completed or skipped
        const status = result.skipped ? "skipped" : "completed";
        await db
          .update(filingQueue)
          .set({
            status,
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
        // Processor returned failure
        await db
          .update(filingQueue)
          .set({
            status: "pending", // Will be retried by Trigger.dev
            retryCount: queueEntry.retryCount + 1,
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

      // Update queue entry with error (let Trigger.dev handle retry)
      await db
        .update(filingQueue)
        .set({
          status: "pending",
          retryCount: queueEntry.retryCount + 1,
          lastError: message,
          lastErrorAt: new Date(),
        })
        .where(eq(filingQueue.id, queueId));

      throw error;
    }
  },
});
