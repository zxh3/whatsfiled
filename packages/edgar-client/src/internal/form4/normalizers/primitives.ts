/**
 * Primitive value normalization functions for Form 4.
 * Re-exports shared primitives and adds Form 4-specific functions.
 */

import { normalizeStringValue as normalizeString } from "../../shared/primitives.js";

// Re-export shared primitives
export {
  normalizeBoolean,
  normalizeDateValue,
  normalizeNumberValue,
  normalizeRequiredStringValue,
  normalizeStringValue,
} from "../../shared/primitives.js";

/**
 * Normalize acquired/disposed code to "A" | "D" | null.
 *
 * @param value - The raw value to normalize
 * @returns "A" for acquired, "D" for disposed, or null
 */
export function normalizeAcquiredDisposedCode(
  value: string | number | undefined,
): "A" | "D" | null {
  const str = normalizeString(value);
  if (str === "A" || str === "D") {
    return str;
  }
  return null;
}

/**
 * Normalize direct/indirect ownership code to boolean | null.
 *
 * @param value - The raw value to normalize
 * @returns true for direct ("D"), false for indirect ("I"), or null
 */
export function normalizeIsDirect(
  value: string | number | undefined,
): boolean | null {
  const str = normalizeString(value);
  if (str === "D") {
    return true;
  }
  if (str === "I") {
    return false;
  }
  return null;
}
