/**
 * LESSON 2: Task with Payload (Input)
 *
 * Tasks can accept input data called "payload".
 * This is how you pass data to your tasks.
 */

import { task } from "@trigger.dev/sdk/v3";

// Define the shape of your payload with TypeScript
type GreetPayload = {
  name: string;
  greeting?: string; // optional field
};

export const greetTask = task({
  id: "greet-user",

  // The payload is passed as the first argument to run()
  run: async (payload: GreetPayload) => {
    const greeting = payload.greeting ?? "Hello";

    console.log(`${greeting}, ${payload.name}!`);

    return {
      message: `${greeting}, ${payload.name}!`,
      receivedAt: new Date().toISOString(),
    };
  },
});

/**
 * How to trigger this task:
 *
 * From the Trigger.dev dashboard "Test" tab:
 * {
 *   "name": "Alice",
 *   "greeting": "Welcome"
 * }
 *
 * From code:
 * await greetTask.trigger({ name: "Alice", greeting: "Welcome" });
 */
