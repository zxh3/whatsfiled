import { XMLParser, type X2jOptions } from "fast-xml-parser";

/**
 * Extract XML content from SEC document wrapper.
 * SEC documents have headers and the XML is wrapped in <XML>...</XML> tags.
 *
 * @param content - Raw SEC document content
 * @returns Extracted XML string
 * @throws Error if XML cannot be extracted
 */
export function extractXmlFromSecDocument(content: string): string {
  // Look for XML content between <XML> tags
  const xmlMatch = content.match(/<XML>\s*([\s\S]*?)\s*<\/XML>/i);
  if (xmlMatch && xmlMatch[1]) {
    return xmlMatch[1].trim();
  }

  // If no <XML> tags, check if content starts with <?xml or common root elements
  const trimmed = content.trim();
  if (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<ownershipDocument") ||
    trimmed.startsWith("<edgarSubmission")
  ) {
    return trimmed;
  }

  throw new Error(
    "Could not extract XML from SEC document. Expected <XML>...</XML> tags or raw XML content.",
  );
}

/**
 * Create a configured XML parser instance with the given options.
 *
 * @param options - fast-xml-parser options
 * @returns Configured XMLParser instance
 */
export function createXmlParser(options: X2jOptions): XMLParser {
  return new XMLParser(options);
}
