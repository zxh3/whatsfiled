import { Form4ParseError } from "../../errors";
import {
  type DocumentType,
  type Form4DerivativeHolding,
  type Form4DerivativeTransaction,
  type Form4Document,
  type Form4NonDerivativeHolding,
  type Form4NonDerivativeTransaction,
  type Form4OwnershipNature,
  type Form4PostTransactionAmounts,
  type Form4ReportingOwner,
  type Form4Signature,
  type Form4TransactionAmounts,
  type Form4TransactionCoding,
  type Form4UnderlyingSecurity,
  type SchemaVersion,
  type ValueWithFootnotes,
} from "../../types";
import type {
  RawDerivativeHolding,
  RawDerivativeTransaction,
  RawFootnotes,
  RawNonDerivativeHolding,
  RawNonDerivativeTransaction,
  RawOwnerSignature,
  RawOwnershipDocument,
  RawReportingOwner,
  RawTransactionCoding,
  RawTransactionTimeliness,
  RawValueWithFootnote,
} from "./raw-types";

// ============================================================
// BOOLEAN NORMALIZATION
// ============================================================

export function normalizeBoolean(
  value: string | number | boolean | undefined | null,
  defaultValue = false,
): boolean {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  // Number format (X0306)
  if (typeof value === "number") {
    return value === 1;
  }

  // Already boolean
  if (typeof value === "boolean") {
    return value;
  }

  // String format
  const str = String(value).toLowerCase().trim();
  if (str === "1" || str === "true" || str === "yes") {
    return true;
  }
  if (str === "0" || str === "false" || str === "no" || str === "") {
    return false;
  }

  return defaultValue;
}

// ============================================================
// VALUE EXTRACTION WITH FOOTNOTES
// ============================================================

function extractFootnoteIds(
  element:
    | { footnoteId?: { "@_id": string } | { "@_id": string }[] }
    | undefined,
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

export function normalizeStringValue(
  value: string | number | undefined,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value).trim();
}

export function normalizeRequiredStringValue(
  value: string | number | undefined,
): string {
  const result = normalizeStringValue(value);
  if (result === null) {
    return "";
  }
  return result;
}

