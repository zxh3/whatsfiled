import { logger, task } from "@trigger.dev/sdk/v3";
import { dailyIndexFiles, filingQueue, getDb } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { eq } from "drizzle-orm";
import { secRateLimitedQueue } from "../queues/sec-rate-limited.js";
import { processFilingTask } from "./filing-processing.js";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

export interface ProcessIndexFilePayload {
  /** Database ID of the daily index file to process */
  indexFileId: string;
  /** Limit number of filings to process (for testing) */
  limitFilings?: number;
  /** Whether to trigger filing processing (default: true) */
  triggerProcessing?: boolean;
}

export interface ProcessIndexFileResult {
  /** Number of filings found in the index */
  found: number;
  /** Number of new filings queued */
  queued: number;
  /** Number of filings already in queue (skipped) */
  skipped: number;
  /** Number of processing tasks triggered */
  triggered: number;
}

/**
 * Process a daily index file.
 *
 * This task:
 * 1. Fetches and parses the daily index file from SEC EDGAR
 * 2. Filters for the specified form types
 * 3. Inserts new filing queue entries
 * 4. Batch triggers processFilingTask for new filings
 */
export const processIndexFileTask = task({
  id: "process-index-file",
  queue: secRateLimitedQueue,
  run: async (
    payload: ProcessIndexFilePayload,
  ): Promise<ProcessIndexFileResult> => {
    const { indexFileId, limitFilings, triggerProcessing = true } = payload;
    const db = getDb();
    const edgarClient = new EdgarClient({ userAgent: SEC_USER_AGENT });

    // Get the index file record
    const [indexFile] = await db
      .select()
      .from(dailyIndexFiles)
      .where(eq(dailyIndexFiles.id, indexFileId))
      .limit(1);

    if (!indexFile) {
      throw new Error(`Index file not found: ${indexFileId}`);
    }

    logger.info("Processing index file", {
      fileName: indexFile.fileName,
      formType: indexFile.formType,
    });

    // Mark as processing
    await db
      .update(dailyIndexFiles)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(dailyIndexFiles.id, indexFileId));

    try {
      // Fetch and parse the daily index
      const { content } = await edgarClient.fetchDailyIndex(indexFile.fileName);
      const rows = edgarClient.parseDailyIndex(content, {
        formTypes: [indexFile.formType],
      });

      logger.info(`Found ${rows.length} filings in index`);

      let queued = 0;
      let skipped = 0;
      const queuedIds: string[] = [];

      // Insert filing queue entries
      for (const row of rows) {
        try {
          const [result] = await db
            .insert(filingQueue)
            .values({
              dailyIndexFileId: indexFileId,
              fileName: row.fileName,
              formType: row.formType,
              companyName: row.companyName,
              cik: row.cik,
              dateFiled: row.dateFiled,
              source: "daily_index",
              status: "pending",
              priority: 0,
            })
            .onConflictDoNothing()
            .returning({ id: filingQueue.id });

          if (result) {
            queued++;
            queuedIds.push(result.id);
          } else {
            skipped++;
          }
        } catch {
          // Ignore duplicate key errors
          skipped++;
        }
      }

      logger.info(`Queued ${queued} filings, skipped ${skipped} duplicates`);

      // Batch trigger filing processing tasks (if enabled)
      let triggered = 0;
      if (triggerProcessing) {
        const idsToTrigger = limitFilings
          ? queuedIds.slice(0, limitFilings)
          : queuedIds;

        const triggers = idsToTrigger.map((queueId) =>
          processFilingTask.trigger({ queueId }),
        );
        await Promise.all(triggers);
        triggered = idsToTrigger.length;
      }

      // Mark index file as completed
      await db
        .update(dailyIndexFiles)
        .set({
          status: "completed",
          entriesCount: rows.length,
          processedCount: queued + skipped,
          completedAt: new Date(),
        })
        .where(eq(dailyIndexFiles.id, indexFileId));

      return {
        found: rows.length,
        queued,
        skipped,
        triggered,
      };
    } catch (error) {
      // Mark as failed
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(dailyIndexFiles)
        .set({
          status: "failed",
          errorMessage: message,
        })
        .where(eq(dailyIndexFiles.id, indexFileId));

      throw error;
    }
  },
});
