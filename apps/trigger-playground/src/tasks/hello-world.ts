/**
 * LESSON 1: Hello World Task
 *
 * This is the simplest possible Trigger.dev task.
 * A task is just a function that runs in the cloud.
 */

import { task } from "@trigger.dev/sdk/v3";

// Define a task with a unique ID
export const helloWorldTask = task({
  // Every task needs a unique ID
  id: "hello-world",

  // The run function contains your task logic
  run: async () => {
    console.log("Hello from Trigger.dev!");

    // Whatever you return is stored as the task output
    return {
      message: "Hello, World!",
      timestamp: new Date().toISOString(),
    };
  },
});
