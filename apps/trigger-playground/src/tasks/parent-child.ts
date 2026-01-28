/**
 * LESSON 4: Parent-Child Tasks
 *
 * Tasks can trigger other tasks. This is useful for:
 * - Breaking complex work into smaller pieces
 * - Running tasks in parallel
 * - Building pipelines
 */

import { task } from "@trigger.dev/sdk/v3";

// Child task: processes a single item
export const processItemTask = task({
  id: "process-item",

  run: async (payload: { itemId: number }) => {
    console.log(`Processing item ${payload.itemId}...`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      itemId: payload.itemId,
      processed: true,
      processedAt: new Date().toISOString(),
    };
  },
});

// Parent task: triggers multiple child tasks
export const batchProcessTask = task({
  id: "batch-process",

  run: async (payload: { itemIds: number[] }) => {
    console.log(`Processing ${payload.itemIds.length} items...`);

    // Option 1: Fire-and-forget (don't wait for results)
    // for (const itemId of payload.itemIds) {
    //   await processItemTask.trigger({ itemId });
    // }

    // Option 2: Wait for each result

    const results = await Promise.all(
      payload.itemIds.map(async (itemId) =>
        processItemTask.triggerAndWait({ itemId }),
      ),
    );

    return {
      totalItems: payload.itemIds.length,
      successfulItems: results.length,
      results,
    };
  },
});

/**
 * To test, trigger batch-process with:
 * {
 *   "itemIds": [1, 2, 3, 4, 5]
 * }
 *
 * Important notes:
 *
 * 1. triggerAndWait() returns a Result object: { ok, output, error }
 *    - Always check result.ok before accessing result.output
 *
 * 2. Never use Promise.all with triggerAndWait:
 *    BAD:  await Promise.all(items.map(item => task.triggerAndWait(item)))
 *    GOOD: for loop with sequential awaits (Trigger.dev manages parallelism)
 *
 * 3. Use batchTriggerAndWait for better performance:
 *    const results = await processItemTask.batchTriggerAndWait(
 *      itemIds.map(id => ({ payload: { itemId: id } }))
 *    );
 */
