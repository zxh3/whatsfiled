import { logger, task } from "@trigger.dev/sdk/v3";
import { dailyIndexFiles, filingQueue, getDb } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { processFilingTask } from "./filing-processing.js";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

export interface ProcessDayPayload {
  /** Date to process (YYYY-MM-DD format) */
  date: string;
  /** Form types to process (defaults to ["4", "4/A"]) */
  formTypes?: string[];
}

export interface ProcessDayResult {
  /** Date that was processed */
  date: string;
  /** Whether this date had an index file (weekends/holidays don't) */
  hasIndexFile: boolean;
  /** Number of index files discovered for this date */
  indexFilesDiscovered: number;
  /** Number of new index files inserted */
  indexFilesInserted: number;
  /** Number of filings found in indexes */
  filingsFound: number;
  /** Number of new filings queued */
  filingsQueued: number;
  /** Number of filings successfully processed */
  filingsProcessed: number;
  /** Number of filings skipped (already existed) */
  filingsSkipped: number;
  /** Number of filings that failed */
  filingsFailed: number;
}

/**
 * Process a single day completely.
 *
 * This task processes one date end-to-end:
 * 1. Discovers and inserts index files for the date
 * 2. Processes each index file to queue filings
 * 3. Waits for ALL filings to complete before returning
 *
 * This ensures predictable, sequential processing - one day at a time.
 */
