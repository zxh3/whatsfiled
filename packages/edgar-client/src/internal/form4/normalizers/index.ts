/**
 * Form 4 document normalization.
 *
 * This module transforms raw XML parsed data into normalized TypeScript types.
 * The main entry point is normalizeForm4Document().
 */

import { Form4ParseError } from "../../../errors";
import type {
  DocumentType,
  Form4Document,
  SchemaVersion,
} from "../../../types/form4";
import type { RawOwnershipDocument } from "../raw-types";
import { normalizeFootnotes, normalizeSignatures } from "./footnotes";
import { normalizeReportingOwner } from "./owner";
import {
  normalizeBoolean,
  normalizeDateValue,
  normalizeRequiredStringValue,
  normalizeStringValue,
} from "./primitives";
import {
  normalizeDerivativeHolding,
  normalizeDerivativeTransaction,
  normalizeNonDerivativeHolding,
  normalizeNonDerivativeTransaction,
} from "./tables";

// Re-export all normalizers for external use
export * from "./primitives";
export * from "./value-with-footnotes";
export * from "./transaction";
export * from "./owner";
export * from "./tables";
export * from "./footnotes";

/**
 * Ensure a value is an array.
 */
function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Normalize a raw Form 4 XML document to the unified Form4Document type.
 *
 * @param raw - The raw parsed XML document
 * @param schemaVersion - The detected schema version
 * @returns Normalized Form4Document
 * @throws Form4ParseError if document type is invalid
 */
export function normalizeForm4Document(
  raw: RawOwnershipDocument,
  schemaVersion: SchemaVersion,
): Form4Document {
  const doc = raw.ownershipDocument;

  // Document type validation
  const docType = normalizeStringValue(doc.documentType);
  if (docType !== "4" && docType !== "4/A") {
    throw new Form4ParseError(
      `Invalid document type: ${docType}. Expected "4" or "4/A"`,
    );
  }
  const documentType: DocumentType = docType;

  // Issuer
  const issuer = doc.issuer;

  // Reporting owners - ensure array
  const ownersArray = ensureArray(doc.reportingOwner);

  // Non-derivative table
  const ndTable = doc.nonDerivativeTable;
  const ndTransactions = ensureArray(ndTable?.nonDerivativeTransaction);
  const ndHoldings = ensureArray(ndTable?.nonDerivativeHolding);

  // Derivative table
  const dTable = doc.derivativeTable;
  const dTransactions = ensureArray(dTable?.derivativeTransaction);
  const dHoldings = ensureArray(dTable?.derivativeHolding);

  return {
    schemaVersion,
    documentType,
    periodOfReport: normalizeRequiredStringValue(doc.periodOfReport),
    dateOfOriginalSubmission:
      documentType === "4/A"
        ? normalizeDateValue(doc.dateOfOriginalSubmission)
        : null,
    notSubjectToSection16: normalizeBoolean(doc.notSubjectToSection16),
    noSecuritiesOwned: normalizeBoolean(doc.noSecuritiesOwned),
    // is10b5OnePlan exists in X0407 and X0508 (not in X0306)
    is10b5OnePlan:
      schemaVersion === "X0407" || schemaVersion === "X0508"
        ? normalizeBoolean(doc.aff10b5One)
        : null,

    issuer: {
      cik: normalizeRequiredStringValue(issuer?.issuerCik),
      name: normalizeRequiredStringValue(issuer?.issuerName),
      tradingSymbol: normalizeRequiredStringValue(issuer?.issuerTradingSymbol),
    },

    reportingOwners: ownersArray.map(normalizeReportingOwner),

    nonDerivativeTable: {
      transactions: ndTransactions.map((t) =>
        normalizeNonDerivativeTransaction(t, schemaVersion),
      ),
      holdings: ndHoldings.map(normalizeNonDerivativeHolding),
    },

    derivativeTable: {
      transactions: dTransactions.map((t) =>
        normalizeDerivativeTransaction(t, schemaVersion),
      ),
      holdings: dHoldings.map(normalizeDerivativeHolding),
    },

    footnotes: normalizeFootnotes(doc.footnotes),
    signatures: normalizeSignatures(doc.ownerSignature),
    remarks: normalizeStringValue(doc.remarks),
  };
}
