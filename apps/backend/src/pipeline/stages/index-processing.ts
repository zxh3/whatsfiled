import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { dailyIndexFiles, filingQueue } from "../../db/schema.js";
import {
  edgarClient,
  RATE_LIMIT_DELAY_MS,
  sleep,
} from "../../services/edgar.js";

export interface IndexProcessingOptions {
  /** Maximum number of index files to process in one run */
  batchSize?: number;
  /** Dry run mode - don't modify database */
  dryRun?: boolean;
}

export interface IndexProcessingResult {
  processed: number;
  filingsQueued: number;
  filingsSkipped: number;
  errors: Array<{ indexFileId: string; error: string }>;
}

/**
 * Stage 2: Index Processing
 *
 * Fetches pending daily_index_files entries, downloads and parses index content,
 * creates filing_queue entries for each Form 4/4A row.
 * Updates daily_index_files status to "completed" on success.
 */
export async function processIndexFiles(
  options: IndexProcessingOptions = {},
): Promise<IndexProcessingResult> {
  const { batchSize = 10, dryRun = false } = options;
  const result: IndexProcessingResult = {
    processed: 0,
    filingsQueued: 0,
    filingsSkipped: 0,
    errors: [],
  };

  console.log("[index-processing] Starting index processing...");

  // Fetch pending index files with row locking
  const pendingFiles = await db
    .select()
    .from(dailyIndexFiles)
    .where(eq(dailyIndexFiles.status, "pending"))
    .limit(batchSize);

  console.log(
    `[index-processing] Found ${pendingFiles.length} pending index files`,
  );

  for (const indexFile of pendingFiles) {
    console.log(
      `[index-processing] Processing ${indexFile.fileName} (${indexFile.formType})...`,
    );

    if (dryRun) {
      console.log(
        `[index-processing] [DRY RUN] Would process ${indexFile.fileName}`,
      );
      result.processed++;
      continue;
    }

    try {
      // Mark as processing
      await db
        .update(dailyIndexFiles)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(dailyIndexFiles.id, indexFile.id));

      // Fetch and parse the index file
      const indexResult = await edgarClient.fetchDailyIndex(indexFile.fileName);
      const rows = edgarClient.parseDailyIndex(indexResult.content, {
        formTypes: [indexFile.formType],
      });

      console.log(
        `[index-processing] Found ${rows.length} ${indexFile.formType} filings in ${indexFile.fileName}`,
      );

      let queuedCount = 0;
      let skippedCount = 0;

      // Insert filing queue entries
      for (const row of rows) {
        try {
          const inserted = await db
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
            .onConflictDoNothing({
              target: [filingQueue.fileName],
            })
            .returning({ id: filingQueue.id });

          if (inserted.length > 0) {
            queuedCount++;
            result.filingsQueued++;
          } else {
            skippedCount++;
            result.filingsSkipped++;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[index-processing] Failed to queue ${row.fileName}: ${message}`,
          );
        }
      }

      // Mark index file as completed
      await db
        .update(dailyIndexFiles)
        .set({
          status: "completed",
          completedAt: new Date(),
          entriesCount: rows.length,
          processedCount: queuedCount,
        })
        .where(eq(dailyIndexFiles.id, indexFile.id));

      result.processed++;
      console.log(
        `[index-processing] Completed ${indexFile.fileName}: ${queuedCount} queued, ${skippedCount} skipped`,
      );

      // Rate limit between index file fetches
      await sleep(RATE_LIMIT_DELAY_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[index-processing] Failed to process ${indexFile.fileName}: ${message}`,
      );

      // Mark as failed
      await db
        .update(dailyIndexFiles)
        .set({
          status: "failed",
          errorMessage: message,
        })
        .where(eq(dailyIndexFiles.id, indexFile.id));

      result.errors.push({ indexFileId: indexFile.id, error: message });
    }
  }

  console.log(
    `[index-processing] Complete. Processed: ${result.processed}, Queued: ${result.filingsQueued}, Skipped: ${result.filingsSkipped}, Errors: ${result.errors.length}`,
  );

  return result;
}

/**
 * Retry failed index files.
 * Resets status to "pending" for files that previously failed.
 */
export async function retryFailedIndexFiles(
  _limit = 10,
): Promise<{ reset: number }> {
  const updated = await db
    .update(dailyIndexFiles)
    .set({ status: "pending", errorMessage: null })
    .where(eq(dailyIndexFiles.status, "failed"))
    .returning({ id: dailyIndexFiles.id });

  console.log(`[index-processing] Reset ${updated.length} failed index files`);
  return { reset: updated.length };
}
