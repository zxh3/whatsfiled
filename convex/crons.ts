import { cronJobs } from "convex/server";

// import { internal } from "./_generated/api";

const crons = cronJobs();

// crons.cron(
//   "Fetch Raw Edgar Daily Index Forms",
//   "0 0 * * *", // Every day at 12:00 AM UTC
//   internal.secFilings.fetchRawEdgarDailyIndexFormsByYear,
//   {},
// );

// crons.cron(
//   "Parse Edgar Daily Index Form Rows",
//   "0 1 * * *", // Every day at 01:00 AM UTC
//   internal.secFilings.parseEdgarDailyIndexFormRows,
//   {},
// );

export default crons;
