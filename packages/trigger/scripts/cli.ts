#!/usr/bin/env tsx
/**
 * Trigger.dev Pipeline CLI
 *
 * Usage:
 *   pnpm cli <command> [options]
 *
 * Commands:
 *   stats                    Show pipeline statistics
 *   runs                     List recent Trigger.dev runs
 *   discover                 Discover index files for a year
 *   process indexes          Process pending index files
 *   process filings          Process pending filings
 *   sync                     Full pipeline (discover + process all)
 */

import { parseArgs } from "node:util";
import { configure, runs, tasks } from "@trigger.dev/sdk/v3";
import { dailyIndexFiles, filingQueue, getDb } from "@whatsfiled/db";
import { sql } from "drizzle-orm";

// Load config
configure({
  secretKey: process.env.TRIGGER_SECRET_KEY,
});

const PROJECT_ID = "proj_tqvevnijvybdwlvcqfee";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    year: {
      type: "string",
      short: "y",
    },
    limit: {
      type: "string",
      short: "l",
    },
    "form-types": {
      type: "string",
      short: "f",
      default: "4,4/A",
    },
    wait: {
      type: "boolean",
      short: "w",
      default: false,
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
  },
});

function printHelp() {
  console.log(`
Trigger.dev Pipeline CLI

Usage:
  pnpm cli <command> [options]

Commands:
  stats                    Show pipeline statistics
  runs                     List recent Trigger.dev runs
  discover                 Discover index files for a year (no processing)
  process indexes          Process pending index files → creates filing queue
  process filings          Process pending filings → creates filing records
  sync                     Full pipeline: discover + process all

Options:
  -y, --year <year>        Year for discovery/sync (default: current year)
  -l, --limit <n>          Limit items to process
  -f, --form-types <t>     Form types (default: "4,4/A")
  -w, --wait               Wait for run to complete
  -h, --help               Show this help message

Examples:
  # Show current pipeline status
  pnpm cli stats

  # Discover what's available for 2025 (doesn't process)
  pnpm cli discover --year 2025

  # Process 10 pending index files
  pnpm cli process indexes --limit 10 --wait

  # Process 100 pending filings
  pnpm cli process filings --limit 100

  # Full sync for current year
  pnpm cli sync --wait

  # Full sync with limits (for testing)
  pnpm cli sync --year 2026 --limit 5 --wait
`);
}

async function showStats() {
  const db = getDb();

  console.log("\n=== Pipeline Statistics ===\n");

  // Index file stats
  const indexStats = await db
    .select({
      status: dailyIndexFiles.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dailyIndexFiles)
    .groupBy(dailyIndexFiles.status);

  const indexCounts: Record<string, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };
  let indexTotal = 0;
  for (const row of indexStats) {
    indexCounts[row.status] = row.count;
    indexTotal += row.count;
  }

  console.log("Index Files:");
  console.log(`  Pending:    ${indexCounts.pending}`);
  console.log(`  Processing: ${indexCounts.processing}`);
  console.log(`  Completed:  ${indexCounts.completed}`);
  console.log(`  Failed:     ${indexCounts.failed}`);
  console.log(`  Total:      ${indexTotal}`);
  console.log("");

  // Filing queue stats
  const queueStats = await db
    .select({
      status: filingQueue.status,
      count: sql<number>`count(*)::int`,
    })
    .from(filingQueue)
    .groupBy(filingQueue.status);

  const queueCounts: Record<string, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };
  let queueTotal = 0;
  for (const row of queueStats) {
    queueCounts[row.status] = row.count;
    queueTotal += row.count;
  }

  console.log("Filing Queue:");
  console.log(`  Pending:    ${queueCounts.pending}`);
  console.log(`  Processing: ${queueCounts.processing}`);
  console.log(`  Completed:  ${queueCounts.completed}`);
  console.log(`  Failed:     ${queueCounts.failed}`);
  console.log(`  Skipped:    ${queueCounts.skipped}`);
  console.log(`  Total:      ${queueTotal}`);
  console.log("");
}

async function listRuns() {
  console.log("\n=== Recent Runs ===\n");

  const recentRuns = await runs.list({
    limit: 10,
  });

  if (recentRuns.data.length === 0) {
    console.log("No runs found.");
    return;
  }

  for (const run of recentRuns.data) {
    const status = run.status.padEnd(12);
    const taskId = run.taskIdentifier.padEnd(25);
    const createdAt = new Date(run.createdAt).toLocaleString();
    console.log(`${status} ${taskId} ${createdAt}`);
    console.log(
      `         https://cloud.trigger.dev/projects/v3/${PROJECT_ID}/runs/${run.id}`,
    );
    console.log("");
  }
}

