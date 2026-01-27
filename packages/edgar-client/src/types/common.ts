/**
 * Common utility types shared across all form parsers.
 */

/**
 * Retry configuration for HTTP requests.
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryStatusCodes?: number[];
}

/**
 * A discriminated union for operations that can fail with typed errors.
 * Provides better error context than returning null.
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Logger interface for the EdgarClient.
 * All methods are optional and default to console methods.
 */
export interface Logger {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  info?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Value that may have associated footnote references.
 * Common across SEC forms that support footnotes.
 */
export interface ValueWithFootnotes<T> {
  value: T;
  footnoteIds: string[];
}
