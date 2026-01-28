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
    const now = new Date();
    const year = now.getFullYear();

    logger.info("Starting daily sync", { year });

    // Trigger discovery for Form 4 and Form 4/A filings
    const result = await discoverIndexFilesTask.triggerAndWait({
      year,
      formTypes: ["4", "4/A"],
    });

    logger.info("Daily sync completed", {
      year,
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
