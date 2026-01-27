/**
 * Normalization for values that can have associated footnotes.
 * Re-exports shared value-with-footnotes utilities.
 */

// Re-export from shared module
export {
  extractFootnoteIds,
  normalizeValueWithFootnotes,
} from "../../shared/value-with-footnotes";

// Re-export types for backward compatibility
export type {
  RawFootnoteRef,
  RawValueWithFootnote,
} from "../../shared/value-with-footnotes";
