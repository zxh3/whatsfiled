/**
 * LESSON 5: Scheduled Tasks (Cron)
 *
 * Tasks can run on a schedule using cron expressions.
 * Perfect for periodic jobs like daily reports, cleanup, syncs, etc.
 */

import { schedules } from "@trigger.dev/sdk/v3";

// schedules.task combines schedule definition with task logic
// It runs automatically on the cron schedule
export const dailyReportSchedule = schedules.task({
  id: "daily-report",
  // Cron expression: minute hour day-of-month month day-of-week
  cron: "0 9 * * *", // 9:00 AM UTC every day

  run: async () => {
    const now = new Date();

    console.log("Generating daily report...");
    console.log(`Report date: ${now.toISOString()}`);

    // Your report logic here
    const report = {
      date: now.toISOString().split("T")[0],
      summary: "All systems operational",
      metrics: {
        tasksRun: Math.floor(Math.random() * 1000),
        errorsCount: Math.floor(Math.random() * 10),
      },
    };

    console.log("Report generated:", report);

    return report;
  },
});

// Common cron expressions:
//
// "0 * * * *"     - Every hour
// "0 0 * * *"     - Every day at midnight
// "0 9 * * 1-5"   - 9 AM on weekdays only
// "0 0 1 * *"     - First day of each month
// "0/15 * * * *"  - Every 15 minutes
//
// Tip: Use https://crontab.guru to build and test cron expressions
//
// Notes:
// - Schedules only run in production (deployed) or dev mode with --env-file
// - You can also create schedules dynamically via the API
