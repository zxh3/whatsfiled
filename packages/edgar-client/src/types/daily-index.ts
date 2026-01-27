/**
 * Types for SEC EDGAR daily index files.
 */

import type { FORM_TYPES } from "../constants";

/**
 * Union type of known SEC form types.
 */
export type FormType = (typeof FORM_TYPES)[number];

/**
 * A single row from the SEC EDGAR daily index file.
 */
export interface DailyIndexRow {
  formType: string;
  companyName: string;
  cik: string;
  dateFiled: string; // YYYYMMDD
  fileName: string; // edgar/data/.../*.txt
}

/**
 * Result of fetching a daily index file.
 */
export interface DailyIndexResult {
  url: string;
  content: string;
  dateTimestamp: number;
}
