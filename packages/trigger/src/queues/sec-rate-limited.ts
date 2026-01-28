import type { Queue } from "@trigger.dev/core/v3";
import { queue } from "@trigger.dev/sdk/v3";

/**
 * SEC rate-limited queue for EDGAR requests.
 *
 * SEC EDGAR allows up to 10 requests/second, but we use conservative
 * concurrency of 3 to stay well within limits and handle retries gracefully.
 */
export const secRateLimitedQueue: Queue = queue({
  name: "sec-rate-limited",
  concurrencyLimit: 3,
});
