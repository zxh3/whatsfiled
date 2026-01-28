import type { Database } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { mapForm4ToDb } from "../mappers/form4.js";
import { parseAcceptanceDateTime, parseFilingDate } from "../utils/index.js";
import type {
  FilingProcessor,
  ProcessorContext,
  ProcessorResult,
} from "./types.js";

/**
 * Processor for Form 4 and Form 4/A filings.
 *
 * Handles parsing of Form 4 documents using EdgarClient and
 * mapping the parsed data to the database.
 *
 * Idempotent: duplicate filings are handled atomically via onConflictDoNothing
 * in the database layer, preventing race conditions between concurrent tasks.
 */
export class Form4Processor implements FilingProcessor {
  readonly formTypes = ["4", "4/A"] as const;

  private readonly edgarClient: EdgarClient;

  constructor(userAgent: string) {
    this.edgarClient = new EdgarClient({ userAgent });
  }

  async process(ctx: ProcessorContext, db: Database): Promise<ProcessorResult> {
    const { content, fileName, indexMetadata } = ctx;

    try {
      // Parse the Form 4
      const doc = this.edgarClient.parseForm4(content, { fileName });

      // Prefer SEC acceptance datetime (ET) from submission header, fallback to index date
      const acceptanceDateTime = parseAcceptanceDateTime(content);
      const filedAt =
        acceptanceDateTime ?? parseFilingDate(indexMetadata.dateFiled);

      // Map to database within a transaction
      // Idempotent: if filing already exists, returns skipped=true
      // Note: not storing rawContent to save DB space (can re-fetch from SEC via documentUrl)
      const result = await db.transaction(async (tx) => {
        return await mapForm4ToDb(tx as unknown as Database, doc, {
          documentUrl: doc.source?.formattedXmlUrl,
          filedAt,
        });
      });

      return {
        success: true,
        filingId: result.filingId,
        skipped: result.skipped,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
