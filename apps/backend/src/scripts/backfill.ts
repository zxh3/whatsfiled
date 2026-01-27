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

import os from "node:os";
import { parseArgs } from "node:util";
import { db } from "../db/index.js";
import { pipelineWorkers } from "../db/schema.js";
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
    return;
  }

  const stage = values.stage || "all";
  const dryRun = values["dry-run"] || false;
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;
  const workerKey = `backfill:${stage}:${process.pid}`;
  const startedAt = new Date();
  const details = JSON.stringify({
    stage,
    year: values.year ? Number(values.year) : undefined,
    limit,
    dryRun,
  });

  const upsertHeartbeat = async (status: "running" | "stopped") => {
    const now = new Date();
    await db
      .insert(pipelineWorkers)
      .values({
        workerKey,
        workerType: "backfill",
        stage,
        host: os.hostname(),
        pid: process.pid,
        status,
        startedAt,
        lastHeartbeatAt: now,
        endedAt: status === "stopped" ? now : null,
        details,
      })
      .onConflictDoUpdate({
        target: pipelineWorkers.workerKey,
        set: {
          workerType: "backfill",
          stage,
          host: os.hostname(),
          pid: process.pid,
          status,
          lastHeartbeatAt: now,
          endedAt: status === "stopped" ? now : null,
          details,
        },
      });
  };

  const startHeartbeat = () => {
    if (stage === "stats") return { stop: async () => {} };
    let active = true;
    void upsertHeartbeat("running");
    const interval = setInterval(() => {
      if (!active) return;
      void upsertHeartbeat("running");
    }, 30000);

    const stop = async () => {
      if (!active) return;
      active = false;
      clearInterval(interval);
      await upsertHeartbeat("stopped");
    };

    const handleSignal = async () => {
      await stop();
      process.exit(0);
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);

    return { stop };
  };

  console.log(`\n=== SEC EDGAR Backfill ===`);
  console.log(`Stage: ${stage}`);
  console.log(`Dry run: ${dryRun}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log("");

  const heartbeat = startHeartbeat();

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
        await heartbeat.stop();
        return;
      }
    }

    // Stage 1: Discovery
    if (stage === "discovery" || stage === "all") {
      if (!values.year) {
        console.error("Error: --year is required for discovery stage");
        await heartbeat.stop();
        process.exitCode = 1;
        return;
      }

      const year = parseInt(values.year, 10);
      if (Number.isNaN(year) || year < 2000 || year > 2100) {
        console.error("Error: Invalid year");
        await heartbeat.stop();
        process.exitCode = 1;
        return;
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

      const maxBatchSize = 500;
      let remaining = limit ?? Infinity;
      let aggregate = {
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        errors: [] as Array<{ fileName: string; error: string }>,
      };

      while (remaining > 0) {
        const batchSize = Number.isFinite(remaining)
          ? Math.min(maxBatchSize, remaining)
          : maxBatchSize;

        // Clean up stale locks before each batch
        await cleanupStaleLocks();

        const filingResult = await processFilings({
          batchSize,
          dryRun,
        });

        aggregate.processed += filingResult.processed;
        aggregate.completed += filingResult.completed;
        aggregate.failed += filingResult.failed;
        aggregate.skipped += filingResult.skipped;
        aggregate.errors.push(
          ...filingResult.errors.map((err) => ({
            fileName: err.fileName,
            error: err.error,
          })),
        );

        if (filingResult.processed === 0) {
          break;
        }

        if (Number.isFinite(remaining)) {
          remaining -= filingResult.processed;
        }
      }

      console.log(`Processed:  ${aggregate.processed}`);
      console.log(`Completed:  ${aggregate.completed}`);
      console.log(`Failed:     ${aggregate.failed}`);
      console.log(`Skipped:    ${aggregate.skipped}`);
      if (aggregate.errors.length > 0) {
        console.log(`Errors:     ${aggregate.errors.length}`);
        for (const err of aggregate.errors.slice(0, 5)) {
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
    await heartbeat.stop();
    return;
  } catch (error) {
    console.error("Backfill failed:", error);
    await heartbeat.stop();
    process.exitCode = 1;
    return;
  }
}

main();
