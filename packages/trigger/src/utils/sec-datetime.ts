/**
 * Parse a filing date string from daily index format to a Date object.
 *
 * @param dateFiled - Date string in YYYYMMDD format
 * @returns Date object set to noon UTC (to avoid timezone boundary issues)
 *
 * @example
 * ```typescript
 * parseFilingDate("20260127")
 * // Returns: Date for 2026-01-27 12:00:00 UTC
 * ```
 */
export function parseFilingDate(dateFiled: string): Date {
  // Format: YYYYMMDD -> Date
  // Use noon UTC to avoid timezone boundary issues when displaying dates
  const year = parseInt(dateFiled.substring(0, 4), 10);
  const month = parseInt(dateFiled.substring(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(dateFiled.substring(6, 8), 10);
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

/**
 * Parse SEC acceptance datetime from filing content.
 * SEC acceptance datetime is in Eastern Time (ET) and needs conversion to UTC.
 *
 * @param content - Raw filing content
 * @returns Date object in UTC, or null if not found or invalid
 *
 * @example
 * ```typescript
 * const content = "...ACCEPTANCE-DATETIME>20260127143052...";
 * parseAcceptanceDateTime(content)
 * // Returns: Date for 2026-01-27 14:30:52 ET converted to UTC
 * ```
 */
export function parseAcceptanceDateTime(content: string): Date | null {
  const match = content.match(/ACCEPTANCE-DATETIME[:>]\s*(\d{14})/);
  if (!match) return null;

  const value = match[1];
  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(4, 6), 10);
  const day = Number.parseInt(value.slice(6, 8), 10);
  const hour = Number.parseInt(value.slice(8, 10), 10);
  const minute = Number.parseInt(value.slice(10, 12), 10);
  const second = Number.parseInt(value.slice(12, 14), 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    return null;
  }

  return zonedTimeToUtcDate(
    { year, month, day, hour, minute, second },
    "America/New_York",
  );
}

/**
 * Convert a zoned time to UTC Date.
 *
 * @param time - Object with year, month (1-12), day, hour, minute, second
 * @param timeZone - IANA timezone identifier
 * @returns Date object in UTC
 */
function zonedTimeToUtcDate(
  time: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
): Date {
  const utcGuess = new Date(
    Date.UTC(
      time.year,
      time.month - 1,
      time.day,
      time.hour,
      time.minute,
      time.second,
    ),
  );
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

/**
 * Get timezone offset in minutes for a given date and timezone.
 *
 * @param date - Date to check offset for
 * @param timeZone - IANA timezone identifier
 * @returns Offset in minutes (positive = ahead of UTC, negative = behind)
 */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number.parseInt(values.year, 10),
    Number.parseInt(values.month, 10) - 1,
    Number.parseInt(values.day, 10),
    Number.parseInt(values.hour, 10),
    Number.parseInt(values.minute, 10),
    Number.parseInt(values.second, 10),
  );

  return (asUtc - date.getTime()) / 60_000;
}
