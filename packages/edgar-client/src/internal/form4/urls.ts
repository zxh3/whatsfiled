import type { Form4SourceInfo } from "../../types";

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
 * Build Form4SourceInfo from fileName and content.
 * Use this to populate the _source field on Form4Document.
 *
 * @param fileName - EDGAR fileName, e.g. "edgar/data/1234567/0001234567-24-000001.txt"
 * @param content - The full SEC submission text content (already fetched)
 * @returns Form4SourceInfo object, or null if cannot be built
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
