import { EdgarClient } from "@whatsfiled/edgar-client";
import { env } from "../env.js";

/**
 * Configured EdgarClient instance for the backend.
 * Uses EDGAR_USER_AGENT from environment variables.
 */
export const edgarClient = new EdgarClient({
  userAgent: env.EDGAR_USER_AGENT,
  rateLimitDelayMs: 300, // SEC rate limit compliance
  retryOptions: {
    maxRetries: 10,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
  },
  logger: {
    debug: (...args: unknown[]) => console.debug("[edgar]", ...args),
    info: (...args: unknown[]) => console.info("[edgar]", ...args),
    warn: (...args: unknown[]) => console.warn("[edgar]", ...args),
    error: (...args: unknown[]) => console.error("[edgar]", ...args),
  },
});

/**
 * Sleep utility for rate limiting between requests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limit delay in milliseconds.
 * SEC requires 10 requests per second max, so 100ms minimum.
 * We use 300ms for safety.
 */
export const RATE_LIMIT_DELAY_MS = 300;
