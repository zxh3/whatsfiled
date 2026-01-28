import { type Database, filings } from "@whatsfiled/db";
import { EdgarClient } from "@whatsfiled/edgar-client";
import { eq } from "drizzle-orm";
import { mapForm4ToDb } from "../mappers/form4.js";
import {
  extractAccessionNumber,
  parseAcceptanceDateTime,
  parseFilingDate,
} from "../utils/index.js";
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
      // Check if filing already exists (by accession number)
      const accessionNumber = extractAccessionNumber(fileName);
      const existingFiling = await db
        .select({ id: filings.id })
        .from(filings)
        .where(eq(filings.accessionNumber, accessionNumber))
        .limit(1);

      if (existingFiling.length > 0) {
        return {
          success: true,
          skipped: true,
          filingId: existingFiling[0].id,
        };
      }

      // Parse the Form 4
      const doc = this.edgarClient.parseForm4(content, { fileName });

      // Prefer SEC acceptance datetime (ET) from submission header, fallback to index date
      const acceptanceDateTime = parseAcceptanceDateTime(content);
      const filedAt =
        acceptanceDateTime ?? parseFilingDate(indexMetadata.dateFiled);

      // Map to database within a transaction
      const result = await db.transaction(async (tx) => {
        return await mapForm4ToDb(tx as unknown as Database, doc, {
          rawContent: content,
          documentUrl: doc.source?.formattedXmlUrl,
          filedAt,
        });
      });

      return {
        success: true,
        filingId: result.filingId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
