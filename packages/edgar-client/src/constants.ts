/**
 * Runtime constants for the edgar-client package.
 */

/**
 * Known SEC form types that can be parsed.
 */
export const FORM_TYPES = [
  // Insider ownership (Forms 3, 4, 5)
  "3",
  "3/A",
  "4",
  "4/A",
  "5",
  "5/A",

  // Beneficial ownership schedules
  "SCHEDULE 13D",
  "SCHEDULE 13D/A",
  "SCHEDULE 13G",
  "SCHEDULE 13G/A",
  "SC 13D",
  "SC 13D/A",
  "SC 13G",
  "SC 13G/A",

  // Periodic reports
  "10-K",
  "10-Q",
  "8-K",

  // Institutional holdings
  "13F-HR",
  "13F-HR/A",

  // Proxy statements
  "DEF 14A",
  "DEFA14A",
] as const;

/**
 * Supported Form 4 XML schema versions.
 */
export const FORM4_SCHEMA_VERSIONS = ["X0306", "X0407", "X0508"] as const;
