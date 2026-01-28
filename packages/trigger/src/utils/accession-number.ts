/**
 * Extract accession number from an EDGAR file path.
 *
 * @param fileName - EDGAR file path (e.g., "edgar/data/123/0001234567-24-000001.txt")
 * @returns The accession number (e.g., "0001234567-24-000001")
 *
 * @example
 * ```typescript
 * extractAccessionNumber("edgar/data/123/0001234567-24-000001.txt")
 * // Returns: "0001234567-24-000001"
 * ```
 */
export function extractAccessionNumber(fileName: string): string {
  // e.g., "edgar/data/123/0001234567-24-000001.txt" -> "0001234567-24-000001"
  const match = fileName.match(/(\d{10}-\d{2}-\d{6})/);
  return match ? match[1] : fileName;
}
