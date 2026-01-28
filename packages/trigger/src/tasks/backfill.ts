import { logger, task } from "@trigger.dev/sdk/v3";
import { discoverIndexFilesTask } from "./discovery.js";

export interface BackfillPayload {
  /** Year to backfill (defaults to current year) */
  year?: number;
  /** Form types to process (defaults to ["4", "4/A"]) */
  formTypes?: string[];
  /** Limit number of index files to process (for testing) */
  limitIndexFiles?: number;
  /** Limit number of filings to process per index file (for testing) */
  limitFilingsPerIndex?: number;
}

export interface BackfillResult {
  /** Year that was backfilled */
  year: number;
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
 * This task can be manually triggered to backfill filings for a specific year.
 * It discovers all index files for the year and triggers processing for each.
 *
 * @example
 * ```typescript
 * // Backfill all Form 4 filings for 2025
 * await backfillTask.trigger({
 *   year: 2025,
 *   formTypes: ["4", "4/A"],
 * });
 * ```
 */
export const backfillTask = task({
  id: "backfill",
  // Backfill can take a long time, allow up to 10 minutes
  run: async (payload: BackfillPayload): Promise<BackfillResult> => {
    const year = payload.year ?? new Date().getFullYear();
    const formTypes = payload.formTypes ?? ["4", "4/A"];

    const limitIndexFiles = payload.limitIndexFiles;
    const limitFilingsPerIndex = payload.limitFilingsPerIndex;

    logger.info("Starting backfill", {
      year,
      formTypes,
      limitIndexFiles,
      limitFilingsPerIndex,
    });

    // Trigger discovery which will cascade to index and filing processing
    const result = await discoverIndexFilesTask.triggerAndWait({
      year,
      formTypes,
      limitIndexFiles,
      limitFilingsPerIndex,
    });

    if (!result.ok) {
      throw new Error(`Discovery failed: ${result.error}`);
    }

    logger.info("Backfill discovery completed", {
      year,
      discovered: result.output.discovered,
      inserted: result.output.inserted,
      triggered: result.output.triggered,
    });

    return {
      year,
      formTypes,
      discovered: result.output.discovered,
      inserted: result.output.inserted,
      triggered: result.output.triggered,
    };
  },
});