export function normalizeNumberValue(
  value: string | number | undefined,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

export function normalizeDateValue(
  value: string | number | undefined,
): string | null {
  const str = normalizeStringValue(value);
  if (!str) return null;
  return str;
}

export function normalizeAcquiredDisposedCode(
  value: string | number | undefined,
): "A" | "D" | null {
  const str = normalizeStringValue(value);
  if (str === "A" || str === "D") {
    return str;
  }
  return null;
}

export function normalizeDirectIndirectCode(
  value: string | number | undefined,
): "D" | "I" | null {
  const str = normalizeStringValue(value);
  if (str === "D" || str === "I") {
    return str;
  }
  return null;
}

// ============================================================
// COMPLEX ELEMENT NORMALIZERS
// ============================================================

export function normalizeTransactionCoding(
  raw: RawTransactionCoding | undefined,
): Form4TransactionCoding {
  if (!raw) {
    return {
      formType: null,
      code: null,
      equitySwapInvolved: false,
      footnoteIds: [],
    };
  }

  return {
    formType: normalizeStringValue(raw.transactionFormType),
    code: normalizeStringValue(raw.transactionCode),
    equitySwapInvolved: normalizeBoolean(raw.equitySwapInvolved),
    footnoteIds: extractFootnoteIds(raw),
  };
}

export function normalizeTransactionAmounts(
  raw: RawNonDerivativeTransaction["transactionAmounts"] | undefined,
): Form4TransactionAmounts {
  return {
    shares: normalizeValueWithFootnotes(
      raw?.transactionShares,
      normalizeNumberValue,
    ),
    totalValue: normalizeValueWithFootnotes(
      raw?.transactionTotalValue,
      normalizeNumberValue,
    ),
    pricePerShare: normalizeValueWithFootnotes(
      raw?.transactionPricePerShare,
      normalizeNumberValue,
    ),
    acquiredDisposedCode: normalizeValueWithFootnotes(
      raw?.transactionAcquiredDisposedCode,
      normalizeAcquiredDisposedCode,
    ),
  };
}

export function normalizePostTransactionAmounts(
  raw: RawNonDerivativeTransaction["postTransactionAmounts"] | undefined,
): Form4PostTransactionAmounts {
  return {
    sharesOwned: normalizeValueWithFootnotes(
      raw?.sharesOwnedFollowingTransaction,
      normalizeNumberValue,
    ),
    valueOwned: normalizeValueWithFootnotes(
      raw?.valueOwnedFollowingTransaction,
      normalizeNumberValue,
    ),
  };
}

export function normalizeOwnershipNature(
  raw: RawNonDerivativeTransaction["ownershipNature"] | undefined,
): Form4OwnershipNature {
  return {
    directOrIndirect: normalizeValueWithFootnotes(
      raw?.directOrIndirectOwnership,
      normalizeDirectIndirectCode,
    ),
    natureOfOwnership: normalizeValueWithFootnotes(
      raw?.natureOfOwnership,
      normalizeStringValue,
    ),
  };
}

export function normalizeUnderlyingSecurity(
  raw: RawDerivativeTransaction["underlyingSecurity"] | undefined,
): Form4UnderlyingSecurity {
  return {
    title: normalizeValueWithFootnotes(
      raw?.underlyingSecurityTitle,
      normalizeStringValue,
    ),
    shares: normalizeValueWithFootnotes(
      raw?.underlyingSecurityShares,
      normalizeNumberValue,
    ),
    value: normalizeValueWithFootnotes(
      raw?.underlyingSecurityValue,
      normalizeNumberValue,
    ),
  };
}

// ============================================================
// REPORTING OWNER NORMALIZER
// ============================================================

export function normalizeReportingOwner(
  raw: RawReportingOwner,
): Form4ReportingOwner {
  const id = raw.reportingOwnerId;
  const address = raw.reportingOwnerAddress;
  const relationship = raw.reportingOwnerRelationship;

  return {
    id: {
      cik: normalizeRequiredStringValue(id?.rptOwnerCik),
      name: normalizeRequiredStringValue(id?.rptOwnerName),
    },
    address: {
      street1: normalizeStringValue(address?.rptOwnerStreet1),
      street2: normalizeStringValue(address?.rptOwnerStreet2),
      city: normalizeStringValue(address?.rptOwnerCity),
      state: normalizeStringValue(address?.rptOwnerState),
      zipCode: normalizeStringValue(address?.rptOwnerZipCode),
      stateDescription: normalizeStringValue(address?.rptOwnerStateDescription),
    },
    relationship: {
      isDirector: normalizeBoolean(relationship?.isDirector),
      isOfficer: normalizeBoolean(relationship?.isOfficer),
      isTenPercentOwner: normalizeBoolean(relationship?.isTenPercentOwner),
      isOther: normalizeBoolean(relationship?.isOther),
      officerTitle: normalizeStringValue(relationship?.officerTitle),
      otherText: normalizeStringValue(relationship?.otherText),
    },
  };
}

// ============================================================
// TRANSACTION TIMELINESS NORMALIZER
// ============================================================

function normalizeTransactionTimeliness(
  raw: RawTransactionTimeliness | undefined,
): ValueWithFootnotes<string | null> | null {
  if (!raw) {
    return null;
  }
  return normalizeValueWithFootnotes(
    { value: raw.value, footnoteId: raw.footnoteId },
    normalizeStringValue,
  );
}

// ============================================================
// NON-DERIVATIVE NORMALIZERS
// ============================================================

export function normalizeNonDerivativeTransaction(
  raw: RawNonDerivativeTransaction,
  schemaVersion: SchemaVersion,
): Form4NonDerivativeTransaction {
  return {
    type: "transaction",
    securityTitle: normalizeValueWithFootnotes(raw.securityTitle, (v) =>
      normalizeRequiredStringValue(v),
    ),
    transactionDate: normalizeValueWithFootnotes(
      raw.transactionDate,
      normalizeDateValue,
    ),
    // X0306 only - will be null for X0508
    deemedExecutionDate:
      schemaVersion === "X0306"
        ? normalizeValueWithFootnotes(
            raw.deemedExecutionDate,
            normalizeDateValue,
          )
        : null,
    transactionCoding: normalizeTransactionCoding(raw.transactionCoding),
    // X0306 and X0407 only (not X0508)
    transactionTimeliness:
      schemaVersion === "X0306" || schemaVersion === "X0407"
        ? normalizeTransactionTimeliness(raw.transactionTimeliness)
        : null,
    amounts: normalizeTransactionAmounts(raw.transactionAmounts),
    postTransactionAmounts: normalizePostTransactionAmounts(
      raw.postTransactionAmounts,
    ),
    ownershipNature: normalizeOwnershipNature(raw.ownershipNature),
  };
}

export function normalizeNonDerivativeHolding(
  raw: RawNonDerivativeHolding,
): Form4NonDerivativeHolding {
  return {
    type: "holding",
    securityTitle: normalizeValueWithFootnotes(raw.securityTitle, (v) =>
      normalizeRequiredStringValue(v),
    ),
    postTransactionAmounts: normalizePostTransactionAmounts(
      raw.postTransactionAmounts,
    ),
    ownershipNature: normalizeOwnershipNature(raw.ownershipNature),
  };
}

// ============================================================
// DERIVATIVE NORMALIZERS
// ============================================================

export function normalizeDerivativeTransaction(
  raw: RawDerivativeTransaction,
  schemaVersion: SchemaVersion,
): Form4DerivativeTransaction {
  return {
    type: "transaction",
    securityTitle: normalizeValueWithFootnotes(raw.securityTitle, (v) =>
      normalizeRequiredStringValue(v),
    ),
    conversionOrExercisePrice: normalizeValueWithFootnotes(
      raw.conversionOrExercisePrice,
      normalizeNumberValue,
    ),
    transactionDate: normalizeValueWithFootnotes(
      raw.transactionDate,
      normalizeDateValue,
    ),
    deemedExecutionDate:
      schemaVersion === "X0306"
        ? normalizeValueWithFootnotes(
            raw.deemedExecutionDate,
            normalizeDateValue,
          )
        : null,
    transactionCoding: normalizeTransactionCoding(raw.transactionCoding),
    // X0306 and X0407 only (not X0508)
    transactionTimeliness:
      schemaVersion === "X0306" || schemaVersion === "X0407"
        ? normalizeTransactionTimeliness(raw.transactionTimeliness)
        : null,
    amounts: normalizeTransactionAmounts(raw.transactionAmounts),
    exerciseDate: normalizeValueWithFootnotes(
      raw.exerciseDate,
      normalizeDateValue,
    ),
    expirationDate: normalizeValueWithFootnotes(
      raw.expirationDate,
      normalizeDateValue,
    ),
    underlyingSecurity: normalizeUnderlyingSecurity(raw.underlyingSecurity),
    postTransactionAmounts: normalizePostTransactionAmounts(
      raw.postTransactionAmounts,
    ),
    ownershipNature: normalizeOwnershipNature(raw.ownershipNature),
  };
}

export function normalizeDerivativeHolding(
  raw: RawDerivativeHolding,
): Form4DerivativeHolding {
  return {
    type: "holding",
    securityTitle: normalizeValueWithFootnotes(raw.securityTitle, (v) =>
      normalizeRequiredStringValue(v),
    ),
    conversionOrExercisePrice: normalizeValueWithFootnotes(
      raw.conversionOrExercisePrice,
      normalizeNumberValue,
    ),
    exerciseDate: normalizeValueWithFootnotes(
      raw.exerciseDate,
      normalizeDateValue,
    ),
    expirationDate: normalizeValueWithFootnotes(
      raw.expirationDate,
      normalizeDateValue,
    ),
    underlyingSecurity: normalizeUnderlyingSecurity(raw.underlyingSecurity),
    postTransactionAmounts: normalizePostTransactionAmounts(
      raw.postTransactionAmounts,
    ),
    ownershipNature: normalizeOwnershipNature(raw.ownershipNature),
  };
}

// ============================================================
// FOOTNOTES NORMALIZER
// ============================================================

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

// ============================================================
// SIGNATURE NORMALIZER
// ============================================================

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

// ============================================================
// HELPER: ENSURE ARRAY
// ============================================================

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ============================================================
// MAIN DOCUMENT NORMALIZER
// ============================================================

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
    // aff10b5One exists in X0407 and X0508 (not in X0306)
    aff10b5One:
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
