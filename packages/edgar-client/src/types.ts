// ============================================================
// RETRY OPTIONS
// ============================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryStatusCodes?: number[];
}

// ============================================================
// RESULT TYPE
// ============================================================

/**
 * A discriminated union for operations that can fail with typed errors.
 * Provides better error context than returning null.
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ============================================================
// LOGGER TYPE
// ============================================================

/**
 * Logger interface for the EdgarClient.
 * All methods are optional and default to console methods.
 */
export interface Logger {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  info?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

// ============================================================
// DAILY INDEX TYPES
// ============================================================

export const KNOWN_FORMS = [
  // Insider ownership
  "3",
  "3/A",
  "4",
  "4/A",
  "5",
  "5/A",

  // Schedules
  "SCHEDULE 13D",
  "SCHEDULE 13D/A",
  "SCHEDULE 13G",
  "SCHEDULE 13G/A",
  "SC 13D",
  "SC 13D/A",
  "SC 13G",
  "SC 13G/A",

  // Common filings (optional)
  "10-K",
  "10-Q",
  "8-K",
  "13F-HR",
  "13F-HR/A",
  "DEF 14A",
  "DEFA14A",
] as const;

export type FormType = (typeof KNOWN_FORMS)[number];

export type DailyIndexRow = {
  formType: string;
  companyName: string;
  cik: string;
  dateFiled: string; // YYYYMMDD
  fileName: string; // edgar/data/.../*.txt
};

export interface DailyIndexResult {
  url: string;
  content: string;
  dateTimestamp: number;
}

// ============================================================
// SCHEMA VERSION TYPES
// ============================================================

export const SUPPORTED_SCHEMA_VERSIONS = ["X0306", "X0407", "X0508"] as const;
export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export type DocumentType = "4" | "4/A";

// ============================================================
// FORM 4 VALUE TYPES
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
  isDirect: ValueWithFootnotes<boolean | null>;
  natureOfOwnership: ValueWithFootnotes<string | null>;
}

export interface Form4UnderlyingSecurity {
  title: ValueWithFootnotes<string | null>;
  shares: ValueWithFootnotes<number | null>;
  value: ValueWithFootnotes<number | null>;
}

export interface Form4NonDerivativeTransaction {
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
  securityTitle: ValueWithFootnotes<string>;
  postTransactionAmounts: Form4PostTransactionAmounts;
  ownershipNature: Form4OwnershipNature;
}

export interface Form4NonDerivativeTable {
  transactions: Form4NonDerivativeTransaction[];
  holdings: Form4NonDerivativeHolding[];
}

export interface Form4DerivativeTransaction {
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
  securityTitle: ValueWithFootnotes<string>;
  conversionOrExercisePrice: ValueWithFootnotes<number | null>;
  exerciseDate: ValueWithFootnotes<string | null>;
  expirationDate: ValueWithFootnotes<string | null>;
  underlyingSecurity: Form4UnderlyingSecurity;
  postTransactionAmounts: Form4PostTransactionAmounts;
  ownershipNature: Form4OwnershipNature;
}

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
  is10b5OnePlan: boolean | null;

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
  source?: Form4SourceInfo;
}

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

  /**
   * Logger for warnings (e.g., unknown schema version fallback)
   * @default console
   */
  logger?: Logger;

  /**
   * EDGAR file path for auto-populating source info
   * e.g. "edgar/data/1234567/0001234567-24-000001.txt"
   */
  fileName?: string;
}

