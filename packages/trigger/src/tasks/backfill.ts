import { logger, task } from "@trigger.dev/sdk/v3";
import { discoverIndexFilesTask } from "./discovery.js";
import {
  processPendingFilingsTask,
  processPendingIndexesTask,
} from "./process-pending.js";

export interface BackfillPayload {
  /** Start date for backfill (YYYY-MM-DD format) */
  startDate: string;
  /** End date for backfill (YYYY-MM-DD format) */
  endDate: string;
  /** Form types to process (defaults to ["4", "4/A"]) */
  formTypes?: string[];
  /** Limit number of index files to process (for testing) */
  limitIndexFiles?: number;
  /** Limit number of filings to process per index file (for testing) */
  limitFilingsPerIndex?: number;
}

export interface BackfillResult {
  /** Start date that was backfilled */
  startDate: string;
  /** End date that was backfilled */
  endDate: string;
  /** Form types that were processed */
  formTypes: string[];
  /** Number of index files discovered */
  discovered: number;
  /** Number of new index files inserted */
  inserted: number;
  /** Number of new index processing tasks triggered from discovery */
  triggeredFromDiscovery: number;
  /** Number of pending index files found and triggered */
  pendingIndexesTriggered: number;
  /** Number of pending filings found and triggered */
  pendingFilingsTriggered: number;
}

/**
 * Backfill task for processing historical SEC filings.
 *
 * This task ensures complete coverage for a date range by:
 * 1. Discovering and inserting new index files from SEC EDGAR
 * 2. Processing any pending index files (new or previously ingested)
 * 3. Processing any pending filings (new or previously queued)
 *
 * This is a comprehensive "catch-all" operation that guarantees all data
 * for the date range is fully processed, regardless of prior state.
 *
 * @example
 * ```typescript
 * // Backfill all Form 4 filings for December 2025
 * await backfillTask.trigger({
 *   startDate: "2025-12-01",
 *   endDate: "2025-12-31",
 *   formTypes: ["4", "4/A"],
 * });
 * ```
 */
export const backfillTask = task({
  id: "backfill",
  // Backfill can take a long time, allow up to 10 minutes
  run: async (payload: BackfillPayload): Promise<BackfillResult> => {
    const { startDate, endDate } = payload;
    const formTypes = payload.formTypes ?? ["4", "4/A"];

    const limitIndexFiles = payload.limitIndexFiles;
    const limitFilingsPerIndex = payload.limitFilingsPerIndex;

    logger.info("Starting backfill", {
      startDate,
      endDate,
      formTypes,
      limitIndexFiles,
      limitFilingsPerIndex,
    });

    // Step 1: Discover new index files (triggers processing for newly inserted ones)
    // Note: triggerProcessing=false because we'll handle all pending indexes in step 2
    const discoveryResult = await discoverIndexFilesTask.triggerAndWait({
      startDate,
      endDate,
      formTypes,
      limitIndexFiles,
      limitFilingsPerIndex,
      triggerProcessing: false, // We'll process all pending indexes in the next step
    });

    if (!discoveryResult.ok) {
      throw new Error(`Discovery failed: ${discoveryResult.error}`);
    }

    logger.info("Discovery completed", {
      discovered: discoveryResult.output.discovered,
      inserted: discoveryResult.output.inserted,
    });

    // Step 2: Process ALL pending index files in the date range
    // This includes both newly discovered and previously ingested ones
    // triggerFilingProcessing=true so index processing cascades to filing processing
    const pendingIndexesResult = await processPendingIndexesTask.triggerAndWait(
      {
        startDate,
        endDate,
        limit: limitIndexFiles,
        triggerFilingProcessing: true, // Let index processing cascade to filing processing
      },
    );

    if (!pendingIndexesResult.ok) {
      throw new Error(
        `Processing pending indexes failed: ${pendingIndexesResult.error}`,
      );
    }

    logger.info("Pending indexes processed", {
      found: pendingIndexesResult.output.found,
      triggered: pendingIndexesResult.output.triggered,
    });

    // Step 3: Process any remaining pending filings in the date range
    // This catches filings that were pending before the backfill started
    // (filings discovered in step 2 are handled by the index processing cascade)
    const pendingFilingsResult = await processPendingFilingsTask.triggerAndWait(
      {
        startDate,
        endDate,
        limit: limitFilingsPerIndex
          ? limitFilingsPerIndex * (limitIndexFiles ?? 1000)
          : undefined,
      },
    );

    if (!pendingFilingsResult.ok) {
      throw new Error(
        `Processing pending filings failed: ${pendingFilingsResult.error}`,
      );
    }

    logger.info("Pending filings processed", {
      found: pendingFilingsResult.output.found,
      triggered: pendingFilingsResult.output.triggered,
    });

    logger.info("Backfill completed", {
      startDate,
      endDate,
      discovered: discoveryResult.output.discovered,
      inserted: discoveryResult.output.inserted,
      pendingIndexesTriggered: pendingIndexesResult.output.triggered,
      pendingFilingsTriggered: pendingFilingsResult.output.triggered,
    });

    return {
      startDate,
      endDate,
      formTypes,
      discovered: discoveryResult.output.discovered,
      inserted: discoveryResult.output.inserted,
      triggeredFromDiscovery: 0, // Discovery no longer triggers directly
      pendingIndexesTriggered: pendingIndexesResult.output.triggered,
      pendingFilingsTriggered: pendingFilingsResult.output.triggered,
    };
  },
});
