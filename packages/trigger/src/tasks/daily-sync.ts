import { logger, schedules } from "@trigger.dev/sdk/v3";
import { processDayTask } from "./process-day.js";

/**
 * Daily sync scheduled task.
 *
 * Runs every day at 8 AM UTC (3 AM EST / 4 AM EDT) to discover and process
 * new SEC EDGAR filings from the previous day's index files.
 *
 * SEC publishes daily index files after market close (~5-6 PM ET),
 * so running at 1 AM ET gives plenty of buffer time.
 *
 * Processing is sequential by date:
 * 1. Process each date one at a time
 * 2. For each date: discover index → queue filings → process ALL filings
 * 3. Only move to next date after all filings complete
 */
export const dailySyncSchedule = schedules.task({
  id: "daily-sync",
  // Run at 8 AM UTC daily
  cron: "0 8 * * *",
  run: async () => {
    // Add buffer: start 3 days ago, end today
    // This catches any missed filings from weekends/holidays and late postings
    const today = new Date();

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 3);

    const endDate = new Date(today);

    logger.info("Starting daily sync", {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });

    const formTypes = ["4", "4/A"];
    const results: Array<{
      date: string;
      processed: number;
      skipped: number;
      failed: number;
    }> = [];

    // Process each date sequentially
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];

      logger.info("Processing date", { date: dateStr });

      // Process this day and WAIT for completion before moving to next
      const result = await processDayTask.triggerAndWait({
        date: dateStr,
        formTypes,
      });

      if (result.ok) {
        results.push({
          date: dateStr,
          processed: result.output.filingsProcessed,
          skipped: result.output.filingsSkipped,
          failed: result.output.filingsFailed,
        });

        logger.info("Date completed", {
          date: dateStr,
          processed: result.output.filingsProcessed,
          skipped: result.output.filingsSkipped,
          failed: result.output.filingsFailed,
        });
      } else {
        logger.error("Date processing failed", {
          date: dateStr,
          error: result.error,
        });
        results.push({
          date: dateStr,
          processed: 0,
          skipped: 0,
          failed: -1, // Indicates task-level failure
        });
      }

      current.setDate(current.getDate() + 1);
    }

    // Summarize results
    const totals = results.reduce(
      (acc, r) => ({
        processed: acc.processed + r.processed,
        skipped: acc.skipped + r.skipped,
        failed: acc.failed + (r.failed > 0 ? r.failed : 0),
        daysWithFailures: acc.daysWithFailures + (r.failed !== 0 ? 1 : 0),
      }),
      { processed: 0, skipped: 0, failed: 0, daysWithFailures: 0 },
    );

    logger.info("Daily sync completed", {
      daysProcessed: results.length,
      ...totals,
    });

    return {
      success: totals.daysWithFailures === 0,
      daysProcessed: results.length,
      ...totals,
      results,
    };
  },
});
