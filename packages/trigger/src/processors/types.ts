import type { Database } from "@whatsfiled/db";

/**
 * Context provided to processors when processing a filing.
 */
export interface ProcessorContext {
  /** Raw filing content from SEC EDGAR */
  content: string;
  /** EDGAR file path (e.g., "edgar/data/123/0001234567-24-000001.txt") */
  fileName: string;
  /** Metadata from the daily index entry */
  indexMetadata: {
    companyName: string;
    cik: string;
    /** Filing date in YYYYMMDD format */
    dateFiled: string;
    /** Form type (e.g., "4", "4/A") */
    formType: string;
  };
}

/**
 * Result returned from a processor after processing a filing.
 */
export interface ProcessorResult {
  /** Whether processing succeeded */
  success: boolean;
  /** The database ID of the created filing (if successful) */
  filingId?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether this filing was skipped (already exists) */
  skipped?: boolean;
}

/**
 * Interface for form-specific filing processors.
 *
 * Processors are responsible for:
 * 1. Parsing the raw filing content using the appropriate parser
 * 2. Mapping the parsed data to database entities
 * 3. Persisting to the database within a transaction
 *
 * @example
 * ```typescript
 * class Form4Processor implements FilingProcessor {
 *   formTypes = ["4", "4/A"] as const;
 *
 *   async process(ctx: ProcessorContext, db: Database): Promise<ProcessorResult> {
 *     const doc = edgarClient.parseForm4(ctx.content, { fileName: ctx.fileName });
 *     const result = await mapForm4ToDb(db, doc, { rawContent: ctx.content });
 *     return { success: true, filingId: result.filingId };
 *   }
 * }
 * ```
 */
export interface FilingProcessor {
  /** Form types this processor handles (e.g., ["4", "4/A"]) */
  readonly formTypes: readonly string[];

  /**
   * Process a filing and persist to database.
   *
   * @param ctx - Processing context with content and metadata
   * @param db - Database connection (may be within a transaction)
   * @returns Processing result
   */
  process(ctx: ProcessorContext, db: Database): Promise<ProcessorResult>;
}
