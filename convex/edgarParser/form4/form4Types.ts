// ============================================================
// SCHEMA VERSION TYPES
// ============================================================

export const SUPPORTED_SCHEMA_VERSIONS = ["X0306", "X0407", "X0508"] as const;
export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export type DocumentType = "4" | "4/A";

// ============================================================
// ERROR TYPES
// ============================================================

export class Form4ParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "Form4ParseError";
  }
}

export class UnsupportedSchemaVersionError extends Form4ParseError {
  constructor(public readonly version: string) {
    super(
      `Unsupported schema version: ${version}. Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

export class ValidationError extends Form4ParseError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ============================================================
// RAW XML TYPES (what fast-xml-parser produces)
// ============================================================

export interface RawValueWithFootnote {
  value?: string | number;
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

export interface RawIssuer {
  issuerCik?: string;
  issuerName?: string;
  issuerTradingSymbol?: string;
}

export interface RawReportingOwnerId {
  rptOwnerCik?: string;
  rptOwnerName?: string;
}

export interface RawReportingOwnerAddress {
  rptOwnerStreet1?: string;
  rptOwnerStreet2?: string;
  rptOwnerCity?: string;
  rptOwnerState?: string;
  rptOwnerZipCode?: string;
  rptOwnerStateDescription?: string;
}

export interface RawReportingOwnerRelationship {
  isDirector?: string | number;
  isOfficer?: string | number;
  isTenPercentOwner?: string | number;
  isOther?: string | number;
  officerTitle?: string;
  otherText?: string;
}

export interface RawReportingOwner {
  reportingOwnerId?: RawReportingOwnerId;
  reportingOwnerAddress?: RawReportingOwnerAddress;
  reportingOwnerRelationship?: RawReportingOwnerRelationship;
}

export interface RawTransactionCoding {
  transactionFormType?: string;
  transactionCode?: string;
  equitySwapInvolved?: string | number;
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

export interface RawTransactionTimeliness {
  value?: string;
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

export interface RawTransactionAmounts {
  transactionShares?: RawValueWithFootnote;
  transactionTotalValue?: RawValueWithFootnote;
  transactionPricePerShare?: RawValueWithFootnote;
  transactionAcquiredDisposedCode?: RawValueWithFootnote;
}

export interface RawPostTransactionAmounts {
  sharesOwnedFollowingTransaction?: RawValueWithFootnote;
  valueOwnedFollowingTransaction?: RawValueWithFootnote;
}

export interface RawOwnershipNature {
  directOrIndirectOwnership?: RawValueWithFootnote;
  natureOfOwnership?: RawValueWithFootnote;
}

export interface RawUnderlyingSecurity {
  underlyingSecurityTitle?: RawValueWithFootnote;
  underlyingSecurityShares?: RawValueWithFootnote;
  underlyingSecurityValue?: RawValueWithFootnote;
}

export interface RawNonDerivativeTransaction {
  securityTitle?: RawValueWithFootnote;
  transactionDate?: RawValueWithFootnote;
  deemedExecutionDate?: RawValueWithFootnote;
  transactionCoding?: RawTransactionCoding;
  transactionTimeliness?: RawTransactionTimeliness;
  transactionAmounts?: RawTransactionAmounts;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

export interface RawNonDerivativeHolding {
  securityTitle?: RawValueWithFootnote;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

export interface RawNonDerivativeTable {
  nonDerivativeTransaction?:
    | RawNonDerivativeTransaction
    | RawNonDerivativeTransaction[];
  nonDerivativeHolding?: RawNonDerivativeHolding | RawNonDerivativeHolding[];
}

export interface RawDerivativeTransaction {
  securityTitle?: RawValueWithFootnote;
  conversionOrExercisePrice?: RawValueWithFootnote;
  transactionDate?: RawValueWithFootnote;
  deemedExecutionDate?: RawValueWithFootnote;
  transactionCoding?: RawTransactionCoding;
  transactionTimeliness?: RawTransactionTimeliness;
  transactionAmounts?: RawTransactionAmounts;
  exerciseDate?: RawValueWithFootnote;
  expirationDate?: RawValueWithFootnote;
  underlyingSecurity?: RawUnderlyingSecurity;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

export interface RawDerivativeHolding {
  securityTitle?: RawValueWithFootnote;
  conversionOrExercisePrice?: RawValueWithFootnote;
  exerciseDate?: RawValueWithFootnote;
  expirationDate?: RawValueWithFootnote;
  underlyingSecurity?: RawUnderlyingSecurity;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

export interface RawDerivativeTable {
  derivativeTransaction?: RawDerivativeTransaction | RawDerivativeTransaction[];
  derivativeHolding?: RawDerivativeHolding | RawDerivativeHolding[];
}

export interface RawFootnote {
  "@_id": string;
  "#text"?: string;
}

export interface RawFootnotes {
  footnote?: RawFootnote | RawFootnote[];
}

export interface RawOwnerSignature {
  signatureName?: string;
  signatureDate?: string;
}

export interface RawOwnershipDocumentContent {
  schemaVersion?: string;
  documentType?: string;
  periodOfReport?: string;
  dateOfOriginalSubmission?: string;
  notSubjectToSection16?: string | number;
  noSecuritiesOwned?: string | number;
  aff10b5One?: string | number;
  issuer?: RawIssuer;
  reportingOwner?: RawReportingOwner | RawReportingOwner[];
  nonDerivativeTable?: RawNonDerivativeTable;
  derivativeTable?: RawDerivativeTable;
  footnotes?: RawFootnotes;
  ownerSignature?: RawOwnerSignature | RawOwnerSignature[];
  remarks?: string;
}

export interface RawOwnershipDocument {
  ownershipDocument: RawOwnershipDocumentContent;
}

// ============================================================
// NORMALIZED OUTPUT TYPES
// ============================================================

/**
 * Value that may have associated footnote references
 */
export interface ValueWithFootnotes<T> {
  value: T;
  footnoteIds: string[];
}

export interface Form4Issuer {
  cik: string;
  name: string;
  tradingSymbol: string;
}

export interface Form4ReportingOwnerId {
  cik: string;
  name: string;
}

export interface Form4ReportingOwnerAddress {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  stateDescription: string | null;
}

export interface Form4ReportingOwnerRelationship {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
  officerTitle: string | null;
  otherText: string | null;
}

export interface Form4ReportingOwner {
  id: Form4ReportingOwnerId;
  address: Form4ReportingOwnerAddress;
  relationship: Form4ReportingOwnerRelationship;
}

export interface Form4TransactionCoding {
  formType: string | null;
  code: string | null;
  equitySwapInvolved: boolean;
  footnoteIds: string[];
}

export interface Form4TransactionAmounts {
  shares: ValueWithFootnotes<number | null>;
  totalValue: ValueWithFootnotes<number | null>;
  pricePerShare: ValueWithFootnotes<number | null>;
  acquiredDisposedCode: ValueWithFootnotes<"A" | "D" | null>;
}

export interface Form4PostTransactionAmounts {
  sharesOwned: ValueWithFootnotes<number | null>;
  valueOwned: ValueWithFootnotes<number | null>;
}

export interface Form4OwnershipNature {
  directOrIndirect: ValueWithFootnotes<"D" | "I" | null>;
  natureOfOwnership: ValueWithFootnotes<string | null>;
}

export interface Form4UnderlyingSecurity {
  title: ValueWithFootnotes<string | null>;
  shares: ValueWithFootnotes<number | null>;
  value: ValueWithFootnotes<number | null>;
}

export interface Form4NonDerivativeTransaction {
  type: "transaction";
  securityTitle: ValueWithFootnotes<string>;
  transactionDate: ValueWithFootnotes<string | null>;
  /** Only present in X0306 (not in X0407 or X0508) */
  deemedExecutionDate: ValueWithFootnotes<string | null> | null;
  transactionCoding: Form4TransactionCoding;
  /** Present in X0306 and X0407 (not in X0508) */
  transactionTimeliness: ValueWithFootnotes<string | null> | null;
  amounts: Form4TransactionAmounts;
  postTransactionAmounts: Form4PostTransactionAmounts;
  ownershipNature: Form4OwnershipNature;
}

export interface Form4NonDerivativeHolding {
  type: "holding";
  securityTitle: ValueWithFootnotes<string>;
  postTransactionAmounts: Form4PostTransactionAmounts;
  ownershipNature: Form4OwnershipNature;
}

export type Form4NonDerivativeEntry =
  | Form4NonDerivativeTransaction
  | Form4NonDerivativeHolding;

export interface Form4NonDerivativeTable {
  transactions: Form4NonDerivativeTransaction[];
  holdings: Form4NonDerivativeHolding[];
}

export interface Form4DerivativeTransaction {
  type: "transaction";
  securityTitle: ValueWithFootnotes<string>;
  conversionOrExercisePrice: ValueWithFootnotes<number | null>;
  transactionDate: ValueWithFootnotes<string | null>;
  deemedExecutionDate: ValueWithFootnotes<string | null> | null;
  transactionCoding: Form4TransactionCoding;
  transactionTimeliness: ValueWithFootnotes<string | null> | null;
  amounts: Form4TransactionAmounts;
  exerciseDate: ValueWithFootnotes<string | null>;
  expirationDate: ValueWithFootnotes<string | null>;
  underlyingSecurity: Form4UnderlyingSecurity;
  postTransactionAmounts: Form4PostTransactionAmounts;
  ownershipNature: Form4OwnershipNature;
}

export interface Form4DerivativeHolding {
  type: "holding";
  securityTitle: ValueWithFootnotes<string>;
  conversionOrExercisePrice: ValueWithFootnotes<number | null>;
  exerciseDate: ValueWithFootnotes<string | null>;
  expirationDate: ValueWithFootnotes<string | null>;
  underlyingSecurity: Form4UnderlyingSecurity;
  postTransactionAmounts: Form4PostTransactionAmounts;
  ownershipNature: Form4OwnershipNature;
}

export type Form4DerivativeEntry =
  | Form4DerivativeTransaction
  | Form4DerivativeHolding;

export interface Form4DerivativeTable {
  transactions: Form4DerivativeTransaction[];
  holdings: Form4DerivativeHolding[];
}

export interface Form4Signature {
  name: string;
  date: string;
}

/**
 * Source information for the Form 4 document
 * Contains file paths and URLs to the original SEC filing
 */
export interface Form4SourceInfo {
  /** EDGAR file path, e.g. "edgar/data/2070546/0001628280-26-003318.txt" */
  fileName: string;
  /** XML filename within the filing, e.g. "wk-form4_1769205440.xml" */
  xmlFileName: string;
  /** Full URL to raw XML file */
  rawXmlUrl: string;
  /** Full URL to formatted table view (XSLT transformed) */
  formattedXmlUrl: string;
}

/**
 * Unified Form 4 document - the primary output type
 * All schema versions are normalized to this structure
 */
export interface Form4Document {
  /** Schema version (X0306, X0508, etc.) */
  schemaVersion: SchemaVersion;
  /** Document type: "4" for Form 4, "4/A" for amended */
  documentType: DocumentType;
  /** Period of report (YYYY-MM-DD) */
  periodOfReport: string;
  /** Date of original submission (Form 4/A only) */
  dateOfOriginalSubmission: string | null;
  /** Whether the reporting person is not subject to Section 16 */
  notSubjectToSection16: boolean;
  /** Whether no securities are owned */
  noSecuritiesOwned: boolean;
  /** Whether reporting person is 10b5-1 affiliated (X0407 and X0508 only, null for X0306) */
  aff10b5One: boolean | null;

  /** Issuer (company) information */
  issuer: Form4Issuer;
  /** Reporting owner(s) - can be multiple */
  reportingOwners: Form4ReportingOwner[];

  /** Non-derivative securities transactions and holdings */
  nonDerivativeTable: Form4NonDerivativeTable;
  /** Derivative securities transactions and holdings */
  derivativeTable: Form4DerivativeTable;

  /** All footnotes keyed by ID */
  footnotes: Record<string, string>;
  /** Owner signatures */
  signatures: Form4Signature[];
  /** Optional remarks */
  remarks: string | null;

  /** Source file information and URLs (optional, populated when available) */
  _source?: Form4SourceInfo;
}

// ============================================================
// PARSE OPTIONS
// ============================================================

export interface Form4ParseOptions {
  /**
   * Whether to validate the parsed document
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to throw on unknown schema versions
   * Set to false to attempt parsing anyway (risky)
   * @default true
   */
  strictSchemaVersion?: boolean;
}
