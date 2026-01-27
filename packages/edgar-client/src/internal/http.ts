import type { RetryOptions } from "../types/common.js";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_OPTIONS = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 32000,
};

function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = Math.random() * cappedDelay * 0.1;
  return cappedDelay + jitter;
}

function defaultShouldRetry(_error: unknown, response?: Response): boolean {
  if (!response) return true; // Network error, retry
  const status = response.status;
  return status === 429 || (status >= 500 && status < 600);
}

export async function fetchWithBackoff(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok || !defaultShouldRetry(null, response)) {
        return response;
      }

      lastResponse = response;

      if (attempt < config.maxRetries) {
        const retryAfter = response.headers.get("Retry-After");
        let delay: number;

        if (retryAfter) {
          const retryAfterSeconds = Number.parseInt(retryAfter, 10);
          delay = Number.isNaN(retryAfterSeconds)
            ? calculateBackoff(attempt, config.baseDelayMs, config.maxDelayMs)
            : retryAfterSeconds * 1000;
        } else {
          delay = calculateBackoff(
            attempt,
            config.baseDelayMs,
            config.maxDelayMs,
          );
        }

        await sleep(delay);
      }
    } catch (error) {
      // Network errors - retry if possible, otherwise rethrow
      if (error instanceof TypeError && attempt < config.maxRetries) {
        const delay = calculateBackoff(
          attempt,
          config.baseDelayMs,
          config.maxDelayMs,
        );
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  return lastResponse!;
}
