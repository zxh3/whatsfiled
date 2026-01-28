import { logger, task } from "@trigger.dev/sdk/v3";
import { dailyIndexFiles, filingQueue, getDb } from "@whatsfiled/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { processFilingTask } from "./filing-processing.js";
import { processIndexFileTask } from "./index-processing.js";

export interface ProcessPendingIndexesPayload {
  /** Maximum number of pending index files to process */
  limit?: number;
  /** Whether to trigger filing processing after index processing (default: true) */
  triggerFilingProcessing?: boolean;
  /** Start date filter (YYYY-MM-DD format, optional) */
  startDate?: string;
  /** End date filter (YYYY-MM-DD format, optional) */
  endDate?: string;
}

export interface ProcessPendingIndexesResult {
  /** Number of pending index files found */
  found: number;
  /** Number of index file processing tasks triggered */
  triggered: number;
}

/**
 * Process pending index files from the database.
 *
 * This task queries for index files with status='pending' and triggers
 * processIndexFileTask for each one.
 */
export const processPendingIndexesTask = task({
  id: "process-pending-indexes",
  run: async (
    payload: ProcessPendingIndexesPayload,
  ): Promise<ProcessPendingIndexesResult> => {
    const {
      limit,
      triggerFilingProcessing = true,
      startDate,
      endDate,
    } = payload;
    const db = getDb();

    logger.info("Finding pending index files", { limit, startDate, endDate });

    // Build where conditions
    const conditions = [eq(dailyIndexFiles.status, "pending")];
    if (startDate) {
      conditions.push(gte(dailyIndexFiles.indexDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(dailyIndexFiles.indexDate, endDate));
    }

    // Query for pending index files
    let query = db
      .select({ id: dailyIndexFiles.id })
      .from(dailyIndexFiles)
      .where(and(...conditions))
      .orderBy(dailyIndexFiles.indexDate);

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const pendingFiles = await query;

    logger.info(`Found ${pendingFiles.length} pending index files`);

    // Trigger processing for each
    for (const file of pendingFiles) {
      await processIndexFileTask.trigger({
        indexFileId: file.id,
        triggerProcessing: triggerFilingProcessing,
      });
    }

    logger.info(`Triggered ${pendingFiles.length} index file processing tasks`);

    return {
      found: pendingFiles.length,
      triggered: pendingFiles.length,
    };
  },
});

export interface ProcessPendingFilingsPayload {
  /** Maximum number of pending filings to process */
  limit?: number;
  /** Filter by form type (optional) */
  formType?: string;
  /** Start date filter (YYYY-MM-DD format, optional) - converted to YYYYMMDD for dateFiled */
  startDate?: string;
  /** End date filter (YYYY-MM-DD format, optional) - converted to YYYYMMDD for dateFiled */
  endDate?: string;
}

export interface ProcessPendingFilingsResult {
  /** Number of pending filings found */
  found: number;
  /** Number of filing processing tasks triggered */
  triggered: number;
}

/**
 * Process pending filings from the database.
 *
 * This task queries for filings with status='pending' and triggers
 * processFilingTask for each one.
 */
export const processPendingFilingsTask = task({
  id: "process-pending-filings",
  run: async (
    payload: ProcessPendingFilingsPayload,
  ): Promise<ProcessPendingFilingsResult> => {
    const { limit, formType, startDate, endDate } = payload;
    const db = getDb();

    logger.info("Finding pending filings", {
      limit,
      formType,
      startDate,
      endDate,
    });

    // Convert YYYY-MM-DD to YYYYMMDD for dateFiled comparison
    const dateFiledStart = startDate?.replace(/-/g, "");
    const dateFiledEnd = endDate?.replace(/-/g, "");

    // Build where clause
    const conditions = [eq(filingQueue.status, "pending")];
    if (formType) {
      conditions.push(eq(filingQueue.formType, formType));
    }
    if (dateFiledStart) {
      conditions.push(gte(filingQueue.dateFiled, dateFiledStart));
    }
    if (dateFiledEnd) {
      conditions.push(lte(filingQueue.dateFiled, dateFiledEnd));
    }

    // Query for pending filings
    let query = db
      .select({ id: filingQueue.id })
      .from(filingQueue)
      .where(and(...conditions))
      .orderBy(sql`${filingQueue.priority} DESC, ${filingQueue.createdAt} ASC`);

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const pendingFilings = await query;

    logger.info(`Found ${pendingFilings.length} pending filings`);

    // Batch trigger processing for each (in chunks to avoid overwhelming)
    const BATCH_SIZE = 100;
    let triggered = 0;

    for (let i = 0; i < pendingFilings.length; i += BATCH_SIZE) {
      const batch = pendingFilings.slice(i, i + BATCH_SIZE);
      const triggers = batch.map((filing) =>
        processFilingTask.trigger({ queueId: filing.id }),
      );
      await Promise.all(triggers);
      triggered += batch.length;
      logger.info(`Triggered batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
        triggered,
        total: pendingFilings.length,
      });
    }

    logger.info(`Triggered ${triggered} filing processing tasks`);

    return {
      found: pendingFilings.length,
      triggered,
    };
  },
});
