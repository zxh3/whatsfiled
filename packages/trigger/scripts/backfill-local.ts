import { parseArgs } from "node:util";
import {
  type Database,
  dailyIndexFiles,
  filingQueue,
  filings,
  getDb,
} from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { and, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { mapForm4ToDb } from "../src/mappers/form4.js";
import {
  parseAcceptanceDateTime,
  parseFilingDate,
} from "../src/utils/index.js";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

// Minimum delay between SEC requests: 300ms = 3.33 req/s max (SEC allows 10)
const MIN_REQUEST_DELAY_MS = 300;

/**
 * Sequential rate limiter for SEC requests.
 * Queues all requests and processes them one at a time with minimum delay.
 * This guarantees we never exceed the rate limit, even with concurrent callers.
 */
class RateLimiter {
  private lastRequestTime = 0;
  private queue: Array<() => void> = [];
  private processing = false;

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const waitTime = MIN_REQUEST_DELAY_MS - timeSinceLastRequest;

      if (waitTime > 0) {
        await new Promise((r) => setTimeout(r, waitTime));
      }

      this.lastRequestTime = Date.now();
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }

    this.processing = false;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Database operation stats collector.
 * Tracks timing for all DB operations and prints summary at end.
 */
class DbStats {
  private stats: Map<string, number[]> = new Map();
  private slowThresholdMs = 500;

  /** Wrap an async DB operation and track its timing */
  async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      const duration = Date.now() - start;
      if (!this.stats.has(operation)) {
        this.stats.set(operation, []);
      }
      this.stats.get(operation)!.push(duration);

      // Log slow queries inline
      if (duration > this.slowThresholdMs) {
        console.log(`\n  [SLOW] ${operation}: ${duration}ms`);
      }
    }
  }

  /** Print summary of all tracked operations */
  print() {
    console.log("\n=== DB Operation Stats ===");
    const entries = Array.from(this.stats.entries()).sort((a, b) => {
      const totalA = a[1].reduce((x, y) => x + y, 0);
      const totalB = b[1].reduce((x, y) => x + y, 0);
      return totalB - totalA; // Sort by total time descending
    });

    for (const [op, times] of entries) {
      const sorted = times.slice().sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const min = sorted[0];
      const max = sorted[count - 1];
      const p50 = sorted[Math.floor(count * 0.5)] ?? min;
      const p95 = sorted[Math.floor(count * 0.95)] ?? max;

      console.log(
        `  ${op}: count=${count} total=${(sum / 1000).toFixed(1)}s avg=${avg.toFixed(0)}ms min=${min}ms max=${max}ms p50=${p50}ms p95=${p95}ms`,
      );
    }
  }
}

// Global DB stats instance
const dbStats = new DbStats();

// Print stats on early exit (Ctrl+C)
function handleExit(signal: string) {
  console.log(`\n\nReceived ${signal}, printing stats before exit...`);
  dbStats.print();
  process.exit(1);
}
process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    start: { type: "string", short: "s" },
    end: { type: "string", short: "e" },
    concurrency: { type: "string", short: "c", default: "3" },
    "form-types": { type: "string", short: "f", default: "4,4/A" },
    "dry-run": { type: "boolean", default: false },
    "skip-discovery": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

function printHelp() {
  console.log(`
Local Backfill Script - Process SEC filings without Trigger.dev

USAGE:

  1. Test on local DB first:
     pnpm docker:up
     DATABASE_URL="postgresql://user:password@localhost:5432/whatsfiled" \\
       pnpm backfill-local -s 2025-01-01 -e 2025-01-07

  2. Then run on production:
     DATABASE_URL="postgresql://postgres.[ref]:[pass]@....supabase.com:6543/postgres" \\
       pnpm backfill-local -s 2025-01-01 -e 2025-01-31

OPTIONS:
  -s, --start <date>      Start date (YYYY-MM-DD) [required]
  -e, --end <date>        End date (YYYY-MM-DD) [required]
  -c, --concurrency <n>   Parallel DB operations (default: 3)
  -f, --form-types <t>    Form types to process (default: "4,4/A")
  --dry-run               Preview what would be processed
  --skip-discovery        Only process existing pending filings
  -h, --help              Show this help message

RATE LIMITING:
  SEC allows 10 req/s. Script uses 5 req/s to stay safe.
  --concurrency controls DB parallelism, not SEC requests.

EXAMPLES:
  # Dry run first
  DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-07 --dry-run

  # Backfill one week
  DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-07

  # Backfill one month
  DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-31

  # Re-process pending filings only
  DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-31 --skip-discovery
`);
}

