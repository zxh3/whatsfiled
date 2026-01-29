// Register processors before exporting tasks

import { Form4Processor } from "../processors/form4.js";
import { registerProcessor } from "../processors/index.js";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

// Register the Form 4 processor
registerProcessor(new Form4Processor(SEC_USER_AGENT));

// Export tasks
export type { BackfillPayload, BackfillResult } from "./backfill.js";
export { backfillTask } from "./backfill.js";
export { dailySyncSchedule } from "./daily-sync.js";
export type {
  ProcessFilingPayload,
  ProcessFilingResult,
} from "./filing-processing.js";
export { processFilingTask } from "./filing-processing.js";
export type { ProcessDayPayload, ProcessDayResult } from "./process-day.js";
export { processDayTask } from "./process-day.js";
