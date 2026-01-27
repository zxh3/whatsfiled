import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { type Database, db } from "../../db/index.js";
import { filingQueue, filings } from "../../db/schema.js";
import {
  edgarClient,
  RATE_LIMIT_DELAY_MS,
  sleep,
} from "../../services/edgar.js";
import { mapForm4ToDb } from "../mappers/form4-to-db.js";

const MAX_RETRIES = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface FilingProcessingOptions {
  /** Maximum number of filings to process in one run */
  batchSize?: number;
  /** Dry run mode - don't modify database */
  dryRun?: boolean;
}

export interface FilingProcessingResult {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ queueId: string; fileName: string; error: string }>;
}

/**
 * Stage 3: Filing Processing
 *
 * Acquires batch of pending filing_queue entries (with distributed locking),
 * fetches and parses each filing with EdgarClient,
 * maps to database tables in a transaction,
 * updates queue status to "completed" or "failed".
 */
export async function processFilings(
  options: FilingProcessingOptions = {},
): Promise<FilingProcessingResult> {
  const { batchSize = 50, dryRun = false } = options;
  const result: FilingProcessingResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log("[filing-processing] Starting filing processing...");

  // Acquire batch with distributed locking
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS);

  // Find and lock pending filings that are:
  // 1. Status is "pending"
  // 2. Not already locked (lockedUntil is null or in the past)
  // 3. Not exceeded retry count
  // Order by priority (higher first) and creation date
  // Use subquery with LIMIT to only lock the batch we'll process
  const nowIso = now.toISOString();
  const queueEntries = await db
    .update(filingQueue)
    .set({ lockedUntil: lockUntil, status: "processing" })
    .where(
      sql`${filingQueue.id} IN (
        SELECT id FROM filing_queue
        WHERE status = 'pending'
        AND (locked_until IS NULL OR locked_until < ${nowIso}::timestamp)
        AND retry_count < ${MAX_RETRIES}
        ORDER BY priority DESC, created_at ASC
        LIMIT ${batchSize}
      )`,
    )
    .returning();

  console.log(
    `[filing-processing] Acquired ${queueEntries.length} filings to process`,
  );

  for (const entry of queueEntries) {
    console.log(
      `[filing-processing] Processing ${entry.fileName} (${entry.formType})...`,
    );

    if (dryRun) {
      console.log(
        `[filing-processing] [DRY RUN] Would process ${entry.fileName}`,
      );
      result.processed++;
      result.completed++;
      continue;
    }

    try {
      // Check if filing already exists (by accession number)
      const accessionNumber = extractAccessionNumber(entry.fileName);
      const existingFiling = await db
        .select({ id: filings.id })
        .from(filings)
        .where(eq(filings.accessionNumber, accessionNumber))
        .limit(1);

      if (existingFiling.length > 0) {
        // Already processed, skip
        await db
          .update(filingQueue)
          .set({
            status: "skipped",
            lockedUntil: null,
            processedAt: new Date(),
          })
          .where(eq(filingQueue.id, entry.id));
        result.skipped++;
        result.processed++;
        console.log(
          `[filing-processing] Skipped ${entry.fileName} (already exists)`,
        );
        continue;
      }

      // Fetch the filing content
      const content = await edgarClient.fetchFiling(entry.fileName);

      // Parse the Form 4
      const doc = edgarClient.parseForm4(content, { fileName: entry.fileName });

      // Prefer SEC acceptance datetime (ET) from submission header, fallback to index date.
      const acceptanceDateTime = parseAcceptanceDateTime(content);
      const filedAt = acceptanceDateTime ?? parseFilingDate(entry.dateFiled);

      // Map to database in a transaction
      await db.transaction(async (tx) => {
        await mapForm4ToDb(tx as unknown as Database, doc, {
          rawContent: content,
          documentUrl: doc.source?.formattedXmlUrl,
          filedAt,
        });
      });

      // Mark as completed
      await db
        .update(filingQueue)
        .set({
          status: "completed",
          lockedUntil: null,
          processedAt: new Date(),
          lastError: null,
          lastErrorAt: null,
        })
        .where(eq(filingQueue.id, entry.id));

      result.completed++;
      result.processed++;
      console.log(`[filing-processing] Completed ${entry.fileName}`);

      // Rate limit between SEC requests
      await sleep(RATE_LIMIT_DELAY_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[filing-processing] Failed to process ${entry.fileName}: ${message}`,
      );

      // Update retry count and error info
      const newRetryCount = entry.retryCount + 1;
      const newStatus = newRetryCount >= MAX_RETRIES ? "failed" : "pending";

      await db
        .update(filingQueue)
        .set({
          status: newStatus,
          retryCount: newRetryCount,
          lastError: message,
          lastErrorAt: new Date(),
          lockedUntil: null,
        })
        .where(eq(filingQueue.id, entry.id));

      if (newStatus === "failed") {
        result.failed++;
      }
      result.processed++;
      result.errors.push({
        queueId: entry.id,
        fileName: entry.fileName,
        error: message,
      });

      // Still rate limit after failures
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  console.log(
    `[filing-processing] Complete. Processed: ${result.processed}, Completed: ${result.completed}, Failed: ${result.failed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
  );

  return result;
}

function extractAccessionNumber(fileName: string): string {
  // e.g., "edgar/data/123/0001234567-24-000001.txt" -> "0001234567-24-000001"
  const match = fileName.match(/(\d{10}-\d{2}-\d{6})/);
  return match ? match[1] : fileName;
}

function parseFilingDate(dateFiled: string): Date {
  // Format: YYYYMMDD -> Date
  // Use noon UTC to avoid timezone boundary issues when displaying dates
  const year = parseInt(dateFiled.substring(0, 4), 10);
  const month = parseInt(dateFiled.substring(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(dateFiled.substring(6, 8), 10);
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function parseAcceptanceDateTime(content: string): Date | null {
  const match = content.match(/ACCEPTANCE-DATETIME[:>]\s*(\d{14})/);
  if (!match) return null;

  const value = match[1];
  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(4, 6), 10);
  const day = Number.parseInt(value.slice(6, 8), 10);
  const hour = Number.parseInt(value.slice(8, 10), 10);
  const minute = Number.parseInt(value.slice(10, 12), 10);
  const second = Number.parseInt(value.slice(12, 14), 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    return null;
  }

  return zonedTimeToUtcDate(
    { year, month, day, hour, minute, second },
    "America/New_York",
  );
}

function zonedTimeToUtcDate(
  time: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
): Date {
  const utcGuess = new Date(
    Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second),
  );
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number.parseInt(values.year, 10),
    Number.parseInt(values.month, 10) - 1,
    Number.parseInt(values.day, 10),
    Number.parseInt(values.hour, 10),
    Number.parseInt(values.minute, 10),
    Number.parseInt(values.second, 10),
  );

  return (asUtc - date.getTime()) / 60_000;
}

/**
 * Retry failed filings by resetting their status to pending.
 * Optionally filter by specific filing IDs.
 */
export async function retryFailedFilings(
  filingIds?: string[],
): Promise<{ reset: number }> {
  let query = db
    .update(filingQueue)
    .set({
      status: "pending",
      retryCount: 0,
      lastError: null,
      lastErrorAt: null,
      lockedUntil: null,
    })
    .where(eq(filingQueue.status, "failed"));

  if (filingIds && filingIds.length > 0) {
    query = db
      .update(filingQueue)
      .set({
        status: "pending",
        retryCount: 0,
        lastError: null,
        lastErrorAt: null,
        lockedUntil: null,
      })
      .where(
        and(
          eq(filingQueue.status, "failed"),
          sql`${filingQueue.id} = ANY(${filingIds})`,
        ),
      );
  }

  const updated = await query.returning({ id: filingQueue.id });
  console.log(`[filing-processing] Reset ${updated.length} failed filings`);
  return { reset: updated.length };
}

/**
 * Get statistics about the filing queue.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}> {
  const stats = await db
    .select({
      status: filingQueue.status,
      count: sql<number>`count(*)::int`,
    })
    .from(filingQueue)
    .groupBy(filingQueue.status);

  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };

  for (const row of stats) {
    result[row.status as keyof typeof result] = row.count;
    result.total += row.count;
  }

  return result;
}

/**
 * Clean up stale locks (processing entries that have timed out).
 * Returns entries to pending status for retry.
 */
export async function cleanupStaleLocks(): Promise<{ cleaned: number }> {
  const now = new Date();

  const updated = await db
    .update(filingQueue)
    .set({
      status: "pending",
      lockedUntil: null,
    })
    .where(
      and(
        eq(filingQueue.status, "processing"),
        lt(filingQueue.lockedUntil, now),
      ),
    )
    .returning({ id: filingQueue.id });

  if (updated.length > 0) {
    console.log(`[filing-processing] Cleaned up ${updated.length} stale locks`);
  }

  return { cleaned: updated.length };
}