// Progress display with auto-refresh
class Progress {
  private current = 0;
  private total = 0;
  private startTime = Date.now();
  private label = "";
  private timer: ReturnType<typeof setInterval> | null = null;
  private succeeded = 0;
  private failed = 0;
  private skipped = 0;
  private lastFile = "";
  private paused = false;
  private currentDay = "";

  start(label: string, total: number) {
    this.label = label;
    this.total = total;
    this.current = 0;
    this.succeeded = 0;
    this.failed = 0;
    this.skipped = 0;
    this.startTime = Date.now();
    this.print();
    // Auto-refresh every 500ms so it doesn't look stuck
    this.timer = setInterval(() => {
      if (!this.paused) this.print();
    }, 500);
  }

  /** Update total count (for when new filings are discovered) */
  updateTotal(newTotal: number) {
    this.total = newTotal;
  }

  /** Set current day being processed (shown in progress) */
  setCurrentDay(day: string) {
    this.currentDay = day;
  }

  /** Pause progress updates (call before printing other output) */
  pause() {
    this.paused = true;
  }

  /** Resume progress updates (call after printing other output) */
  resume() {
    this.paused = false;
    this.print();
  }

  increment(status: "success" | "fail" | "skip", fileName?: string) {
    this.current++;
    if (status === "success") this.succeeded++;
    else if (status === "fail") this.failed++;
    else if (status === "skip") this.skipped++;
    if (fileName) this.lastFile = fileName.split("/").pop() || fileName;
    if (!this.paused) this.print();
  }

  private print() {
    const pct =
      this.total > 0 ? ((this.current / this.total) * 100).toFixed(1) : "0";
    const elapsedMs = Date.now() - this.startTime;
    const elapsed = (elapsedMs / 1000).toFixed(0);
    const rate =
      this.current > 0 ? ((this.current / elapsedMs) * 1000).toFixed(1) : "0";

    // Calculate ETA
    let eta = "";
    if (this.current > 0 && this.current < this.total) {
      const remaining = this.total - this.current;
      const msPerItem = elapsedMs / this.current;
      const etaSeconds = Math.ceil((remaining * msPerItem) / 1000);
      const etaMin = Math.floor(etaSeconds / 60);
      const etaSec = etaSeconds % 60;
      eta = etaMin > 0 ? `${etaMin}m${etaSec}s` : `${etaSec}s`;
    }

    const stats = `ok:${this.succeeded} skip:${this.skipped} fail:${this.failed}`;
    const etaStr = eta ? ` ETA:${eta}` : "";
    const fileStr = this.lastFile ? ` [${this.lastFile}]` : "";
    const dayStr = this.currentDay ? ` (${this.currentDay})` : "";

    process.stdout.write(
      `\r${this.label}: ${this.current}/${this.total} (${pct}%) ${stats} - ${elapsed}s ${rate}/s${etaStr}${dayStr}${fileStr}      `,
    );
  }

  done() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(
      `\n${this.label}: Completed ${this.current}/${this.total} in ${elapsed}s (ok:${this.succeeded} skip:${this.skipped} fail:${this.failed})`,
    );
  }
}

