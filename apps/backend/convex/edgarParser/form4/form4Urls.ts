import type { Form4SourceInfo } from "./form4Types";

export interface Form4XmlUrls {
  rawXmlUrl: string;
  formattedXmlUrl: string;
}

/**
 * Parse filing base URL from an EDGAR fileName
 * @param fileName - e.g. "edgar/data/1234567/0001234567-24-000001.txt"
 * @returns Base URL, or null if fileName doesn't match expected pattern
 */
export function getFilingBaseUrl(fileName: string): {
  baseUrl: string;
} | null {
  const match = fileName.match(/edgar\/data\/(\d+)\/([^/]+)\.txt$/);
  if (!match) {
    return null;
  }

  const cik = match[1];
  const accessionNo = match[2]; // "0001437749-24-007306"
  const accessionNoNoDashes = accessionNo.replace(/-/g, "");

  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoNoDashes}`;
  return { baseUrl };
}

/**
 * Extract the XML filename from SEC submission text content.
 * The .txt file contains embedded documents with <FILENAME> tags.
 *
 * @param content - The full SEC submission text content
 * @returns The XML filename, or null if not found
 */
export function extractXmlFilenameFromContent(content: string): string | null {
  // Look for FILENAME tag that ends with .xml
  // Format: <FILENAME>something.xml
  const match = content.match(/<FILENAME>([^\n<]+\.xml)/i);
  return match ? match[1].trim() : null;
}

/**
 * Get Form 4 XML URLs from the submission content (no extra HTTP request needed)
 *
 * @param fileName - EDGAR fileName, e.g. "edgar/data/1234567/0001234567-24-000001.txt"
 * @param content - The full SEC submission text content (already fetched)
 * @returns Object with rawXmlUrl and formattedXmlUrl, or null if not found
 *
 * @example
 * ```typescript
 * const content = await fetchEdgarArchiveFileContent(fileName);
 * const urls = getForm4XmlUrls(fileName, content);
 * // urls.rawXmlUrl = "https://www.sec.gov/Archives/edgar/data/2070546/000162828026003318/wk-form4_1769205440.xml"
 * // urls.formattedXmlUrl = "https://www.sec.gov/Archives/edgar/data/2070546/000162828026003318/xslF345X03/wk-form4_1769205440.xml"
 * ```
 */
export function getForm4XmlUrls(
  fileName: string,
  content: string,
): Form4XmlUrls | null {
  const baseUrlInfo = getFilingBaseUrl(fileName);
  if (!baseUrlInfo) return null;

  const xmlFileName = extractXmlFilenameFromContent(content);
  if (!xmlFileName) return null;

  return {
    rawXmlUrl: `${baseUrlInfo.baseUrl}/${xmlFileName}`,
    formattedXmlUrl: `${baseUrlInfo.baseUrl}/xslF345X03/${xmlFileName}`,
  };
}

/**
 * Build Form4SourceInfo from fileName and content.
 * Use this to populate the _source field on Form4Document.
 *
 * @param fileName - EDGAR fileName, e.g. "edgar/data/1234567/0001234567-24-000001.txt"
 * @param content - The full SEC submission text content (already fetched)
 * @returns Form4SourceInfo object, or null if cannot be built
 *
 * @example
 * ```typescript
 * const content = await fetchEdgarArchiveFileContent(fileName);
 * const doc = parseForm4(content);
 * doc._source = buildForm4SourceInfo(fileName, content) ?? undefined;
 * ```
 */
export function buildForm4SourceInfo(
  fileName: string,
  content: string,
): Form4SourceInfo | null {
  const baseUrlInfo = getFilingBaseUrl(fileName);
  if (!baseUrlInfo) return null;

  const xmlFileName = extractXmlFilenameFromContent(content);
  if (!xmlFileName) return null;

  return {
    fileName,
    xmlFileName,
    rawXmlUrl: `${baseUrlInfo.baseUrl}/${xmlFileName}`,
    formattedXmlUrl: `${baseUrlInfo.baseUrl}/xslF345X03/${xmlFileName}`,
  };
}
