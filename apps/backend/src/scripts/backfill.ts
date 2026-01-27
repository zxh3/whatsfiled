#!/usr/bin/env tsx
/**
 * Backfill CLI Script
 *
 * Usage:
 *   pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2026 --dry-run
 *   pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2026 --limit 10
 *   pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2026 --stage discovery
 *   pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2026 --stage all
 */

import { parseArgs } from "node:util";
import {
  cleanupStaleLocks,
  discoverDailyIndexFiles,
  getQueueStats,
  processFilings,
  processIndexFiles,
} from "../pipeline/index.js";

const { values } = parseArgs({
  options: {
    year: {
      type: "string",
      short: "y",
    },
    stage: {
      type: "string",
      short: "s",
      default: "all",
    },
    limit: {
      type: "string",
      short: "l",
    },
    "dry-run": {
      type: "boolean",
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
SEC EDGAR Backfill CLI

Usage:
  tsx src/scripts/backfill.ts [options]

Options:
  -y, --year <year>     Year to backfill (required for discovery)
  -s, --stage <stage>   Stage to run: discovery, index, filing, stats, all (default: all)
  -l, --limit <n>       Limit number of items to process
  --dry-run             Don't actually modify the database
  -h, --help            Show this help message

Stages:
  discovery   Discover daily index files for the year
  index       Process pending index files (create queue entries)
  filing      Process pending filings from the queue
  stats       Show current pipeline statistics
  all         Run discovery, then index, then filing

Examples:
  # Dry run discovery for 2026
  tsx src/scripts/backfill.ts --year 2026 --dry-run

  # Discover and process 2026 with limit
  tsx src/scripts/backfill.ts --year 2026 --limit 10

  # Just process pending filings
  tsx src/scripts/backfill.ts --stage filing --limit 50

  # Show pipeline stats
  tsx src/scripts/backfill.ts --stage stats
`);
}

async function main() {
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const stage = values.stage || "all";
  const dryRun = values["dry-run"] || false;
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;

  console.log(`\n=== SEC EDGAR Backfill ===`);
  console.log(`Stage: ${stage}`);
  console.log(`Dry run: ${dryRun}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log("");

  try {
    // Show stats
    if (stage === "stats" || stage === "all") {
      console.log("--- Pipeline Statistics ---");
      const stats = await getQueueStats();
      console.log("Filing Queue:");
      console.log(`  Pending:    ${stats.pending}`);
      console.log(`  Processing: ${stats.processing}`);
      console.log(`  Completed:  ${stats.completed}`);
      console.log(`  Failed:     ${stats.failed}`);
      console.log(`  Skipped:    ${stats.skipped}`);
      console.log(`  Total:      ${stats.total}`);
      console.log("");

      if (stage === "stats") {
        process.exit(0);
      }
    }

    // Stage 1: Discovery
    if (stage === "discovery" || stage === "all") {
      if (!values.year) {
        console.error("Error: --year is required for discovery stage");
        process.exit(1);
      }

      const year = parseInt(values.year, 10);
      if (Number.isNaN(year) || year < 2000 || year > 2100) {
        console.error("Error: Invalid year");
        process.exit(1);
      }

      console.log(`--- Stage 1: Index Discovery (${year}) ---`);
      const discoveryResult = await discoverDailyIndexFiles({
        year,
        dryRun,
      });
      console.log(`Discovered: ${discoveryResult.discovered}`);
      console.log(`Inserted:   ${discoveryResult.inserted}`);
      console.log(`Skipped:    ${discoveryResult.skipped}`);
      if (discoveryResult.errors.length > 0) {
        console.log(`Errors:     ${discoveryResult.errors.length}`);
        for (const err of discoveryResult.errors.slice(0, 5)) {
          console.log(`  - ${err}`);
        }
      }
      console.log("");
    }

    // Stage 2: Index Processing
    if (stage === "index" || stage === "all") {
      console.log("--- Stage 2: Index Processing ---");

      // Clean up stale locks first
      await cleanupStaleLocks();

      const indexResult = await processIndexFiles({
        batchSize: limit || 20,
        dryRun,
      });
      console.log(`Processed:      ${indexResult.processed}`);
      console.log(`Filings queued: ${indexResult.filingsQueued}`);
      console.log(`Skipped:        ${indexResult.filingsSkipped}`);
      if (indexResult.errors.length > 0) {
        console.log(`Errors:         ${indexResult.errors.length}`);
        for (const err of indexResult.errors.slice(0, 5)) {
          console.log(`  - ${err.indexFileId}: ${err.error}`);
        }
      }
      console.log("");
    }

    // Stage 3: Filing Processing
    if (stage === "filing" || stage === "all") {
      console.log("--- Stage 3: Filing Processing ---");

      // Clean up stale locks first
      await cleanupStaleLocks();

      const filingResult = await processFilings({
        batchSize: limit || 50,
        dryRun,
      });
      console.log(`Processed:  ${filingResult.processed}`);
      console.log(`Completed:  ${filingResult.completed}`);
      console.log(`Failed:     ${filingResult.failed}`);
      console.log(`Skipped:    ${filingResult.skipped}`);
      if (filingResult.errors.length > 0) {
        console.log(`Errors:     ${filingResult.errors.length}`);
        for (const err of filingResult.errors.slice(0, 5)) {
          console.log(`  - ${err.fileName}: ${err.error}`);
        }
      }
      console.log("");
    }

    // Show final stats
    if (stage === "all") {
      console.log("--- Final Statistics ---");
      const finalStats = await getQueueStats();
      console.log(`Pending:    ${finalStats.pending}`);
      console.log(`Processing: ${finalStats.processing}`);
      console.log(`Completed:  ${finalStats.completed}`);
      console.log(`Failed:     ${finalStats.failed}`);
      console.log(`Skipped:    ${finalStats.skipped}`);
      console.log(`Total:      ${finalStats.total}`);
    }

    console.log("\n=== Backfill Complete ===\n");
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  }
}

main();
