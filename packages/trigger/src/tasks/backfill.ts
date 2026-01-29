import { logger, task } from "@trigger.dev/sdk/v3";
import { processDayTask } from "./process-day.js";

export interface BackfillPayload {
  /** Start date for backfill (YYYY-MM-DD format) */
  startDate: string;
  /** End date for backfill (YYYY-MM-DD format) */
  endDate: string;
  /** Form types to process (defaults to ["4", "4/A"]) */
  formTypes?: string[];
}

export interface BackfillResult {
  /** Start date that was backfilled */
  startDate: string;
  /** End date that was backfilled */
  endDate: string;
  /** Form types that were processed */
  formTypes: string[];
  /** Number of days processed */
  daysProcessed: number;
  /** Total filings processed successfully */
  totalProcessed: number;
  /** Total filings skipped (already existed) */
  totalSkipped: number;
  /** Total filings that failed */
  totalFailed: number;
  /** Per-day results */
  dayResults: Array<{
    date: string;
    processed: number;
    skipped: number;
    failed: number;
  }>;
}

/**
 * Backfill task for processing historical SEC filings.
 *
 * Processes dates sequentially, one day at a time:
 * 1. For each date in range:
 *    - Discover and insert index file
 *    - Process index to queue filings
 *    - Process ALL filings and wait for completion
 * 2. Move to next date only after previous date fully completes
 *
 * This ensures predictable, ordered processing that matches
 * the local backfill script behavior.
 *
 * @example
 * ```typescript
 * // Backfill all Form 4 filings for a week
 * await backfillTask.trigger({
 *   startDate: "2025-01-20",
 *   endDate: "2025-01-24",
 *   formTypes: ["4", "4/A"],
 * });
 * ```
 */
export const backfillTask = task({
  id: "backfill",
  retry: {
    maxAttempts: 1, // Don't retry the whole backfill, individual days have their own retries
  },
  run: async (payload: BackfillPayload): Promise<BackfillResult> => {
    const { startDate, endDate } = payload;
    const formTypes = payload.formTypes ?? ["4", "4/A"];

    logger.info("Starting backfill", {
      startDate,
      endDate,
      formTypes,
    });

    const dayResults: BackfillResult["dayResults"] = [];

    // Process each date sequentially
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];

      logger.info("Processing date", {
        date: dateStr,
        progress: `${dayResults.length + 1}/${Math.ceil((end.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1}`,
      });

      // Process this day and WAIT for completion before moving to next
      const result = await processDayTask.triggerAndWait({
        date: dateStr,
        formTypes,
      });

      if (result.ok) {
        dayResults.push({
          date: dateStr,
          processed: result.output.filingsProcessed,
          skipped: result.output.filingsSkipped,
          failed: result.output.filingsFailed,
        });

        logger.info("Date completed", {
          date: dateStr,
          hasIndexFile: result.output.hasIndexFile,
          filingsFound: result.output.filingsFound,
          processed: result.output.filingsProcessed,
          skipped: result.output.filingsSkipped,
          failed: result.output.filingsFailed,
        });
      } else {
        logger.error("Date processing failed", {
          date: dateStr,
          error: result.error,
        });
        dayResults.push({
          date: dateStr,
          processed: 0,
          skipped: 0,
          failed: -1, // Indicates task-level failure
        });
      }

      current.setDate(current.getDate() + 1);
    }

    // Summarize results
    const totals = dayResults.reduce(
      (acc, r) => ({
        processed: acc.processed + r.processed,
        skipped: acc.skipped + r.skipped,
        failed: acc.failed + (r.failed > 0 ? r.failed : 0),
      }),
      { processed: 0, skipped: 0, failed: 0 },
    );

    logger.info("Backfill completed", {
      startDate,
      endDate,
      daysProcessed: dayResults.length,
      ...totals,
    });

    return {
      startDate,
      endDate,
      formTypes,
      daysProcessed: dayResults.length,
      totalProcessed: totals.processed,
      totalSkipped: totals.skipped,
      totalFailed: totals.failed,
      dayResults,
    };
  },
});
