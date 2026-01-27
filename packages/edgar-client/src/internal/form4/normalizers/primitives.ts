/**
 * Primitive value normalization functions.
 * These handle conversion of raw XML values to normalized TypeScript types.
 */

/**
 * Normalize a value to boolean.
 * Handles various formats used in SEC Form 4 XML:
 * - Number: 1 = true, 0 = false
 * - String: "1", "true", "yes" = true; "0", "false", "no" = false
 * - Boolean: passthrough
 *
 * @param value - The raw value to normalize
 * @param defaultValue - Default when value is undefined/null/empty
 */
export function normalizeBoolean(
  value: string | number | boolean | undefined | null,
  defaultValue = false,
): boolean {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  // Number format (X0306)
  if (typeof value === "number") {
    return value === 1;
  }

  // Already boolean
  if (typeof value === "boolean") {
    return value;
  }

  // String format
  const str = String(value).toLowerCase().trim();
  if (str === "1" || str === "true" || str === "yes") {
    return true;
  }
  if (str === "0" || str === "false" || str === "no" || str === "") {
    return false;
  }

  return defaultValue;
}

/**
 * Normalize a value to string or null.
 *
 * @param value - The raw value to normalize
 * @returns Trimmed string or null if empty
 */
export function normalizeStringValue(
  value: string | number | undefined,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value).trim();
}

/**
 * Normalize a value to a required string (never null).
 *
 * @param value - The raw value to normalize
 * @returns Trimmed string or empty string if null
 */
export function normalizeRequiredStringValue(
  value: string | number | undefined,
): string {
  const result = normalizeStringValue(value);
  if (result === null) {
    return "";
  }
  return result;
}

/**
 * Normalize a value to number or null.
 * Handles comma-formatted numbers (e.g., "1,234.56").
 *
 * @param value - The raw value to normalize
 * @returns Parsed number or null if invalid
 */
export function normalizeNumberValue(
  value: string | number | undefined,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

/**
 * Normalize a date value to string or null.
 * Dates in SEC filings are typically YYYY-MM-DD format.
 *
 * @param value - The raw value to normalize
 * @returns Date string or null if empty
 */
export function normalizeDateValue(
  value: string | number | undefined,
): string | null {
  const str = normalizeStringValue(value);
  if (!str) return null;
  return str;
}

/**
 * Normalize acquired/disposed code to "A" | "D" | null.
 *
 * @param value - The raw value to normalize
 * @returns "A" for acquired, "D" for disposed, or null
 */
export function normalizeAcquiredDisposedCode(
  value: string | number | undefined,
): "A" | "D" | null {
  const str = normalizeStringValue(value);
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
  const str = normalizeStringValue(value);
  if (str === "D") {
    return true;
  }
  if (str === "I") {
    return false;
  }
  return null;
}
