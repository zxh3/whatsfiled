import { EdgarFetchError } from "./errors";
import {
  buildArchiveFileUrl,
  buildDailyIndexUrl,
  buildQuarterCatalogUrl,
  extractDailyIndexFileNames,
  parseDailyIndex,
  parseDailyIndexFileName,
} from "./internal/daily-index";
import { parseForm4, getDocumentType, getSchemaVersion } from "./internal/form4/parser";
import { buildForm4SourceInfo, getForm4XmlUrls } from "./internal/form4/urls";
import { fetchWithBackoff, sleep } from "./internal/http";
import type {
  DailyIndexResult,
  DailyIndexRow,
  Form4Document,
  Form4ParseOptions,
  Form4SourceInfo,
  Form4XmlUrls,
  RetryOptions,
} from "./types";

export interface EdgarClientOptions {
  /** User-Agent header for SEC requests (required by SEC) */
  userAgent?: string;
  /** Retry options for HTTP requests */
  retryOptions?: RetryOptions;
}

const DEFAULT_USER_AGENT = "WhatsFiled whatsfiled@gmail.com";

/**
 * SEC EDGAR API client for fetching and parsing filings.
 *
 * @example
 * ```typescript
 * const client = new EdgarClient();
 *
 * // Get daily index files for 2026
 * const fileNames = await client.getDailyIndexFileNames(2026);
 *
 * // Fetch and parse a daily index
 * const index = await client.fetchDailyIndex(fileNames[0]);
 * const rows = client.parseDailyIndex(index.content, { formTypes: ['4', '4/A'] });
 *
 * // Fetch and parse a Form 4
 * const content = await client.fetchFiling(rows[0].fileName);
 * const doc = client.parseForm4(content);
 * console.log(doc.issuer.name, doc.reportingOwners[0].id.name);
 * ```
 */
export class EdgarClient {
  private readonly userAgent: string;
  private readonly retryOptions: RetryOptions;

  constructor(options: EdgarClientOptions = {}) {
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.retryOptions = {
      maxRetries: 10,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      ...options.retryOptions,
    };
  }

  // ============================================================
  // HTTP FETCHING
  // ============================================================

  /**
   * Fetch content from a URL with retry and backoff
   */
  private async fetch(url: string): Promise<string> {
    const response = await fetchWithBackoff(
      url,
      {
        headers: {
          "User-Agent": this.userAgent,
          "Accept-Encoding": "gzip, deflate",
        },
      },
      this.retryOptions,
    );

    if (!response.ok) {
      throw new EdgarFetchError(
        `Failed to fetch ${url}: ${response.statusText}`,
        url,
        response.status,
      );
    }

    return response.text();
  }

  // ============================================================
  // DAILY INDEX METHODS
  // ============================================================

  /**
   * Get daily index file names for a given year.
   * Returns fileNames like "form.20260102.idx".
   *
   * @param year - The year to get index files for
   * @returns Array of index file names
   */
  async getDailyIndexFileNames(year: number): Promise<string[]> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil(now.getMonth() / 3) + 1;

    if (year > currentYear) {
      return [];
    }

    const fileNames: string[] = [];
    const maxQuarter = year === currentYear ? currentQuarter : 4;

    for (let quarter = 1; quarter <= maxQuarter; quarter++) {
      const url = buildQuarterCatalogUrl(year, quarter);
      const html = await this.fetch(url);
      const names = extractDailyIndexFileNames(html);
      fileNames.push(...names);
      await sleep(300); // Rate limiting between quarters
    }

    return fileNames;
  }

  /**
   * Fetch a daily index file.
   *
   * @param fileName - Index file name (e.g., "form.20260102.idx")
   * @returns Object with url, content, and dateTimestamp
   */
  async fetchDailyIndex(fileName: string): Promise<DailyIndexResult> {
    const url = buildDailyIndexUrl(fileName);
    const content = await this.fetch(url);
    const { dateTimestamp } = parseDailyIndexFileName(fileName);
    return { url, content, dateTimestamp };
  }

  /**
   * Parse daily index content into rows.
   *
   * @param content - Raw content from fetchDailyIndex
   * @param options - Parse options (formTypes to filter by)
   * @returns Array of DailyIndexRow objects
   */
  parseDailyIndex(
    content: string,
    options?: { formTypes?: readonly string[] },
  ): DailyIndexRow[] {
    return parseDailyIndex(content, options);
  }

  // ============================================================
  // FILING METHODS
  // ============================================================

  /**
   * Fetch filing content from EDGAR archives.
   *
   * @param fileName - EDGAR file path (e.g., "edgar/data/123/000123-24-001.txt")
   * @returns Raw filing content
   */
  async fetchFiling(fileName: string): Promise<string> {
    const url = buildArchiveFileUrl(fileName);
    return this.fetch(url);
  }

  // ============================================================
  // FORM 4 METHODS
  // ============================================================

  /**
   * Parse Form 4 or Form 4/A content into a structured document.
   *
   * @param content - Raw content from fetchFiling
   * @param options - Parse options
   * @returns Normalized Form4Document
   * @throws {Form4ParseError} If parsing fails
   * @throws {UnsupportedSchemaVersionError} If schema version is not supported
   * @throws {ValidationError} If validation fails
   */
  parseForm4(content: string, options?: Form4ParseOptions): Form4Document {
    return parseForm4(content, options);
  }

  /**
   * Build source info for a Form 4 document.
   * Use this to populate the _source field with URLs to the original filing.
   *
   * @param fileName - EDGAR file path
   * @param content - Raw filing content
   * @returns Form4SourceInfo object, or null if cannot be built
   */
  getForm4SourceInfo(
    fileName: string,
    content: string,
  ): Form4SourceInfo | null {
    return buildForm4SourceInfo(fileName, content);
  }

  /**
   * Get Form 4 XML URLs without full parsing.
   *
   * @param fileName - EDGAR file path
   * @param content - Raw filing content
   * @returns URLs object, or null if not found
   */
  getForm4XmlUrls(fileName: string, content: string): Form4XmlUrls | null {
    return getForm4XmlUrls(fileName, content);
  }

  /**
   * Get schema version from Form 4 content without full parsing.
   * Useful for filtering/routing.
   *
   * @param content - Raw filing content
   * @returns Schema version string, or null if not found
   */
  getForm4SchemaVersion(content: string): string | null {
    return getSchemaVersion(content);
  }

  /**
   * Get document type from Form 4 content without full parsing.
   * Useful for filtering/routing.
   *
   * @param content - Raw filing content
   * @returns "4" or "4/A", or null if not found
   */
  getForm4DocumentType(content: string): "4" | "4/A" | null {
    return getDocumentType(content);
  }
}
