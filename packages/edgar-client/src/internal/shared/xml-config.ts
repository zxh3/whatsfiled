import type { X2jOptions } from "fast-xml-parser";

/**
 * Base parser options shared across all SEC form types.
 * Individual forms extend these with their own array tag configurations.
 */
export const BASE_PARSER_OPTIONS: Omit<X2jOptions, "isArray"> = {
  // Attribute handling
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,

  // Text handling
  textNodeName: "#text",
  parseTagValue: false, // Keep as strings, normalize manually
  parseAttributeValue: false,
  trimValues: true,

  // Don't process entities - SEC XML should be well-formed
  processEntities: true,
  htmlEntities: false,

  // Namespace handling
  removeNSPrefix: false, // Keep namespace prefixes if present

  // Comments and processing instructions
  commentPropName: false, // Ignore comments
  ignorePiTags: true, // Ignore processing instructions
};

/**
 * Create an isArray function for fast-xml-parser based on a set of tag names.
 * Tags in the set will always be parsed as arrays, even if there's only one element.
 *
 * @param arrayTags - Set of tag names that should always be arrays
 * @returns isArray function for fast-xml-parser options
 */
export function createIsArrayFunction(
  arrayTags: Set<string>,
): (
  tagName: string,
  jPath: string,
  isLeafNode: boolean,
  isAttribute: boolean,
) => boolean {
  return (
    tagName: string,
    _jPath: string,
    _isLeafNode: boolean,
    isAttribute: boolean,
  ): boolean => {
    if (isAttribute) return false;
    return arrayTags.has(tagName);
  };
}
