/**
 * Shared normalization for values that can have associated footnotes.
 * Used across multiple SEC form types that support footnote references.
 */

import type { ValueWithFootnotes } from "../../types/common";

/**
 * Raw footnote reference structure from SEC XML.
 * May be a single reference or an array of references.
 */
export interface RawFootnoteRef {
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

/**
 * Raw value with optional footnote references.
 */
export interface RawValueWithFootnote extends RawFootnoteRef {
  value?: string | number;
}

/**
 * Extract footnote IDs from a raw element.
 *
 * @param element - Element that may contain footnoteId
 * @returns Array of footnote ID strings
 */
export function extractFootnoteIds(
  element: RawFootnoteRef | undefined,
): string[] {
  if (!element?.footnoteId) {
    return [];
  }

  const footnoteId = element.footnoteId;
  if (Array.isArray(footnoteId)) {
    return footnoteId.map((f) => f["@_id"]).filter(Boolean);
  }

  return footnoteId["@_id"] ? [footnoteId["@_id"]] : [];
}

/**
 * Normalize a raw value with footnotes to the unified type.
 *
 * @param raw - The raw value element from XML
 * @param transform - Function to transform the value
 * @returns Normalized ValueWithFootnotes
 */
export function normalizeValueWithFootnotes<T>(
  raw: RawValueWithFootnote | undefined,
  transform: (v: string | number | undefined) => T,
): ValueWithFootnotes<T> {
  if (!raw) {
    return {
      value: transform(undefined),
      footnoteIds: [],
    };
  }

  return {
    value: transform(raw.value),
    footnoteIds: extractFootnoteIds(raw),
  };
}
