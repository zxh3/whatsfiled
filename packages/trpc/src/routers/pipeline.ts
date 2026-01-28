import { configure, runs, tasks } from "@trigger.dev/sdk/v3";
import {
  dailyIndexFiles,
  filingQueue,
  pipelineWorkers,
} from "@whatsfiled/db/schema";
import { and, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../init.js";

// Configure Trigger.dev SDK (only if secret key is available)
if (process.env.TRIGGER_SECRET_KEY) {
  configure({
    secretKey: process.env.TRIGGER_SECRET_KEY,
  });
}

export const pipelineRouter = router({
  /**
   * Get overall pipeline statistics.
   */
  getStats: adminProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const workerActiveThreshold = new Date(now.getTime() - 2 * 60 * 1000);

    // Queue stats
    const queueStats = await db
      .select({
        status: filingQueue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(filingQueue)
      .groupBy(filingQueue.status);

    const queueStatsByStatus = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const row of queueStats) {
      queueStatsByStatus[row.status as keyof typeof queueStatsByStatus] =
        row.count;
    }

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
      queue: queueStatsByStatus,
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
  getIndexCoverage: adminProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
        formType: z.string().default("4"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
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
        {
          pending: number;
          processing: number;
          completed: number;
          failed: number;
          skipped: number;
        }
      > = {};

      for (const row of filingProgress) {
        // Convert YYYYMMDD to YYYY-MM-DD
        const dateKey = `${row.dateFiled.substring(0, 4)}-${row.dateFiled.substring(4, 6)}-${row.dateFiled.substring(6, 8)}`;
        if (!progressByDate[dateKey]) {
          progressByDate[dateKey] = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
          };
        }
        progressByDate[dateKey][
          row.status as keyof (typeof progressByDate)[string]
        ] = row.count;
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
          progress.pending +
          progress.processing +
          progress.completed +
          progress.failed +
          progress.skipped;
        const done = progress.completed + progress.skipped;

        return {
          date: f.indexDate,
          indexStatus: f.status,
          entriesCount: f.entriesCount,
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
        (c) =>
          c.filingProgress.total > 0 &&
          c.filingProgress.done === c.filingProgress.total,
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
  getQueueByDate: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{8}$/), // YYYYMMDD format
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
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
  getFailedFilings: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
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
   * Get gap detection - find missing dates in daily index coverage.
   */
  getGaps: adminProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        formType: z.string().default("4"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
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

  /**
   * Get recent Trigger.dev runs grouped by task for admin visibility.
   */
  getTriggerRunsByTask: adminProcedure
    .input(
      z
        .object({
          runsPerTask: z.number().min(1).max(20).default(10),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      if (!process.env.TRIGGER_SECRET_KEY) {
        return { tasks: [], error: "Trigger.dev not configured" };
      }

      try {
        // Fetch more runs to ensure we have enough per task
        const result = await runs.list({
          limit: 100,
        });

        // Group runs by task identifier
        const runsByTask: Record<
          string,
          {
            id: string;
            status: string;
            createdAt: Date;
            startedAt: Date | null;
            finishedAt: Date | null;
          }[]
        > = {};

        for (const run of result.data) {
          if (!runsByTask[run.taskIdentifier]) {
            runsByTask[run.taskIdentifier] = [];
          }
          if (
            runsByTask[run.taskIdentifier].length < (input?.runsPerTask ?? 10)
          ) {
            runsByTask[run.taskIdentifier].push({
              id: run.id,
              status: run.status,
              createdAt: run.createdAt,
              startedAt: run.startedAt ?? null,
              finishedAt: run.finishedAt ?? null,
            });
          }
        }

        // Convert to array sorted by most recent activity
        const tasks = Object.entries(runsByTask)
          .map(([taskId, taskRuns]) => ({
            taskId,
            runs: taskRuns,
            lastRunAt: taskRuns[0]?.createdAt ?? null,
            stats: {
              completed: taskRuns.filter((r) => r.status === "COMPLETED")
                .length,
              failed: taskRuns.filter(
                (r) =>
                  r.status === "FAILED" ||
                  r.status === "CRASHED" ||
                  r.status === "SYSTEM_FAILURE",
              ).length,
              running: taskRuns.filter(
                (r) => r.status === "EXECUTING" || r.status === "REATTEMPTING",
              ).length,
              queued: taskRuns.filter(
                (r) => r.status === "QUEUED" || r.status === "PENDING",
              ).length,
            },
          }))
          .sort((a, b) => {
            if (!a.lastRunAt) return 1;
            if (!b.lastRunAt) return -1;
            return (
              new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime()
            );
          });

        return {
          tasks,
          error: null,
        };
      } catch (error) {
        console.error("Failed to fetch Trigger.dev runs:", error);
        return {
          tasks: [],
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Trigger a backfill task for a specific date range.
   */
  triggerBackfill: adminProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        formTypes: z.array(z.string()).default(["4", "4/A"]),
        limitIndexFiles: z.number().min(1).max(500).optional(),
        limitFilingsPerIndex: z.number().min(1).max(10000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!process.env.TRIGGER_SECRET_KEY) {
        return { success: false, error: "Trigger.dev not configured" };
      }

      try {
        const handle = await tasks.trigger("backfill", {
          startDate: input.startDate,
          endDate: input.endDate,
          formTypes: input.formTypes,
          limitIndexFiles: input.limitIndexFiles,
          limitFilingsPerIndex: input.limitFilingsPerIndex,
        });

        return {
          success: true,
          runId: handle.id,
          error: null,
        };
      } catch (error) {
        console.error("Failed to trigger backfill:", error);
        return {
          success: false,
          runId: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Trigger processing of pending index files.
   */
  triggerProcessIndexes: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        triggerFilingProcessing: z.boolean().default(true),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!process.env.TRIGGER_SECRET_KEY) {
        return { success: false, error: "Trigger.dev not configured" };
      }

      try {
        const handle = await tasks.trigger("process-pending-indexes", {
          limit: input.limit,
          triggerFilingProcessing: input.triggerFilingProcessing,
          startDate: input.startDate,
          endDate: input.endDate,
        });

        return {
          success: true,
          runId: handle.id,
          error: null,
        };
      } catch (error) {
        console.error("Failed to trigger index processing:", error);
        return {
          success: false,
          runId: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Trigger processing of pending filings.
   */
  triggerProcessFilings: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional(),
        formType: z.string().optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!process.env.TRIGGER_SECRET_KEY) {
        return { success: false, error: "Trigger.dev not configured" };
      }

      try {
        const handle = await tasks.trigger("process-pending-filings", {
          limit: input.limit,
          formType: input.formType,
          startDate: input.startDate,
          endDate: input.endDate,
        });

        return {
          success: true,
          runId: handle.id,
          error: null,
        };
      } catch (error) {
        console.error("Failed to trigger filing processing:", error);
        return {
          success: false,
          runId: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
