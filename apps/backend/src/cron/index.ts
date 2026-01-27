import cron from "node-cron";
import {
  cleanupStaleLocks,
  discoverRecentIndexFiles,
  processFilings,
  processIndexFiles,
} from "../pipeline/index.js";

/**
 * Initialize all cron jobs for SEC data fetching.
 *
 * Jobs (all times UTC):
 * - 00:00: Index Discovery - Find new daily index files
 * - 00:30: Index Processing - Parse index, create queue entries
 * - 01:00-05:00: Filing Processing - Process queued filings (hourly)
 */
export function initCronJobs() {
  // Stage 1: Index Discovery - runs at midnight UTC
  // SEC typically updates their index around 10 PM ET (02:00-03:00 UTC)
  // Running at midnight UTC gives buffer time for files to be available
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[cron] Starting index discovery...");
      try {
        const result = await discoverRecentIndexFiles();
        console.log(
          `[cron] Index discovery completed: ${result.inserted} new, ${result.skipped} skipped`,
        );
      } catch (error) {
        console.error("[cron] Index discovery failed:", error);
      }
    },
    {
      timezone: "UTC",
    },
  );

  // Stage 2: Index Processing - runs at 00:30 UTC
  cron.schedule(
    "30 0 * * *",
    async () => {
      console.log("[cron] Starting index processing...");
      try {
        const result = await processIndexFiles({ batchSize: 20 });
        console.log(
          `[cron] Index processing completed: ${result.processed} processed, ${result.filingsQueued} queued`,
        );
      } catch (error) {
        console.error("[cron] Index processing failed:", error);
      }
    },
    {
      timezone: "UTC",
    },
  );

  // Stage 3: Filing Processing - runs hourly from 01:00 to 05:00 UTC
  // This gives a 5-hour window to process filings with rate limiting
  cron.schedule(
    "0 1-5 * * *",
    async () => {
      console.log("[cron] Starting filing processing...");
      try {
        // Clean up any stale locks first
        await cleanupStaleLocks();

        // Process filings in batches
        const result = await processFilings({ batchSize: 100 });
        console.log(
          `[cron] Filing processing completed: ${result.completed} completed, ${result.failed} failed`,
        );
      } catch (error) {
        console.error("[cron] Filing processing failed:", error);
      }
    },
    {
      timezone: "UTC",
    },
  );

  // Cleanup stale locks - runs every 30 minutes
  cron.schedule(
    "*/30 * * * *",
    async () => {
      try {
        const result = await cleanupStaleLocks();
        if (result.cleaned > 0) {
          console.log(`[cron] Cleaned up ${result.cleaned} stale locks`);
        }
      } catch (error) {
        console.error("[cron] Stale lock cleanup failed:", error);
      }
    },
    {
      timezone: "UTC",
    },
  );

  console.log("[cron] Cron jobs initialized");
}
