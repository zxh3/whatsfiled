import type { X2jOptions } from "fast-xml-parser";
import {
  BASE_PARSER_OPTIONS,
  createIsArrayFunction,
} from "../shared/xml-config";

/**
 * Tags in Form 4 XML that can appear multiple times and should always be arrays.
 */
const FORM4_ARRAY_TAGS = new Set([
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

/**
 * Configuration for fast-xml-parser optimized for SEC Form 4 XML.
 * Extends base parser options with Form 4-specific array handling.
 */
export const FORM4_PARSER_OPTIONS: X2jOptions = {
  ...BASE_PARSER_OPTIONS,
  isArray: createIsArrayFunction(FORM4_ARRAY_TAGS),
};
