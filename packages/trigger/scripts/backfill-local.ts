import { parseArgs } from "node:util";
import {
  type Database,
  dailyIndexFiles,
  filingQueue,
  getDb,
} from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { and, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
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
    this.timer = setInterval(() => this.print(), 500);
  }

  increment(status: "success" | "fail" | "skip", fileName?: string) {
    this.current++;
    if (status === "success") this.succeeded++;
    else if (status === "fail") this.failed++;
    else if (status === "skip") this.skipped++;
    if (fileName) this.lastFile = fileName.split("/").pop() || fileName;
    this.print();
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

    process.stdout.write(
      `\r${this.label}: ${this.current}/${this.total} (${pct}%) ${stats} - ${elapsed}s ${rate}/s${etaStr}${fileStr}      `,
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

// Discover and insert index files
async function discoverIndexFiles(
  db: Database,
  edgarClient: EdgarClient,
  startDate: string,
  endDate: string,
  formTypes: string[],
  dryRun: boolean,
): Promise<number> {
  console.log(`\nDiscovering index files from ${startDate} to ${endDate}...`);

  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);

  // Fetch index file names for each year
  const allFileNames: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    console.log(`  Fetching index list for ${year}...`);
    await rateLimiter.acquire();
    const fileNames = await edgarClient.getDailyIndexFileNames(year);
    allFileNames.push(...fileNames);
  }

  // Filter to date range
  const fileNames = allFileNames.filter((fileName) => {
    const dateMatch = fileName.match(/form\.(\d{4})(\d{2})(\d{2})\.idx/);
    if (!dateMatch) return false;
    const fileDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    return fileDate >= startDate && fileDate <= endDate;
  });

  console.log(`  Found ${fileNames.length} index files in date range`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would insert index file records`);
    return fileNames.length * formTypes.length;
  }

  const totalToInsert = fileNames.length * formTypes.length;
  console.log(`  Inserting up to ${totalToInsert} index file records...`);
  console.log(`  Testing database connection...`);

  // Test DB connection first
  try {
    const testStart = Date.now();
    await db.select({ count: sql<number>`1` }).from(dailyIndexFiles).limit(1);
    console.log(`  Database connected (${Date.now() - testStart}ms)`);
  } catch (err) {
    console.error(`  Database connection failed:`, err);
    throw err;
  }

  let inserted = 0;
  let processed = 0;
  const startTime = Date.now();

  for (const fileName of fileNames) {
    const dateMatch = fileName.match(/form\.(\d{4})(\d{2})(\d{2})\.idx/);
    if (!dateMatch) continue;

    const indexDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

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

        if (result) inserted++;
      } catch {
        // Ignore duplicates
      }
      processed++;

      // Log progress every 100 records
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1);
        process.stdout.write(`\r  Inserting: ${processed}/${totalToInsert} (${inserted} new) - ${elapsed}s ${rate}/s    `);
      }
    }
  }

  console.log(`\n  Inserted ${inserted} new index file records`);
  return inserted;
}

// Process index files to populate filing queue
async function processIndexFiles(
  db: Database,
  edgarClient: EdgarClient,
  startDate: string,
  endDate: string,
  concurrency: number,
  dryRun: boolean,
): Promise<number> {
  console.log(`\nProcessing pending index files...`);

  // Get pending index files in date range
  const pendingIndexes = await db
    .select()
    .from(dailyIndexFiles)
    .where(
      and(
        eq(dailyIndexFiles.status, "pending"),
        gte(dailyIndexFiles.indexDate, startDate),
        lte(dailyIndexFiles.indexDate, endDate),
      ),
    )
    .orderBy(dailyIndexFiles.indexDate);

  console.log(`  Found ${pendingIndexes.length} pending index files`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would process index files`);
    return 0;
  }

  if (pendingIndexes.length === 0) return 0;

  const progress = new Progress();
  progress.start("Index files", pendingIndexes.length);

  let totalQueued = 0;

  for (const indexFile of pendingIndexes) {
    try {
      // Mark as processing
      await db
        .update(dailyIndexFiles)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(dailyIndexFiles.id, indexFile.id));

      // Fetch and parse the daily index (rate limited)
      await rateLimiter.acquire();
      const { content } = await edgarClient.fetchDailyIndex(indexFile.fileName);
      const rows = edgarClient.parseDailyIndex(content, {
        formTypes: [indexFile.formType],
      });

      let queued = 0;
      for (const row of rows) {
        try {
          const [result] = await db
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
            .returning({ id: filingQueue.id });

          if (result) queued++;
        } catch {
          // Ignore duplicates
        }
      }

      // Mark as completed
      await db
        .update(dailyIndexFiles)
        .set({
          status: "completed",
          entriesCount: rows.length,
          processedCount: queued,
          completedAt: new Date(),
        })
        .where(eq(dailyIndexFiles.id, indexFile.id));

      totalQueued += queued;
      progress.increment("success", indexFile.fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(dailyIndexFiles)
        .set({ status: "failed", errorMessage: message })
        .where(eq(dailyIndexFiles.id, indexFile.id));
      progress.increment("fail", indexFile.fileName);
    }
  }

  progress.done();
  console.log(`  Total filings queued: ${totalQueued}`);
  return totalQueued;
}

