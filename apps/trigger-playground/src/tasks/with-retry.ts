/**
 * LESSON 3: Retries and Error Handling
 *
 * Trigger.dev automatically retries failed tasks.
 * You can customize retry behavior per-task.
 */

import { task } from "@trigger.dev/sdk/v3";

// Simulates a flaky API call that sometimes fails
async function flakyApiCall(): Promise<string> {
  // 50% chance of failure
  if (Math.random() < 0.5) {
    throw new Error("API temporarily unavailable");
  }
  return "Success!";
}

export const flakyTask = task({
  id: "flaky-api-task",

  // Override retry settings for this specific task
  retry: {
    maxAttempts: 5, // Try up to 5 times
    minTimeoutInMs: 1000, // Start with 1 second delay
    maxTimeoutInMs: 30000, // Max 30 second delay
    factor: 2, // Double the delay each retry
    randomize: true, // Add some randomness to prevent thundering herd
  },

  run: async () => {
    console.log("Attempting flaky API call...");

    // This might throw an error, but Trigger.dev will retry automatically
    const result = await flakyApiCall();

    console.log("API call succeeded:", result);
    return { result };
  },
});

/**
 * What happens when this task runs:
 *
 * Attempt 1: Fails → waits ~1s
 * Attempt 2: Fails → waits ~2s
 * Attempt 3: Fails → waits ~4s
 * Attempt 4: Fails → waits ~8s
 * Attempt 5: Either succeeds or permanently fails
 *
 * The exponential backoff (factor: 2) gives external services
 * time to recover from temporary issues.
 */
