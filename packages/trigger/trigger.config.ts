import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_tqvevnijvybdwlvcqfee",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["src/tasks"],
  // Register processors before any task runs
  init: async () => {
    const { Form4Processor } = await import("./src/processors/form4.js");
    const { registerProcessor, hasProcessor } = await import(
      "./src/processors/index.js"
    );

    const SEC_USER_AGENT =
      process.env.SEC_USER_AGENT ?? "WhatsFiled contact@whatsfiled.com";

    // Only register if not already registered (idempotent)
    if (!hasProcessor("4")) {
      registerProcessor(new Form4Processor(SEC_USER_AGENT));
    }
  },
});
