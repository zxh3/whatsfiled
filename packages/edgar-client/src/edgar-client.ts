import { EdgarFetchError } from "./errors";
import {
  buildArchiveFileUrl,
  buildDailyIndexUrl,
  buildQuarterCatalogUrl,
  extractDailyIndexFileNames,
  parseDailyIndex,
  parseDailyIndexFileName,
} from "./internal/daily-index";
import {
  getDocumentType as getDocumentTypeInternal,
  getSchemaVersion as getSchemaVersionInternal,
  isSchemaVersionSupported,
  parseForm4 as parseForm4Internal,
} from "./internal/form4/parser";
import {
  buildForm4SourceInfo,
  extractXmlFilenameFromContent,
  getFilingBaseUrl,
} from "./internal/form4/urls";
import { fetchWithBackoff, sleep } from "./internal/http";
import { FORM_TYPES } from "./constants";
import type {
  DailyIndexResult,
  DailyIndexRow,
  DocumentType,
  Form4Document,
  Form4ParseOptions,
  Form4SourceInfo,
  FormType,
  Logger,
  Result,
  RetryOptions,
  SchemaVersion,
} from "./types";

export interface EdgarClientOptions {
  /** User-Agent header for SEC requests (required by SEC) */
  userAgent: string;
  /** Retry options for HTTP requests */
  retryOptions?: RetryOptions;
  /** Delay between rate-limited requests in milliseconds (default: 300) */
  rateLimitDelayMs?: number;
  /** Logger for warnings and debug info (default: console) */
  logger?: Logger;
}

/**
 * SEC EDGAR API client for fetching and parsing filings.
 *
 * @example
 * ```typescript
 * const client = new EdgarClient({
 *   userAgent: "MyApp contact@example.com",
 * });
 *
 * // Get daily index files for 2026
 * const fileNames = await client.getDailyIndexFileNames(2026);
 *
 * // Fetch and parse a daily index
 * const index = await client.fetchDailyIndex(fileNames[0]);
 * const rows = client.parseDailyIndex(index.content, { formTypes: ['4', '4/A'] });
 *
 * // Fetch and parse a Form 4 with source info auto-populated
 * const content = await client.fetchFiling(rows[0].fileName);
 * const doc = client.parseForm4(content, { fileName: rows[0].fileName });
 * console.log(doc.issuer.name, doc.reportingOwners[0].id.name);
 * console.log(doc.source?.formattedXmlUrl);
 * ```
 */
export class EdgarClient {
  private readonly userAgent: string;
  private readonly retryOptions: RetryOptions;
  private readonly rateLimitDelayMs: number;
  private readonly logger: Logger;

  constructor(options: EdgarClientOptions) {
    this.userAgent = options.userAgent;
    this.retryOptions = {
      maxRetries: 10,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      ...options.retryOptions,
    };
    this.rateLimitDelayMs = options.rateLimitDelayMs ?? 300;
    this.logger = options.logger ?? {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
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
      await sleep(this.rateLimitDelayMs);
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
   * If fileName is provided, the source field will be auto-populated with URLs.
   *
   * @param content - Raw content from fetchFiling
   * @param options - Parse options (including optional fileName for source info)
   * @returns Normalized Form4Document
   * @throws {Form4ParseError} If parsing fails
   * @throws {UnsupportedSchemaVersionError} If schema version is not supported
   * @throws {ValidationError} If validation fails
   */
  parseForm4(content: string, options?: Form4ParseOptions): Form4Document {
    const doc = parseForm4Internal(content, {
      logger: this.logger,
      ...options,
    });

    // Auto-populate source info if fileName is provided
    if (options?.fileName) {
      const sourceInfo = buildForm4SourceInfo(options.fileName, content);
      if (sourceInfo) {
        doc.source = sourceInfo;
      }
    }

    return doc;
  }

  // ============================================================
  // RESULT-RETURNING METHODS
  // ============================================================

  /**
   * Get schema version from Form 4 content without full parsing.
   * Useful for filtering/routing before parsing.
   *
   * @param content - Raw filing content
   * @returns Result with SchemaVersion or error type
   */
  getSchemaVersion(
    content: string,
  ): Result<SchemaVersion, "not_found" | "unsupported_version"> {
    const version = getSchemaVersionInternal(content);

    if (version === null) {
      return { ok: false, error: "not_found" };
    }

    if (!isSchemaVersionSupported(version)) {
      return { ok: false, error: "unsupported_version" };
    }

    return { ok: true, value: version as SchemaVersion };
  }

  /**
   * Get document type from Form 4 content without full parsing.
   * Useful for filtering/routing before parsing.
   *
   * @param content - Raw filing content
   * @returns Result with DocumentType ("4" or "4/A") or error type
   */
  getDocumentType(
    content: string,
  ): Result<DocumentType, "not_found" | "invalid_type"> {
    const docType = getDocumentTypeInternal(content);

    if (docType === null) {
      return { ok: false, error: "not_found" };
    }

    return { ok: true, value: docType };
  }

  /**
   * Get Form 4 source info (URLs to original filing) without full parsing.
   *
   * @param fileName - EDGAR file path
   * @param content - Raw filing content
   * @returns Result with Form4SourceInfo or error type
   */
  getSourceInfo(
    fileName: string,
    content: string,
  ): Result<Form4SourceInfo, "invalid_filename" | "xml_not_found"> {
    const baseUrlInfo = getFilingBaseUrl(fileName);
    if (!baseUrlInfo) {
      return { ok: false, error: "invalid_filename" };
    }

    const xmlFileName = extractXmlFilenameFromContent(content);
    if (!xmlFileName) {
      return { ok: false, error: "xml_not_found" };
    }

    return {
      ok: true,
      value: {
        fileName,
        xmlFileName,
        rawXmlUrl: `${baseUrlInfo.baseUrl}/${xmlFileName}`,
        formattedXmlUrl: `${baseUrlInfo.baseUrl}/xslF345X03/${xmlFileName}`,
      },
    };
  }

  // ============================================================
  // FORM TYPE DETECTION
  // ============================================================

  /**
   * Detect form type from content without full parsing.
   * Useful for routing to the correct parser.
   *
   * @param content - Raw filing content
   * @returns Result with FormType or "not_found" error
   */
  detectFormType(content: string): Result<FormType, "not_found"> {
    const match = content.match(/<documentType>([^<]+)<\/documentType>/);
    if (!match) {
      return { ok: false, error: "not_found" };
    }

    const docType = match[1].trim();
    if ((FORM_TYPES as readonly string[]).includes(docType)) {
      return { ok: true, value: docType as FormType };
    }

    return { ok: false, error: "not_found" };
  }

  // ============================================================
  // FORM 4 METHOD ALIASES
  // ============================================================

  /**
   * Alias for getSchemaVersion - explicitly named for Form 4.
   * @see getSchemaVersion
   */
  getForm4SchemaVersion(
    content: string,
  ): Result<SchemaVersion, "not_found" | "unsupported_version"> {
    return this.getSchemaVersion(content);
  }

  /**
   * Alias for getDocumentType - explicitly named for Form 4.
   * @see getDocumentType
   */
  getForm4DocumentType(
    content: string,
  ): Result<DocumentType, "not_found" | "invalid_type"> {
    return this.getDocumentType(content);
  }

  /**
   * Alias for getSourceInfo - explicitly named for Form 4.
   * @see getSourceInfo
   */
  getForm4SourceInfo(
    fileName: string,
    content: string,
  ): Result<Form4SourceInfo, "invalid_filename" | "xml_not_found"> {
    return this.getSourceInfo(fileName, content);
  }
}
