import { logger, task } from "@trigger.dev/sdk/v3";
import { dailyIndexFiles, getDb } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { processIndexFileTask } from "./index-processing.js";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

export interface DiscoverIndexFilesPayload {
  /** Year to discover index files for */
  year: number;
  /** Form types to filter for (e.g., ["4", "4/A"]) */
  formTypes: string[];
  /** Limit number of index files to process (for testing) */
  limitIndexFiles?: number;
  /** Limit number of filings to process per index file (for testing) */
  limitFilingsPerIndex?: number;
}

export interface DiscoverIndexFilesResult {
  /** Number of index files discovered */
  discovered: number;
  /** Number of new index files inserted */
  inserted: number;
  /** Number of processing tasks triggered */
  triggered: number;
}

/**
 * Discover daily index files for a given year.
 *
 * This task:
 * 1. Fetches the list of daily index file names from SEC EDGAR
 * 2. Inserts new index file records into the database
 * 3. Triggers processIndexFileTask for each new pending index file
 */
export const discoverIndexFilesTask = task({
  id: "discover-index-files",
  run: async (
    payload: DiscoverIndexFilesPayload,
  ): Promise<DiscoverIndexFilesResult> => {
    const { year, formTypes, limitIndexFiles, limitFilingsPerIndex } = payload;
    const db = getDb();
    const edgarClient = new EdgarClient({ userAgent: SEC_USER_AGENT });

    logger.info("Discovering index files", { year, formTypes });

    // Get list of daily index file names for the year
    const fileNames = await edgarClient.getDailyIndexFileNames(year);
    logger.info(`Found ${fileNames.length} index files for ${year}`);

    let inserted = 0;
    const insertedIds: string[] = [];

    // Insert new index file records
    for (const fileName of fileNames) {
      // Parse date from filename (e.g., "form.20260127.idx" -> "2026-01-27")
      const dateMatch = fileName.match(/form\.(\d{4})(\d{2})(\d{2})\.idx/);
      if (!dateMatch) {
        logger.warn(`Could not parse date from filename: ${fileName}`);
        continue;
      }

      const indexDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

      // For each form type, create an index file entry
      for (const formType of formTypes) {
        try {
          const [result] = await db
            .insert(dailyIndexFiles)
            .values({
              indexDate,
              formType,
              fileName,
              status: "pending",
            })
            .onConflictDoNothing()
            .returning({ id: dailyIndexFiles.id });

          if (result) {
            inserted++;
            insertedIds.push(result.id);
          }
        } catch {
          // Ignore duplicate key errors
          logger.debug(`Index file already exists: ${fileName} (${formType})`);
        }
      }
    }

    logger.info(`Inserted ${inserted} new index file records`);

    // Trigger processing for new index files (respecting limit)
    const idsToTrigger = limitIndexFiles
      ? insertedIds.slice(0, limitIndexFiles)
      : insertedIds;

    let triggered = 0;
    for (const indexFileId of idsToTrigger) {
      await processIndexFileTask.trigger({
        indexFileId,
        limitFilings: limitFilingsPerIndex,
      });
      triggered++;
    }

    logger.info(`Triggered ${triggered} index file processing tasks`);

    return {
      discovered: fileNames.length,
      inserted,
      triggered,
    };
  },
});