// Process pending filings
async function processFilings(
  db: Database,
  edgarClient: EdgarClient,
  startDate: string,
  endDate: string,
  concurrency: number,
  dryRun: boolean,
): Promise<{ processed: number; failed: number; skipped: number }> {
  console.log(`\nProcessing pending filings...`);

  const dateFiledStart = startDate.replace(/-/g, "");
  const dateFiledEnd = endDate.replace(/-/g, "");

  // Get pending filings count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(filingQueue)
    .where(
      and(
        eq(filingQueue.status, "pending"),
        gte(filingQueue.dateFiled, dateFiledStart),
        lte(filingQueue.dateFiled, dateFiledEnd),
      ),
    );

  console.log(`  Found ${count} pending filings`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would process ${count} filings`);
    return { processed: 0, failed: 0, skipped: 0 };
  }

  if (count === 0) return { processed: 0, failed: 0, skipped: 0 };

  const progress = new Progress();
  progress.start("Filings", count);

  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const BATCH_SIZE = 100;
  const LOCK_DURATION_MS = 5 * 60 * 1000;

  // Process in batches
  while (true) {
    // Get a batch of pending filings
    const batch = await db
      .select()
      .from(filingQueue)
      .where(
        and(
          eq(filingQueue.status, "pending"),
          gte(filingQueue.dateFiled, dateFiledStart),
          lte(filingQueue.dateFiled, dateFiledEnd),
          or(
            isNull(filingQueue.lockedUntil),
            lt(filingQueue.lockedUntil, new Date()),
          ),
        ),
      )
      .limit(BATCH_SIZE);

    if (batch.length === 0) break;

    // Process batch with concurrency
    const processOne = async (entry: (typeof batch)[0]) => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS);

      // Try to acquire lock
      const [locked] = await db
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
        .returning();

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

        // Map to database
        const result = await db.transaction(async (tx) => {
          return await mapForm4ToDb(tx as unknown as Database, doc, {
            rawContent: content,
            documentUrl: doc.source?.formattedXmlUrl,
            filedAt,
          });
        });

        // Mark as completed
        const status = result.skipped ? "skipped" : "completed";
        await db
          .update(filingQueue)
          .set({
            status,
            lockedUntil: null,
            processedAt: new Date(),
            lastError: null,
            lastErrorAt: null,
          })
          .where(eq(filingQueue.id, entry.id));

        if (result.skipped) {
          skipped++;
          progress.increment("skip", locked.fileName);
        } else {
          processed++;
          progress.increment("success", locked.fileName);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Mark as failed after 3 retries
        const newRetryCount = (locked.retryCount ?? 0) + 1;
        const newStatus = newRetryCount >= 3 ? "failed" : "pending";

        await db
          .update(filingQueue)
          .set({
            status: newStatus,
            lockedUntil: null,
            retryCount: newRetryCount,
            lastError: message,
            lastErrorAt: new Date(),
          })
          .where(eq(filingQueue.id, entry.id));

        if (newStatus === "failed") {
          failed++;
          progress.increment("fail", locked.fileName);
        } else {
          // Will be retried, count as skip for now
          progress.increment("skip", locked.fileName);
        }
      }
    };

    // Process batch with controlled concurrency
    await processWithConcurrency(batch, concurrency, processOne);
  }

  progress.done();
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

  // Step 1: Discover index files (unless skipped)
  if (!skipDiscovery) {
    await discoverIndexFiles(
      db,
      edgarClient,
      startDate,
      endDate,
      formTypes,
      dryRun,
    );
  }

  // Step 2: Process index files to populate filing queue
  if (!skipDiscovery) {
    await processIndexFiles(
      db,
      edgarClient,
      startDate,
      endDate,
      concurrency,
      dryRun,
    );
  }

  // Step 3: Process pending filings
  const results = await processFilings(
    db,
    edgarClient,
    startDate,
    endDate,
    concurrency,
    dryRun,
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== Summary ===");
  console.log(`Processed: ${results.processed}`);
  console.log(`Skipped:   ${results.skipped}`);
  console.log(`Failed:    ${results.failed}`);
  console.log(`Total time: ${elapsed}s`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
