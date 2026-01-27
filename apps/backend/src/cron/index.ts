import cron from "node-cron";

/**
 * Initialize all cron jobs for SEC data fetching.
 *
 * Jobs:
 * - Daily index fetch: Runs at 00:00 UTC to download SEC EDGAR daily index
 * - Form parsing: Runs at 01:00 UTC to parse fetched filings
 */
export function initCronJobs() {
  // Daily index fetch - runs at midnight UTC
  // SEC typically updates their index around 10 PM ET (02:00-03:00 UTC)
  // Running at midnight UTC gives buffer time for files to be available
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[cron] Starting daily index fetch...");
      try {
        await fetchDailyIndex();
        console.log("[cron] Daily index fetch completed");
      } catch (error) {
        console.error("[cron] Daily index fetch failed:", error);
      }
    },
    {
      timezone: "UTC",
    },
  );

  // Form parsing - runs at 1 AM UTC
  cron.schedule(
    "0 1 * * *",
    async () => {
      console.log("[cron] Starting form parsing...");
      try {
        await parseQueuedForms();
        console.log("[cron] Form parsing completed");
      } catch (error) {
        console.error("[cron] Form parsing failed:", error);
      }
    },
    {
      timezone: "UTC",
    },
  );

  console.log("[cron] Cron jobs initialized");
}

/**
 * Fetch the daily index from SEC EDGAR.
 * TODO: Implement actual fetching logic using EdgarClient
 */
async function fetchDailyIndex(): Promise<void> {
  // Placeholder - implement with EdgarClient
  console.log("[cron] fetchDailyIndex not yet implemented");
}

/**
 * Parse queued forms from the database.
 * TODO: Implement actual parsing logic
 */
async function parseQueuedForms(): Promise<void> {
  // Placeholder - implement form parsing
  console.log("[cron] parseQueuedForms not yet implemented");
}
