import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  // You'll get this from cloud.trigger.dev when you create a project
  project: "proj_lmvyumxdfgbwigntdpxa",
  runtime: "node",
  logLevel: "log",
  // Max runtime for tasks (in seconds)
  maxDuration: 300, // 5 minutes
  // Default retry settings
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
  // Where your task files live
  dirs: ["src/tasks"],
});
