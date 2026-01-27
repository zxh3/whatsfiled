/**
 * Footnotes and signatures normalization functions.
 */

import type { Form4Signature } from "../../../types";
import type { RawFootnotes, RawOwnerSignature } from "../raw-types";
import { normalizeRequiredStringValue } from "./primitives";

/**
 * Normalize footnotes from raw XML.
 *
 * @param raw - Raw footnotes element
 * @returns Record mapping footnote ID to text
 */
export function normalizeFootnotes(
  raw: RawFootnotes | undefined,
): Record<string, string> {
  const footnotes: Record<string, string> = {};

  if (!raw?.footnote) {
    return footnotes;
  }

  const footnoteArray = Array.isArray(raw.footnote)
    ? raw.footnote
    : [raw.footnote];

  for (const fn of footnoteArray) {
    if (fn["@_id"]) {
      footnotes[fn["@_id"]] = fn["#text"] ?? "";
    }
  }

  return footnotes;
}

/**
 * Normalize signatures from raw XML.
 *
 * @param raw - Raw signature(s)
 * @returns Array of normalized signatures
 */
export function normalizeSignatures(
  raw: RawOwnerSignature | RawOwnerSignature[] | undefined,
): Form4Signature[] {
  if (!raw) {
    return [];
  }

  const sigArray = Array.isArray(raw) ? raw : [raw];

  return sigArray.map((sig) => ({
    name: normalizeRequiredStringValue(sig.signatureName),
    date: normalizeRequiredStringValue(sig.signatureDate),
  }));
}
