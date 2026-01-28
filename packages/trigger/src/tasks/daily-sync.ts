import { logger, schedules } from "@trigger.dev/sdk/v3";
import { discoverIndexFilesTask } from "./discovery.js";

/**
 * Daily sync scheduled task.
 *
 * Runs every day at 6 AM UTC (1 AM EST / 2 AM EDT) to discover and process
 * new SEC EDGAR filings from the previous day's index files.
 *
 * SEC publishes daily index files after market close (~5-6 PM ET),
 * so running at 1 AM ET gives plenty of buffer time.
 */
export const dailySyncSchedule = schedules.task({
  id: "daily-sync",
  // Run at 6 AM UTC daily
  cron: "0 6 * * *",
  run: async () => {
    // Add buffer: start 3 days ago, end tomorrow
    // This catches any missed filings from weekends/holidays and late postings
    const today = new Date();

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 3);
    const startDateStr = startDate.toISOString().split("T")[0];

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split("T")[0];

    logger.info("Starting daily sync", {
      startDate: startDateStr,
      endDate: endDateStr,
    });

    // Trigger discovery for Form 4 and Form 4/A filings
    const result = await discoverIndexFilesTask.triggerAndWait({
      startDate: startDateStr,
      endDate: endDateStr,
      formTypes: ["4", "4/A"],
    });

    logger.info("Daily sync completed", {
      startDate: startDateStr,
      endDate: endDateStr,
      discovered: result.ok ? result.output.discovered : 0,
      inserted: result.ok ? result.output.inserted : 0,
      triggered: result.ok ? result.output.triggered : 0,
    });

    return {
      success: result.ok,
      result: result.ok ? result.output : null,
    };
  },
});
