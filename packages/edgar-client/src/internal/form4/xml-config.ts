import type { X2jOptions } from "fast-xml-parser";

/**
 * Configuration for fast-xml-parser optimized for SEC Form 4 XML
 *
 * Key decisions:
 * - ignoreAttributes: false - we need footnote IDs from attributes
 * - attributeNamePrefix: "@_" - standard prefix to distinguish attrs
 * - isArray: function - ensures arrays for repeatable elements
 * - parseTagValue: false - keep strings, normalize later
 * - trimValues: true - clean up whitespace
 */
export const FORM4_PARSER_OPTIONS: X2jOptions = {
  // Attribute handling
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,

  // Text handling
  textNodeName: "#text",
  parseTagValue: false, // Keep as strings, normalize manually
  parseAttributeValue: false,
  trimValues: true,

  // Array handling - critical for handling single vs multiple elements
  isArray: (
    tagName: string,
    _jPath: string,
    _isLeafNode: boolean,
    isAttribute: boolean,
  ): boolean => {
    if (isAttribute) return false;

    // Elements that can appear multiple times
    const arrayTags = new Set([
      // Multiple reporting owners
      "reportingOwner",
      // Multiple signatures
      "ownerSignature",
      // Multiple footnotes
      "footnote",
      // Multiple footnote references
      "footnoteId",
      // Transactions and holdings
      "nonDerivativeTransaction",
      "nonDerivativeHolding",
      "derivativeTransaction",
      "derivativeHolding",
    ]);

    return arrayTags.has(tagName);
  },

  // Don't process entities - SEC XML should be well-formed
  processEntities: true,
  htmlEntities: false,

  // Namespace handling
  removeNSPrefix: false, // Keep namespace prefixes if present

  // Comments and processing instructions
  commentPropName: false, // Ignore comments
  ignorePiTags: true, // Ignore processing instructions
};
