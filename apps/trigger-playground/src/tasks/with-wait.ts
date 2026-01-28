/**
 * LESSON 6: Waits and Long-Running Tasks
 *
 * Trigger.dev tasks can pause and resume, allowing for:
 * - Long delays without paying for compute time
 * - Waiting for external events
 * - Multi-step workflows over days/weeks
 */

import { task, wait } from "@trigger.dev/sdk/v3";

export const reminderTask = task({
  id: "send-reminder",

  run: async (payload: { userId: string; message: string }) => {
    console.log(`Scheduling reminder for user ${payload.userId}`);

    // Step 1: Send initial notification
    console.log("Sending: Your task is starting!");

    // Step 2: Wait for 1 minute (task checkpoints and pauses)
    // This does NOT use compute time during the wait!
    await wait.for({ minutes: 1 });

    // Step 3: Send reminder after wait
    console.log(`Sending reminder: ${payload.message}`);

    return {
      userId: payload.userId,
      reminderSent: true,
      sentAt: new Date().toISOString(),
    };
  },
});

// More complex workflow with multiple waits
export const onboardingWorkflowTask = task({
  id: "onboarding-workflow",

  run: async (payload: { email: string }) => {
    console.log(`Starting onboarding for ${payload.email}`);

    // Day 0: Send welcome email
    console.log("Sending welcome email...");

    // Wait 1 day
    await wait.for({ days: 1 });

    // Day 1: Send tips email
    console.log("Sending tips email...");

    // Wait 3 more days
    await wait.for({ days: 3 });

    // Day 4: Send check-in email
    console.log("Sending check-in email...");

    return {
      email: payload.email,
      completedAt: new Date().toISOString(),
      emailsSent: ["welcome", "tips", "check-in"],
    };
  },
});

/**
 * Wait types available:
 *
 * - wait.for({ seconds, minutes, hours, days })
 * - wait.until({ date: new Date("2024-12-25") })
 * - wait.forToken({ token: "external-webhook", timeout: 3600 })
 *
 * Key benefits:
 * - Waits > 5 seconds are "checkpointed" - no compute charges
 * - Task state is preserved across waits
 * - Can wait for weeks/months without issues
 *
 * Important: Never wrap wait calls in Promise.all!
 */
