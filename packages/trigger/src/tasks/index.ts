// Register processors before exporting tasks

import { Form4Processor } from "../processors/form4.js";
import { registerProcessor } from "../processors/index.js";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

// Register the Form 4 processor
registerProcessor(new Form4Processor(SEC_USER_AGENT));

export type { BackfillPayload, BackfillResult } from "./backfill.js";
export { backfillTask } from "./backfill.js";
export { dailySyncSchedule } from "./daily-sync.js";
export type {
  DiscoverIndexFilesPayload,
  DiscoverIndexFilesResult,
} from "./discovery.js";
// Export all tasks
export { discoverIndexFilesTask } from "./discovery.js";
export type {
  ProcessFilingPayload,
  ProcessFilingResult,
} from "./filing-processing.js";
export { processFilingTask } from "./filing-processing.js";
export type {
  ProcessIndexFilePayload,
  ProcessIndexFileResult,
} from "./index-processing.js";
export { processIndexFileTask } from "./index-processing.js";
export type {
  ProcessPendingFilingsPayload,
  ProcessPendingFilingsResult,
  ProcessPendingIndexesPayload,
  ProcessPendingIndexesResult,
} from "./process-pending.js";
export {
  processPendingFilingsTask,
  processPendingIndexesTask,
} from "./process-pending.js";
