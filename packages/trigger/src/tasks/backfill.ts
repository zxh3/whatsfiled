import { logger, task } from "@trigger.dev/sdk/v3";
import { discoverIndexFilesTask } from "./discovery.js";

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
  /** Number of processing tasks triggered */
  triggered: number;
}

/**
 * Backfill task for processing historical SEC filings.
 *
 * This task can be manually triggered to backfill filings for a specific date range.
 * It discovers all index files for the range and triggers processing for each.
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

    // Trigger discovery which will cascade to index and filing processing
    const result = await discoverIndexFilesTask.triggerAndWait({
      startDate,
      endDate,
      formTypes,
      limitIndexFiles,
      limitFilingsPerIndex,
    });

    if (!result.ok) {
      throw new Error(`Discovery failed: ${result.error}`);
    }

    logger.info("Backfill discovery completed", {
      startDate,
      endDate,
      discovered: result.output.discovered,
      inserted: result.output.inserted,
      triggered: result.output.triggered,
    });

    return {
      startDate,
      endDate,
      formTypes,
      discovered: result.output.discovered,
      inserted: result.output.inserted,
      triggered: result.output.triggered,
    };
  },
});