async function triggerAndWait(
  taskId: string,
  payload: Record<string, unknown>,
  shouldWait: boolean,
) {
  const handle = await tasks.trigger(taskId, payload);

  console.log(`Run triggered!`);
  console.log(`Run ID: ${handle.id}`);
  console.log(
    `View:   https://cloud.trigger.dev/projects/v3/${PROJECT_ID}/runs/${handle.id}`,
  );
  console.log("");

  if (shouldWait) {
    console.log("Waiting for completion...\n");

    const result = await runs.poll(handle.id, { pollIntervalMs: 2000 });

    if (result.status === "COMPLETED") {
      console.log("Run completed successfully!");
      if (result.output) {
        console.log("Result:", JSON.stringify(result.output, null, 2));
      }
    } else {
      console.log(`Run finished with status: ${result.status}`);
      if (result.error) {
        console.error("Error:", result.error);
      }
    }
  }
}

async function discover() {
  const year = values.year
    ? parseInt(values.year, 10)
    : new Date().getFullYear();
  const formTypes = values["form-types"]?.split(",").map((s) => s.trim()) ?? [
    "4",
    "4/A",
  ];
  const shouldWait = values.wait;

  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    console.error("Error: Invalid year");
    process.exit(1);
  }

  console.log("\n=== Discovering Index Files ===\n");
  console.log(`Year:       ${year}`);
  console.log(`Form types: ${formTypes.join(", ")}`);
  console.log(`Processing: No (discovery only)`);
  console.log("");

  await triggerAndWait(
    "discover-index-files",
    {
      year,
      formTypes,
      triggerProcessing: false, // Don't cascade
    },
    shouldWait,
  );
}

async function processIndexes() {
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;
  const shouldWait = values.wait;

  console.log("\n=== Processing Pending Index Files ===\n");
  if (limit) console.log(`Limit: ${limit}`);
  console.log("");

  await triggerAndWait(
    "process-pending-indexes",
    {
      limit,
      triggerFilingProcessing: false, // Don't cascade to filings
    },
    shouldWait,
  );
}

async function processFilings() {
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;
  const shouldWait = values.wait;

  console.log("\n=== Processing Pending Filings ===\n");
  if (limit) console.log(`Limit: ${limit}`);
  console.log("");

  await triggerAndWait(
    "process-pending-filings",
    {
      limit,
    },
    shouldWait,
  );
}

async function sync() {
  const year = values.year
    ? parseInt(values.year, 10)
    : new Date().getFullYear();
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;
  const formTypes = values["form-types"]?.split(",").map((s) => s.trim()) ?? [
    "4",
    "4/A",
  ];
  const shouldWait = values.wait;

  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    console.error("Error: Invalid year");
    process.exit(1);
  }

  console.log("\n=== Full Sync ===\n");
  console.log(`Year:       ${year}`);
  console.log(`Form types: ${formTypes.join(", ")}`);
  if (limit) console.log(`Limit:      ${limit} (per stage)`);
  console.log("");

  // For sync with limit, use the backfill task which handles cascading
  await triggerAndWait(
    "backfill",
    {
      year,
      formTypes,
      ...(limit && { limitIndexFiles: limit, limitFilingsPerIndex: limit }),
    },
    shouldWait,
  );
}

async function main() {
  if (values.help || positionals.length === 0) {
    printHelp();
    return;
  }

  if (!process.env.TRIGGER_SECRET_KEY) {
    console.error("Error: TRIGGER_SECRET_KEY environment variable is required");
    console.error("Create packages/trigger/.env.local with your secret key");
    process.exit(1);
  }

  const command = positionals[0];
  const subcommand = positionals[1];

  switch (command) {
    case "stats":
      await showStats();
      break;

    case "runs":
      await listRuns();
      break;

    case "discover":
      await discover();
      break;

    case "process":
      if (subcommand === "indexes" || subcommand === "index") {
        await processIndexes();
      } else if (subcommand === "filings" || subcommand === "filing") {
        await processFilings();
      } else {
        console.error(
          `Unknown subcommand: process ${subcommand || "(missing)"}`,
        );
        console.error("Available: process indexes, process filings");
        process.exit(1);
      }
      break;

    case "sync":
      await sync();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run with --help for usage information");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
