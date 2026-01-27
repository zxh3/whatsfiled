import { and, desc, eq, gte, lte, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { dailyIndexFiles, filingQueue, pipelineWorkers } from "../../db/schema.js";
import {
  cleanupStaleLocks,
  discoverDailyIndexFiles,
  getQueueStats,
  processFilings,
  processIndexFiles,
  retryFailedFilings,
  retryFailedIndexFiles,
} from "../../pipeline/index.js";
import { publicProcedure, router } from "../init.js";

export const pipelineRouter = router({
  /**
   * Get overall pipeline statistics.
   */
  getStats: publicProcedure.query(async () => {
    const queueStats = await getQueueStats();
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const workerActiveThreshold = new Date(now.getTime() - 2 * 60 * 1000);

    const indexStats = await db
      .select({
        status: dailyIndexFiles.status,
        count: sql<number>`count(*)::int`,
      })
      .from(dailyIndexFiles)
      .groupBy(dailyIndexFiles.status);

    const indexStatsByStatus = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of indexStats) {
      indexStatsByStatus[row.status as keyof typeof indexStatsByStatus] =
        row.count;
    }

    const [staleLocksRow] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(filingQueue)
      .where(
        and(
          eq(filingQueue.status, "processing"),
          lt(filingQueue.lockedUntil, now),
        ),
      );

    const [lastProcessedRow] = await db
      .select({
        lastProcessedAt: sql<Date | null>`max(${filingQueue.processedAt})`,
      })
      .from(filingQueue);

    const [processedRecentRow] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(filingQueue)
      .where(
        and(
          gte(filingQueue.processedAt, fifteenMinutesAgo),
          or(
            eq(filingQueue.status, "completed"),
            eq(filingQueue.status, "skipped"),
          ),
        ),
      );

    const [nextLockExpiryRow] = await db
      .select({
        nextLockExpiryAt: sql<Date | null>`min(${filingQueue.lockedUntil})`,
      })
      .from(filingQueue)
      .where(eq(filingQueue.status, "processing"));

    const workers = await db
      .select({
        workerKey: pipelineWorkers.workerKey,
        workerType: pipelineWorkers.workerType,
        stage: pipelineWorkers.stage,
        host: pipelineWorkers.host,
        pid: pipelineWorkers.pid,
        status: pipelineWorkers.status,
        startedAt: pipelineWorkers.startedAt,
        lastHeartbeatAt: pipelineWorkers.lastHeartbeatAt,
        endedAt: pipelineWorkers.endedAt,
        details: pipelineWorkers.details,
      })
      .from(pipelineWorkers)
      .orderBy(desc(pipelineWorkers.lastHeartbeatAt))
      .limit(6);

    const workersWithStatus = workers.map((worker) => ({
      ...worker,
      isActive:
        worker.status === "running" &&
        worker.lastHeartbeatAt &&
        worker.lastHeartbeatAt > workerActiveThreshold,
    }));

    return {
      queue: queueStats,
      index: indexStatsByStatus,
      queueHealth: {
        processedLast15m: processedRecentRow?.count ?? 0,
        lastProcessedAt: lastProcessedRow?.lastProcessedAt ?? null,
        staleLocks: staleLocksRow?.count ?? 0,
        nextLockExpiryAt: nextLockExpiryRow?.nextLockExpiryAt ?? null,
      },
      workers: workersWithStatus,
    };
  }),

  /**
   * Get daily index coverage for a year.
   * Shows which dates have data and actual filing processing progress.
   */
  getIndexCoverage: publicProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
        formType: z.string().default("4"),
      }),
    )
    .query(async ({ input }) => {
      const { year, formType } = input;
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const dateFiledStart = `${year}0101`;
      const dateFiledEnd = `${year}1231`;

      // Get index file info
      const indexFiles = await db
        .select({
          indexDate: dailyIndexFiles.indexDate,
          status: dailyIndexFiles.status,
          entriesCount: dailyIndexFiles.entriesCount,
          processedCount: dailyIndexFiles.processedCount,
        })
        .from(dailyIndexFiles)
        .where(
          and(
            eq(dailyIndexFiles.formType, formType),
            gte(dailyIndexFiles.indexDate, startDate),
            lte(dailyIndexFiles.indexDate, endDate),
          ),
        )
        .orderBy(dailyIndexFiles.indexDate);

      // Get actual filing progress per date from filing_queue
      const filingProgress = await db
        .select({
          dateFiled: filingQueue.dateFiled,
          status: filingQueue.status,
          count: sql<number>`count(*)::int`,
        })
        .from(filingQueue)
        .where(
          and(
            gte(filingQueue.dateFiled, dateFiledStart),
            lte(filingQueue.dateFiled, dateFiledEnd),
          ),
        )
        .groupBy(filingQueue.dateFiled, filingQueue.status);

      // Build a map of date -> filing stats
      const progressByDate: Record<
        string,
        { pending: number; processing: number; completed: number; failed: number; skipped: number }
      > = {};

      for (const row of filingProgress) {
        // Convert YYYYMMDD to YYYY-MM-DD
        const dateKey = `${row.dateFiled.substring(0, 4)}-${row.dateFiled.substring(4, 6)}-${row.dateFiled.substring(6, 8)}`;
        if (!progressByDate[dateKey]) {
          progressByDate[dateKey] = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
        }
        progressByDate[dateKey][row.status as keyof typeof progressByDate[string]] = row.count;
      }

      // Merge index file info with filing progress
      const coverage = indexFiles.map((f) => {
        const progress = progressByDate[f.indexDate] || {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        };
        const total =
          progress.pending + progress.processing + progress.completed + progress.failed + progress.skipped;
        const done = progress.completed + progress.skipped;

        return {
          date: f.indexDate,
          indexStatus: f.status, // Renamed for clarity
          entriesCount: f.entriesCount,
          // Actual filing progress
          filingProgress: {
            total,
            done,
            pending: progress.pending,
            processing: progress.processing,
            completed: progress.completed,
            failed: progress.failed,
            skipped: progress.skipped,
            percent: total > 0 ? Math.round((done / total) * 100) : 0,
          },
        };
      });

      // Calculate days where all filings are done
      const fullyProcessedDays = coverage.filter(
        (c) => c.filingProgress.total > 0 && c.filingProgress.done === c.filingProgress.total,
      ).length;

      return {
        year,
        formType,
        coverage,
        totalDays: indexFiles.length,
        completedDays: fullyProcessedDays,
      };
    }),

  /**
   * Get filing queue entries for a specific date.
   */
  getQueueByDate: publicProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{8}$/), // YYYYMMDD format
      }),
    )
    .query(async ({ input }) => {
      const { date } = input;

      const entries = await db
        .select({
          status: filingQueue.status,
          count: sql<number>`count(*)::int`,
        })
        .from(filingQueue)
        .where(eq(filingQueue.dateFiled, date))
        .groupBy(filingQueue.status);

      const errors = await db
        .select({
          id: filingQueue.id,
          fileName: filingQueue.fileName,
          lastError: filingQueue.lastError,
          lastErrorAt: filingQueue.lastErrorAt,
          retryCount: filingQueue.retryCount,
        })
        .from(filingQueue)
        .where(
          and(
            eq(filingQueue.dateFiled, date),
            eq(filingQueue.status, "failed"),
          ),
        )
        .limit(20);

      const byStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      };

      let total = 0;
      for (const row of entries) {
        byStatus[row.status as keyof typeof byStatus] = row.count;
        total += row.count;
      }

      return {
        date,
        total,
        ...byStatus,
        errors,
      };
    }),

  /**
   * Get recent failed filings for debugging.
   */
  getFailedFilings: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const { limit } = input;

      const failed = await db
        .select({
          id: filingQueue.id,
          fileName: filingQueue.fileName,
          formType: filingQueue.formType,
          companyName: filingQueue.companyName,
          cik: filingQueue.cik,
          dateFiled: filingQueue.dateFiled,
          lastError: filingQueue.lastError,
          lastErrorAt: filingQueue.lastErrorAt,
          retryCount: filingQueue.retryCount,
        })
        .from(filingQueue)
        .where(eq(filingQueue.status, "failed"))
        .orderBy(sql`${filingQueue.lastErrorAt} DESC NULLS LAST`)
        .limit(limit);

      return failed;
    }),

  /**
   * Retry failed filings by resetting their status.
   */
  retryFailed: publicProcedure
    .input(
      z.object({
        filingIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { filingIds } = input;
      return retryFailedFilings(filingIds);
    }),

  /**
   * Retry failed index files.
   */
  retryFailedIndexFiles: publicProcedure.mutation(async () => {
    return retryFailedIndexFiles();
  }),

  /**
   * Trigger index discovery for a year.
   */
  triggerDiscovery: publicProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
        dryRun: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const { year, dryRun } = input;
      return discoverDailyIndexFiles({ year, dryRun });
    }),

  /**
   * Trigger index processing.
   */
  triggerIndexProcessing: publicProcedure
    .input(
      z.object({
        batchSize: z.number().min(1).max(100).default(10),
        dryRun: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const { batchSize, dryRun } = input;
      return processIndexFiles({ batchSize, dryRun });
    }),

  /**
   * Trigger filing processing.
   */
  triggerFilingProcessing: publicProcedure
    .input(
      z.object({
        batchSize: z.number().min(1).max(200).default(50),
        dryRun: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const { batchSize, dryRun } = input;
      return processFilings({ batchSize, dryRun });
    }),

  /**
   * Clean up stale locks in the filing queue.
   */
  cleanupStaleLocks: publicProcedure.mutation(async () => {
    return cleanupStaleLocks();
  }),

  /**
   * Get gap detection - find missing dates in daily index coverage.
   */
  getGaps: publicProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        formType: z.string().default("4"),
      }),
    )
    .query(async ({ input }) => {
      const { startDate, endDate, formType } = input;

      // Generate all business days in range (exclude weekends)
      // Then find which ones are missing from daily_index_files
      const gaps = await db.execute<{ date: string }>(sql`
        WITH date_range AS (
          SELECT generate_series(
            ${startDate}::date,
            ${endDate}::date,
            '1 day'
          )::date AS date
        ),
        business_days AS (
          SELECT date FROM date_range
          WHERE EXTRACT(DOW FROM date) NOT IN (0, 6)
        )
        SELECT bd.date
        FROM business_days bd
        LEFT JOIN daily_index_files dif
          ON dif.index_date = bd.date
          AND dif.form_type = ${formType}
        WHERE dif.id IS NULL
        ORDER BY bd.date
      `);

      const missingDates = (gaps as unknown as { date: string }[]).map(
        (r) => r.date,
      );

      return {
        startDate,
        endDate,
        formType,
        missingDates,
        totalGaps: missingDates.length,
      };
    }),
});
