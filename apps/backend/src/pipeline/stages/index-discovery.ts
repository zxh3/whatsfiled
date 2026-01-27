import { db } from "../../db/index.js";
import { dailyIndexFiles } from "../../db/schema.js";
import { edgarClient } from "../../services/edgar.js";

export interface IndexDiscoveryOptions {
  /** Year to discover index files for */
  year: number;
  /** Form types to track (default: ["4", "4/A"]) */
  formTypes?: string[];
  /** Dry run mode - don't insert into database */
  dryRun?: boolean;
}

export interface IndexDiscoveryResult {
  discovered: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Stage 1: Index Discovery
 *
 * Fetches available daily index file names from SEC EDGAR for a given year.
 * Inserts new entries into daily_index_files with status "pending".
 * Idempotent via unique constraint on (index_date, form_type).
 */
export async function discoverDailyIndexFiles(
  options: IndexDiscoveryOptions,
): Promise<IndexDiscoveryResult> {
  const { year, formTypes = ["4", "4/A"], dryRun = false } = options;
  const result: IndexDiscoveryResult = {
    discovered: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  console.log(`[index-discovery] Discovering index files for year ${year}...`);

  try {
    // Fetch all daily index file names for the year
    const fileNames = await edgarClient.getDailyIndexFileNames(year);
    console.log(
      `[index-discovery] Found ${fileNames.length} index files for ${year}`,
    );

    for (const fileName of fileNames) {
      result.discovered++;

      // Parse date from fileName (e.g., "form.20260102.idx" -> "2026-01-02")
      const dateMatch = fileName.match(/form\.(\d{4})(\d{2})(\d{2})\.idx/);
      if (!dateMatch) {
        result.errors.push(`Invalid file name format: ${fileName}`);
        continue;
      }

      const [, yearStr, monthStr, dayStr] = dateMatch;
      const indexDate = `${yearStr}-${monthStr}-${dayStr}`;

      // Insert one entry per form type
      for (const formType of formTypes) {
        if (dryRun) {
          console.log(
            `[index-discovery] [DRY RUN] Would insert: ${fileName} (${formType})`,
          );
          result.inserted++;
          continue;
        }

        try {
          // Upsert with ON CONFLICT DO NOTHING for idempotency
          const inserted = await db
            .insert(dailyIndexFiles)
            .values({
              indexDate,
              formType,
              fileName,
              status: "pending",
            })
            .onConflictDoNothing({
              target: [dailyIndexFiles.indexDate, dailyIndexFiles.formType],
            })
            .returning({ id: dailyIndexFiles.id });

          if (inserted.length > 0) {
            result.inserted++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Failed to insert ${fileName} (${formType}): ${message}`,
          );
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to fetch index file names: ${message}`);
  }

  console.log(
    `[index-discovery] Complete. Discovered: ${result.discovered}, Inserted: ${result.inserted}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
  );

  return result;
}

/**
 * Discover index files for recent days.
 * Useful for daily cron job to catch any missed days.
 */
export async function discoverRecentIndexFiles(
  _daysBack = 7,
): Promise<IndexDiscoveryResult> {
  const now = new Date();
  const year = now.getFullYear();

  // For simplicity, discover the whole current year
  // The unique constraint handles duplicates
  return discoverDailyIndexFiles({ year });
}
