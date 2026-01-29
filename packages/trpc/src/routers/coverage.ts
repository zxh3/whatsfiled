import { dailyIndexFiles, filingQueue, filings } from "@whatsfiled/db/schema";
import { count, max, min, sql } from "drizzle-orm";
import { publicProcedure, router } from "../init.js";

export const coverageRouter = router({
  /**
   * Get coverage statistics for the data coverage page.
   */
  getStats: publicProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    // Get total filings count and date range
    const [filingStats] = await db
      .select({
        totalFilings: count(),
        earliestDate: min(filings.filedAt),
        latestDate: max(filings.filedAt),
      })
      .from(filings);

    const totalFilings = filingStats?.totalFilings ?? 0;
    const earliestDate = filingStats?.earliestDate
      ? filingStats.earliestDate.toISOString().split("T")[0]
      : null;
    const latestDate = filingStats?.latestDate
      ? filingStats.latestDate.toISOString().split("T")[0]
      : null;

    // Get coverage stats per year from dailyIndexFiles
    // - totalDays: all distinct dates we know about (any status)
    // - completedDays: distinct dates with status='completed'
    const coverageByYear = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${dailyIndexFiles.indexDate})::int`,
        totalDays: sql<number>`COUNT(DISTINCT ${dailyIndexFiles.indexDate})::int`,
        completedDays: sql<number>`COUNT(DISTINCT CASE WHEN ${dailyIndexFiles.status} = 'completed' THEN ${dailyIndexFiles.indexDate} END)::int`,
      })
      .from(dailyIndexFiles)
      .groupBy(sql`EXTRACT(YEAR FROM ${dailyIndexFiles.indexDate})`);

    const coverageByYearMap = new Map(
      coverageByYear.map((r) => [
        r.year,
        { total: r.totalDays, completed: r.completedDays },
      ]),
    );

    // Check which years have pending backfill work
    const backfillByYear = await db
      .select({
        year: sql<number>`SUBSTRING(${filingQueue.dateFiled}, 1, 4)::int`,
        pendingCount: count(),
      })
      .from(filingQueue)
      .where(sql`${filingQueue.status} IN ('pending', 'processing')`)
      .groupBy(sql`SUBSTRING(${filingQueue.dateFiled}, 1, 4)`);

    const backfillByYearMap = new Map(
      backfillByYear.map((r) => [r.year, r.pendingCount > 0]),
    );

    // Build years array from all years we have data for
    const allYears = [...coverageByYearMap.keys()].sort((a, b) => b - a);

    const years = allYears.map((year) => {
      const coverage = coverageByYearMap.get(year) ?? {
        total: 0,
        completed: 0,
      };
      const isBackfilling = backfillByYearMap.get(year) ?? false;

      const percentComplete =
        coverage.total > 0
          ? Math.round((coverage.completed / coverage.total) * 100)
          : 0;

      return {
        year,
        completedDays: coverage.completed,
        totalBusinessDays: coverage.total,
        percentComplete,
        isBackfilling,
      };
    });

    return {
      totalFilings,
      earliestDate,
      latestDate,
      years,
    };
  }),
});