export const processDayTask = task({
  id: "process-day",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: ProcessDayPayload): Promise<ProcessDayResult> => {
    const { date } = payload;
    const formTypes = payload.formTypes ?? ["4", "4/A"];
    const db = getDb();
    const edgarClient = new EdgarClient({ userAgent: SEC_USER_AGENT });

    logger.info("Processing day", { date, formTypes });

    const result: ProcessDayResult = {
      date,
      hasIndexFile: false,
      indexFilesDiscovered: 0,
      indexFilesInserted: 0,
      filingsFound: 0,
      filingsQueued: 0,
      filingsProcessed: 0,
      filingsSkipped: 0,
      filingsFailed: 0,
    };

    // Step 1: Discover index file for this date
    const year = parseInt(date.substring(0, 4), 10);
    const fileNames = await edgarClient.getDailyIndexFileNames(year);

    // Find the index file for this date
    const dateCompact = date.replace(/-/g, "");
    const fileName = fileNames.find((f) =>
      f.includes(`form.${dateCompact}.idx`),
    );

    if (!fileName) {
      logger.info("No index file for date (holiday?)", { date });
      return result;
    }

    result.hasIndexFile = true;
    result.indexFilesDiscovered = formTypes.length;

    // Step 2: Insert index file records for each form type
    const insertedIndexIds: string[] = [];

    for (const formType of formTypes) {
      try {
        const [inserted] = await db
          .insert(dailyIndexFiles)
          .values({
            indexDate: date,
            formType,
            fileName,
            status: "pending",
          })
          .onConflictDoNothing()
          .returning({ id: dailyIndexFiles.id });

        if (inserted) {
          result.indexFilesInserted++;
          insertedIndexIds.push(inserted.id);
        }
      } catch {
        // Ignore duplicate errors
      }
    }

    // Step 3: Get all pending index files for this date (including previously inserted ones)
    const pendingIndexFiles = await db
      .select()
      .from(dailyIndexFiles)
      .where(
        and(
          eq(dailyIndexFiles.indexDate, date),
          eq(dailyIndexFiles.status, "pending"),
        ),
      );

    if (pendingIndexFiles.length === 0) {
      logger.info("No pending index files for date", { date });
      // Check if there are pending filings from previous runs
      const pendingFilings = await getPendingFilingsForDate(db, date);
      if (pendingFilings.length > 0) {
        logger.info("Found pending filings from previous run", {
          count: pendingFilings.length,
        });
        const filingResults = await processFilingsAndWait(pendingFilings);
        result.filingsProcessed = filingResults.processed;
        result.filingsSkipped = filingResults.skipped;
        result.filingsFailed = filingResults.failed;
      }
      return result;
    }

    // Step 4: Process each index file to queue filings
    for (const indexFile of pendingIndexFiles) {
      logger.info("Processing index file", {
        fileName: indexFile.fileName,
        formType: indexFile.formType,
      });

      // Mark as processing
      await db
        .update(dailyIndexFiles)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(dailyIndexFiles.id, indexFile.id));

      try {
        // Fetch and parse the daily index
        const { content } = await edgarClient.fetchDailyIndex(
          indexFile.fileName,
        );
        const rows = edgarClient.parseDailyIndex(content, {
          formTypes: [indexFile.formType],
        });

        result.filingsFound += rows.length;

        // Insert filing queue entries
        for (const row of rows) {
          try {
            const [inserted] = await db
              .insert(filingQueue)
              .values({
                dailyIndexFileId: indexFile.id,
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

            if (inserted) {
              result.filingsQueued++;
            }
          } catch {
            // Ignore duplicate errors
          }
        }

        // Mark index file as completed
        await db
          .update(dailyIndexFiles)
          .set({
            status: "completed",
            entriesCount: rows.length,
            processedCount: rows.length,
            completedAt: new Date(),
          })
          .where(eq(dailyIndexFiles.id, indexFile.id));

        logger.info("Index file processed", {
          fileName: indexFile.fileName,
          found: rows.length,
          queued: result.filingsQueued,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(dailyIndexFiles)
          .set({ status: "failed", errorMessage: message })
          .where(eq(dailyIndexFiles.id, indexFile.id));
        logger.error("Index file processing failed", {
          fileName: indexFile.fileName,
          error: message,
        });
        throw error;
      }
    }

    // Step 5: Process all pending filings for this date and WAIT for completion
    const pendingFilings = await getPendingFilingsForDate(db, date);

    if (pendingFilings.length === 0) {
      logger.info("No pending filings for date", { date });
      return result;
    }

    logger.info("Processing filings", { count: pendingFilings.length });

    const filingResults = await processFilingsAndWait(pendingFilings);
    result.filingsProcessed = filingResults.processed;
    result.filingsSkipped = filingResults.skipped;
    result.filingsFailed = filingResults.failed;

    logger.info("Day processing completed", {
      filingsProcessed: result.filingsProcessed,
      filingsSkipped: result.filingsSkipped,
      filingsFailed: result.filingsFailed,
    });

    return result;
  },
});

/**
 * Get pending filings for a specific date.
 */
async function getPendingFilingsForDate(
  db: ReturnType<typeof getDb>,
  date: string,
) {
  const dateFiled = date.replace(/-/g, "");
  const now = new Date();

  return db
    .select({ id: filingQueue.id })
    .from(filingQueue)
    .where(
      and(
        eq(filingQueue.status, "pending"),
        eq(filingQueue.dateFiled, dateFiled),
        or(isNull(filingQueue.lockedUntil), lt(filingQueue.lockedUntil, now)),
      ),
    );
}

/**
 * Process filings using batchTriggerAndWait for reliable completion tracking.
 */
async function processFilingsAndWait(
  pendingFilings: { id: string }[],
): Promise<{ processed: number; skipped: number; failed: number }> {
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches of 100 (Trigger.dev limit for batchTriggerAndWait)
  const BATCH_SIZE = 100;

  for (let i = 0; i < pendingFilings.length; i += BATCH_SIZE) {
    const batch = pendingFilings.slice(i, i + BATCH_SIZE);

    logger.info("Processing filing batch", {
      batchNumber: Math.floor(i / BATCH_SIZE) + 1,
      batchSize: batch.length,
      totalFilings: pendingFilings.length,
    });

    // Use batchTriggerAndWait to process batch and wait for all to complete
    const batchResult = await processFilingTask.batchTriggerAndWait(
      batch.map((filing) => ({ payload: { queueId: filing.id } })),
    );

    // Count results - batchTriggerAndWait returns { id, runs: TaskRunResult[] }
    for (const run of batchResult.runs) {
      if (run.ok) {
        if (run.output.skipped) {
          skipped++;
        } else if (run.output.success) {
          processed++;
        } else {
          failed++;
        }
      } else {
        failed++;
        logger.error("Filing processing failed", { error: run.error });
      }
    }

    logger.info("Batch completed", {
      batchNumber: Math.floor(i / BATCH_SIZE) + 1,
      processed,
      skipped,
      failed,
    });
  }

  return { processed, skipped, failed };
}