// Process with controlled concurrency
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = processor(item).then((result) => {
      results.push(result);
    });
    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const status = await Promise.race([
          executing[i].then(() => "done"),
          Promise.resolve("pending"),
        ]);
        if (status === "done") {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

// Get all dates in a range (inclusive)
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Cache for index file names by year
const indexFileNameCache = new Map<number, string[]>();

// Discover and insert index file for a single date
async function discoverIndexFileForDate(
  db: Database,
  edgarClient: EdgarClient,
  date: string,
  formTypes: string[],
  dryRun: boolean,
): Promise<number> {
  const year = parseInt(date.substring(0, 4), 10);

  // Fetch index file names for the year (cached)
  if (!indexFileNameCache.has(year)) {
    await rateLimiter.acquire();
    const fileNames = await edgarClient.getDailyIndexFileNames(year);
    indexFileNameCache.set(year, fileNames);
  }

  const allFileNames = indexFileNameCache.get(year) ?? [];

  // Find the index file for this date
  const dateCompact = date.replace(/-/g, "");
  const fileName = allFileNames.find((f) =>
    f.includes(`form.${dateCompact}.idx`),
  );

  if (!fileName) {
    // No index file for this date (weekend/holiday)
    return 0;
  }

  if (dryRun) {
    return formTypes.length;
  }

  let inserted = 0;
  for (const formType of formTypes) {
    try {
      const [result] = await dbStats.time("insert_index_file", () =>
        db
          .insert(dailyIndexFiles)
          .values({
            indexDate: date,
            formType,
            fileName,
            status: "pending",
          })
          .onConflictDoNothing()
          .returning({ id: dailyIndexFiles.id }),
      );

      if (result) inserted++;
    } catch (err) {
      console.error(`  Error inserting ${fileName} (${formType}):`, err);
    }
  }

  return inserted;
}

// Process index files for a single date to populate filing queue
async function processIndexFilesForDate(
  db: Database,
  edgarClient: EdgarClient,
  date: string,
  dryRun: boolean,
): Promise<number> {
  // Get pending index files for this date
  const pendingIndexes = await dbStats.time("select_pending_indexes", () =>
    db
      .select()
      .from(dailyIndexFiles)
      .where(
        and(
          eq(dailyIndexFiles.status, "pending"),
          eq(dailyIndexFiles.indexDate, date),
        ),
      ),
  );

  if (pendingIndexes.length === 0) return 0;

  if (dryRun) {
    return 0;
  }

  let totalQueued = 0;

  for (const indexFile of pendingIndexes) {
    try {
      // Mark as processing
      await dbStats.time("update_index_processing", () =>
        db
          .update(dailyIndexFiles)
          .set({ status: "processing", startedAt: new Date() })
          .where(eq(dailyIndexFiles.id, indexFile.id)),
      );

      // Fetch and parse the daily index (rate limited)
      await rateLimiter.acquire();
      const { content } = await edgarClient.fetchDailyIndex(indexFile.fileName);
      const rows = edgarClient.parseDailyIndex(content, {
        formTypes: [indexFile.formType],
      });

      let queued = 0;
      for (const row of rows) {
        try {
          const [result] = await dbStats.time("insert_filing_queue", () =>
            db
              .insert(filingQueue)
              .values({
                dailyIndexFileId: indexFile.id,
                fileName: row.fileName,
                formType: row.formType,
                companyName: row.companyName,
                cik: row.cik,
                dateFiled: row.dateFiled,
                source: "daily_index",
                status: "pending",
                priority: 0,
              })
              .onConflictDoNothing()
              .returning({ id: filingQueue.id }),
          );

          if (result) queued++;
        } catch {
          // Ignore duplicates
        }
      }

      // Mark as completed
      await dbStats.time("update_index_completed", () =>
        db
          .update(dailyIndexFiles)
          .set({
            status: "completed",
            entriesCount: rows.length,
            processedCount: queued,
            completedAt: new Date(),
          })
          .where(eq(dailyIndexFiles.id, indexFile.id)),
      );

      totalQueued += queued;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await dbStats.time("update_index_failed", () =>
        db
          .update(dailyIndexFiles)
          .set({ status: "failed", errorMessage: message })
          .where(eq(dailyIndexFiles.id, indexFile.id)),
      );
    }
  }

  return totalQueued;
}

// Process pending filings for a single date
async function processFilingsForDate(
  db: Database,
  edgarClient: EdgarClient,
  date: string,
  concurrency: number,
  dryRun: boolean,
  progress: Progress,
): Promise<{ processed: number; failed: number; skipped: number }> {
  const dateFiled = date.replace(/-/g, "");

  if (dryRun) {
    return { processed: 0, failed: 0, skipped: 0 };
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const BATCH_SIZE = 100;
  const LOCK_DURATION_MS = 5 * 60 * 1000;

  // Process in batches
  while (true) {
    // Get a batch of pending filings for this date
    const batch = await dbStats.time("select_filing_batch", () =>
      db
        .select()
        .from(filingQueue)
        .where(
          and(
            eq(filingQueue.status, "pending"),
            eq(filingQueue.dateFiled, dateFiled),
            or(
              isNull(filingQueue.lockedUntil),
              lt(filingQueue.lockedUntil, new Date()),
            ),
          ),
        )
        .limit(BATCH_SIZE),
    );

    if (batch.length === 0) break;

    // BULK PRE-CHECK: Skip filings that already exist in DB (much faster than one-by-one)
    // Extract accession numbers from batch
    const accessionNumbers = batch
      .map((entry) => {
        const match = entry.fileName.match(/(\d{10}-\d{2}-\d{6})/);
        return match ? match[1] : null;
      })
      .filter((acc): acc is string => acc !== null);

    // Check which ones already exist (single bulk query)
    let existingAccessions = new Set<string>();
    if (accessionNumbers.length > 0) {
      const existingFilings = await dbStats.time("bulk_check_existing", () =>
        db
          .select({ accessionNumber: filings.accessionNumber })
          .from(filings)
          .where(inArray(filings.accessionNumber, accessionNumbers)),
      );
      existingAccessions = new Set(
        existingFilings.map((f) => f.accessionNumber),
      );
    }

    // Bulk update the ones that already exist to "skipped" (single bulk query)
    if (existingAccessions.size > 0) {
      const idsToSkip = batch
        .filter((entry) => {
          const match = entry.fileName.match(/(\d{10}-\d{2}-\d{6})/);
          return match && existingAccessions.has(match[1]);
        })
        .map((entry) => entry.id);

      if (idsToSkip.length > 0) {
        await dbStats.time("bulk_skip_existing", () =>
          db
            .update(filingQueue)
            .set({
              status: "skipped",
              processedAt: new Date(),
            })
            .where(inArray(filingQueue.id, idsToSkip)),
        );

        // Update counters
        skipped += idsToSkip.length;
        for (const id of idsToSkip) {
          const entry = batch.find((e) => e.id === id);
          if (entry) progress.increment("skip", entry.fileName);
        }
      }
    }

    // Filter batch to only items that need processing
    const toProcess = batch.filter((entry) => {
      const match = entry.fileName.match(/(\d{10}-\d{2}-\d{6})/);
      return !match || !existingAccessions.has(match[1]);
    });

    if (toProcess.length === 0) continue;

    // Process remaining items with concurrency
    const processOne = async (entry: (typeof toProcess)[0]) => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS);

      // Try to acquire lock
      const [locked] = await dbStats.time("update_acquire_lock", () =>
        db
          .update(filingQueue)
          .set({ status: "processing", lockedUntil: lockUntil })
          .where(
            and(
              eq(filingQueue.id, entry.id),
              eq(filingQueue.status, "pending"),
              or(
                isNull(filingQueue.lockedUntil),
                lt(filingQueue.lockedUntil, now),
              ),
            ),
          )
          .returning(),
      );

      if (!locked) {
        skipped++;
        progress.increment("skip", entry.fileName);
        return;
      }

      try {
        // Fetch the filing content (rate limited)
        await rateLimiter.acquire();
        const content = await edgarClient.fetchFiling(locked.fileName);

        // Parse Form 4
        const doc = edgarClient.parseForm4(content, {
          fileName: locked.fileName,
        });

        // Get filed at timestamp
        const acceptanceDateTime = parseAcceptanceDateTime(content);
        const filedAt = acceptanceDateTime ?? parseFilingDate(locked.dateFiled);

        // Map to database (not storing rawContent to save space and speed up inserts)
        const result = await dbStats.time("transaction_map_form4", () =>
          db.transaction(async (tx) => {
            return await mapForm4ToDb(tx as unknown as Database, doc, {
              documentUrl: doc.source?.formattedXmlUrl,
              filedAt,
            });
          }),
        );

        // Mark as completed
        const status = result.skipped ? "skipped" : "completed";
        await dbStats.time("update_filing_completed", () =>
          db
            .update(filingQueue)
            .set({
              status,
              lockedUntil: null,
              processedAt: new Date(),
              lastError: null,
              lastErrorAt: null,
            })
            .where(eq(filingQueue.id, entry.id)),
        );

        if (result.skipped) {
          skipped++;
          progress.increment("skip", locked.fileName);
        } else {
          processed++;
          progress.increment("success", locked.fileName);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Log the error
        console.error(`\n  [ERROR] ${locked.fileName}: ${message}`);

        // Mark as failed after 3 retries
        const newRetryCount = (locked.retryCount ?? 0) + 1;
        const newStatus = newRetryCount >= 3 ? "failed" : "pending";

        await dbStats.time("update_filing_error", () =>
          db
            .update(filingQueue)
            .set({
              status: newStatus,
              lockedUntil: null,
              retryCount: newRetryCount,
              lastError: message,
              lastErrorAt: new Date(),
            })
            .where(eq(filingQueue.id, entry.id)),
        );

        if (newStatus === "failed") {
          failed++;
          progress.increment("fail", locked.fileName);
        } else {
          // Will be retried, count as skip for now
          progress.increment("skip", locked.fileName);
        }
      }
    };

    // Process remaining items with controlled concurrency
    await processWithConcurrency(toProcess, concurrency, processOne);
  }

  return { processed, failed, skipped };
}

async function main() {
  if (values.help) {
    printHelp();
    return;
  }

  const startDate = values.start;
  const endDate = values.end;

  if (!startDate || !endDate) {
    console.error("Error: --start and --end are required");
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    console.error("Error: Dates must be in YYYY-MM-DD format");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const concurrency = parseInt(values.concurrency ?? "3", 10);
  const formTypes = (values["form-types"] ?? "4,4/A")
    .split(",")
    .map((s) => s.trim());
  const dryRun = values["dry-run"] ?? false;
  const skipDiscovery = values["skip-discovery"] ?? false;

  console.log("=== Local Backfill ===");
  console.log(`Date range:   ${startDate} to ${endDate}`);
  console.log(`Form types:   ${formTypes.join(", ")}`);
  console.log(`Concurrency:  ${concurrency}`);
  console.log(`Dry run:      ${dryRun}`);
  console.log(`Skip discovery: ${skipDiscovery}`);

  const db = getDb();
  const edgarClient = new EdgarClient({ userAgent: SEC_USER_AGENT });

  const startTime = Date.now();

  // Test DB connection first
  console.log(`\nTesting database connection...`);
  try {
    await dbStats.time("db_test_connection", () =>
      db.select({ count: sql<number>`1` }).from(dailyIndexFiles).limit(1),
    );
    console.log(`Database connected`);
  } catch (err) {
    console.error(`Database connection failed:`, err);
    throw err;
  }

  // Get all dates in range
  const dates = getDatesInRange(startDate, endDate);
  console.log(`\nProcessing ${dates.length} days...`);

  // First, count total expected filings for progress bar
  let totalFilings = 0;
  if (!dryRun) {
    // Count existing pending filings in range
    const dateFiledStart = startDate.replace(/-/g, "");
    const dateFiledEnd = endDate.replace(/-/g, "");
    const [{ count }] = await dbStats.time("count_pending_filings", () =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(filingQueue)
        .where(
          and(
            eq(filingQueue.status, "pending"),
            gte(filingQueue.dateFiled, dateFiledStart),
            lte(filingQueue.dateFiled, dateFiledEnd),
          ),
        ),
    );
    totalFilings = count;
  }

  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalQueued = 0;
  let daysWithFilings = 0;

  // Create a single progress bar for all filings
  const progress = new Progress();
  let progressStarted = false;

  // Process each day: discover -> index -> filings
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const dayNum = i + 1;

    // Skip weekends (no SEC filings)
    // Use getUTCDay() because date string "YYYY-MM-DD" is parsed as UTC midnight
    const dayOfWeek = new Date(date).getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    // Pause progress bar while we print day info
    if (progressStarted) {
      progress.pause();
      process.stdout.write("\n"); // Move to new line before day header
    }

    console.log(`[${dayNum}/${dates.length}] ${date}`);

    // Step 1: Discover index file for this date (unless skipped)
    if (!skipDiscovery) {
      const discovered = await discoverIndexFileForDate(
        db,
        edgarClient,
        date,
        formTypes,
        dryRun,
      );
      if (discovered > 0) {
        console.log(`  Discovered ${discovered} index files`);
      }
    }

    // Step 2: Process index files for this date
    if (!skipDiscovery) {
      const queued = await processIndexFilesForDate(
        db,
        edgarClient,
        date,
        dryRun,
      );
      if (queued > 0) {
        console.log(`  Queued ${queued} filings`);
        totalQueued += queued;
        // Update total for progress bar
        totalFilings += queued;
        if (progressStarted) {
          progress.updateTotal(totalFilings);
        }
      }
    }

    // Step 3: Process filings for this date
    // Count pending filings for this date
    const dateFiled = date.replace(/-/g, "");
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(filingQueue)
      .where(
        and(
          eq(filingQueue.status, "pending"),
          eq(filingQueue.dateFiled, dateFiled),
        ),
      );

    if (count > 0) {
      console.log(`  Processing ${count} filings...`);
      daysWithFilings++;

      if (!progressStarted && totalFilings > 0) {
        progress.start("Filings", totalFilings);
        progressStarted = true;
      } else if (progressStarted) {
        progress.setCurrentDay(date);
        progress.resume();
      }

      const results = await processFilingsForDate(
        db,
        edgarClient,
        date,
        concurrency,
        dryRun,
        progress,
      );

      totalProcessed += results.processed;
      totalFailed += results.failed;
      totalSkipped += results.skipped;
    } else {
      console.log(`  No pending filings`);
      if (progressStarted) {
        progress.resume();
      }
    }
  }

  if (progressStarted) {
    progress.done();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== Summary ===");
  console.log(`Days in range:    ${dates.length}`);
  console.log(`Days with filings: ${daysWithFilings}`);
  console.log(`Filings queued:   ${totalQueued}`);
  console.log(`Processed:        ${totalProcessed}`);
  console.log(`Skipped:          ${totalSkipped}`);
  console.log(`Failed:           ${totalFailed}`);
  console.log(`Total time:       ${elapsed}s`);

  // Print DB operation stats
  dbStats.print();

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
