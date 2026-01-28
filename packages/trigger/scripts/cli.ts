#!/usr/bin/env tsx
/**
 * Trigger.dev Pipeline CLI
 *
 * Usage:
 *   pnpm --filter @whatsfiled/trigger cli --help
 *   pnpm --filter @whatsfiled/trigger cli stats
 *   pnpm --filter @whatsfiled/trigger cli trigger --year 2026
 *   pnpm --filter @whatsfiled/trigger cli trigger --year 2026 --limit 10
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
  stats                 Show pipeline statistics
  trigger               Trigger a backfill run
  runs                  List recent runs

Options:
  -y, --year <year>     Year to backfill (default: current year)
  -l, --limit <n>       Limit number of filings to process
  -f, --form-types <t>  Form types to process (default: "4,4/A")
  -w, --wait            Wait for run to complete (shows progress)
  -h, --help            Show this help message

Examples:
  # Show pipeline stats
  pnpm cli stats

  # Trigger backfill for 2026
  pnpm cli trigger --year 2026

  # Trigger with limit and wait for completion
  pnpm cli trigger --year 2026 --limit 10 --wait

  # List recent runs
  pnpm cli runs
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

async function triggerBackfill() {
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

  console.log("\n=== Triggering Backfill ===\n");
  console.log(`Year:       ${year}`);
  console.log(`Form types: ${formTypes.join(", ")}`);
  if (limit) console.log(`Limit:      ${limit} filings per index file`);
  console.log("");

  const payload = {
    year,
    formTypes,
    // For testing: limit to 1 index file and N filings
    ...(limit && { limitIndexFiles: 1, limitFilingsPerIndex: limit }),
  };

  const handle = await tasks.trigger("backfill", payload);

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

  switch (command) {
    case "stats":
      await showStats();
      break;

    case "trigger":
      await triggerBackfill();
      break;

    case "runs":
      await listRuns();
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
