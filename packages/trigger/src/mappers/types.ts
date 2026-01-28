/**
 * Options for mapping a Form 4 document to database entities.
 */
export interface Form4ToDbOptions {
  /** The raw filing content (for storing in filings.raw_content) */
  rawContent?: string;
  /** The document URL */
  documentUrl?: string;
  /** The actual SEC filing date (from acceptance datetime or daily index) */
  filedAt?: Date;
}

/**
 * Result from mapping a Form 4 document to database entities.
 */
export interface Form4ToDbResult {
  /** The database ID of the created filing */
  filingId: string;
  /** The database ID of the company (issuer) */
  companyId: string;
  /** The database IDs of the insiders (reporting owners) */
  insiderIds: string[];
  /** Whether the filing already existed (skipped creating related records) */
  skipped?: boolean;
}
