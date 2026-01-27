/**
 * Raw XML types produced by fast-xml-parser when parsing SEC Form 4 documents.
 *
 * These types represent the structure of SEC EDGAR Form 4 XML before normalization.
 * The SEC uses different schema versions (X0306, X0407, X0508) that have slightly
 * different structures, but fast-xml-parser produces consistent output.
 *
 * @see https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=4
 * @internal
 */

/**
 * A value element that may have associated footnote references.
 * In SEC Form 4 XML, many elements can have footnotes explaining special circumstances.
 *
 * @example XML structure:
 * ```xml
 * <transactionShares>
 *   <value>1000</value>
 *   <footnoteId id="F1"/>
 * </transactionShares>
 * ```
 */
export interface RawValueWithFootnote {
  /** The actual value (string or number depending on element type) */
  value?: string | number;
  /** Reference(s) to footnotes defined in the footnotes section */
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

/**
 * Information about the company whose securities were traded.
 * Every Form 4 filing has exactly one issuer.
 */
export interface RawIssuer {
  /** SEC Central Index Key - unique company identifier (e.g., "320193" for Apple) */
  issuerCik?: string;
  /** Full company name as registered with SEC */
  issuerName?: string;
  /** Stock ticker symbol (e.g., "AAPL") */
  issuerTradingSymbol?: string;
}

/**
 * Identity information for a reporting owner (insider).
 * Form 4 filings can have multiple reporting owners for the same transaction.
 */
export interface RawReportingOwnerId {
  /** SEC Central Index Key for the insider */
  rptOwnerCik?: string;
  /** Full name of the insider */
  rptOwnerName?: string;
}

/**
 * Mailing address of a reporting owner.
 * Used for SEC correspondence and public records.
 */
export interface RawReportingOwnerAddress {
  rptOwnerStreet1?: string;
  rptOwnerStreet2?: string;
  rptOwnerCity?: string;
  /** Two-letter state code (e.g., "CA") */
  rptOwnerState?: string;
  rptOwnerZipCode?: string;
  /** Full state name for non-US addresses */
  rptOwnerStateDescription?: string;
}

/**
 * The relationship between the reporting owner and the issuer.
 * At least one relationship flag must be true.
 *
 * @note Boolean values may be encoded as "1"/"0", "true"/"false", or 1/0
 */
export interface RawReportingOwnerRelationship {
  /** Member of the board of directors */
  isDirector?: string | number;
  /** Corporate officer (CEO, CFO, etc.) */
  isOfficer?: string | number;
  /** Beneficial owner of 10% or more of company's securities */
  isTenPercentOwner?: string | number;
  /** Other relationship (described in otherText) */
  isOther?: string | number;
  /** Officer's title if isOfficer is true (e.g., "Chief Executive Officer") */
  officerTitle?: string;
  /** Description if isOther is true */
  otherText?: string;
}

/**
 * Complete reporting owner information including identity, address, and relationship.
 */
export interface RawReportingOwner {
  reportingOwnerId?: RawReportingOwnerId;
  reportingOwnerAddress?: RawReportingOwnerAddress;
  reportingOwnerRelationship?: RawReportingOwnerRelationship;
}

/**
 * Encoding of the transaction type.
 *
 * @see SEC Transaction Codes: https://www.sec.gov/about/forms/form4data.pdf
 *
 * Common transaction codes:
 * - P: Open market or private purchase
 * - S: Open market or private sale
 * - A: Grant, award, or other acquisition (e.g., stock options)
 * - D: Disposition to the issuer (e.g., stock buyback)
 * - F: Payment of exercise price or tax liability using securities
 * - M: Exercise or conversion of derivative security
 * - G: Gift
 * - V: Transaction voluntarily reported earlier than required
 */
export interface RawTransactionCoding {
  /** Form type (usually "4") */
  transactionFormType?: string;
  /** Transaction code (P, S, A, D, F, M, G, V, etc.) */
  transactionCode?: string;
  /** Whether transaction involves an equity swap */
  equitySwapInvolved?: string | number;
  /** Optional footnote references */
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

/**
 * Timeliness indicator for late Form 4 filings.
 * Present in X0306 and X0407 schemas, removed in X0508.
 */
export interface RawTransactionTimeliness {
  /** Timeliness code (e.g., "E" for early, "L" for late) */
  value?: string;
  footnoteId?: { "@_id": string } | { "@_id": string }[];
}

/**
 * Quantities and prices for a transaction.
 */
export interface RawTransactionAmounts {
  /** Number of shares involved in the transaction */
  transactionShares?: RawValueWithFootnote;
  /** Total dollar value of the transaction */
  transactionTotalValue?: RawValueWithFootnote;
  /** Price per share */
  transactionPricePerShare?: RawValueWithFootnote;
  /** "A" for acquired, "D" for disposed */
  transactionAcquiredDisposedCode?: RawValueWithFootnote;
}

/**
 * Holdings after transaction completion.
 */
export interface RawPostTransactionAmounts {
  /** Number of shares owned after transaction */
  sharesOwnedFollowingTransaction?: RawValueWithFootnote;
  /** Dollar value owned after transaction (for value-based securities) */
  valueOwnedFollowingTransaction?: RawValueWithFootnote;
}

/**
 * Direct vs indirect ownership.
 * Direct (D): Owner holds securities in their own name
 * Indirect (I): Owner has beneficial interest through another entity
 */
export interface RawOwnershipNature {
  /** "D" for direct, "I" for indirect */
  directOrIndirectOwnership?: RawValueWithFootnote;
  /** For indirect ownership, describes the nature (e.g., "By Trust", "By Spouse") */
  natureOfOwnership?: RawValueWithFootnote;
}

/**
 * The underlying security for a derivative instrument.
 * Derivatives like options are based on common stock or other securities.
 */
export interface RawUnderlyingSecurity {
  /** Name of the underlying security (e.g., "Common Stock") */
  underlyingSecurityTitle?: RawValueWithFootnote;
  /** Number of underlying shares */
  underlyingSecurityShares?: RawValueWithFootnote;
  /** Value of underlying security */
  underlyingSecurityValue?: RawValueWithFootnote;
}

/**
 * A non-derivative security transaction (Table I).
 * Non-derivatives include common stock, preferred stock, etc.
 */
export interface RawNonDerivativeTransaction {
  /** Security name (e.g., "Common Stock") */
  securityTitle?: RawValueWithFootnote;
  /** Date the transaction was executed */
  transactionDate?: RawValueWithFootnote;
  /** Date transaction was deemed executed (X0306 only) */
  deemedExecutionDate?: RawValueWithFootnote;
  /** Transaction type encoding */
  transactionCoding?: RawTransactionCoding;
  /** Timeliness indicator (X0306, X0407 only) */
  transactionTimeliness?: RawTransactionTimeliness;
  /** Shares, price, and acquired/disposed info */
  transactionAmounts?: RawTransactionAmounts;
  /** Holdings after this transaction */
  postTransactionAmounts?: RawPostTransactionAmounts;
  /** Direct or indirect ownership */
  ownershipNature?: RawOwnershipNature;
}

/**
 * A non-derivative security holding (Table I, holdings only).
 * Reports securities held without a transaction.
 */
export interface RawNonDerivativeHolding {
  securityTitle?: RawValueWithFootnote;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

/**
 * Table I: Non-Derivative Securities.
 * Contains both transactions and holdings for common stock, etc.
 */
export interface RawNonDerivativeTable {
  nonDerivativeTransaction?:
    | RawNonDerivativeTransaction
    | RawNonDerivativeTransaction[];
  nonDerivativeHolding?: RawNonDerivativeHolding | RawNonDerivativeHolding[];
}

/**
 * A derivative security transaction (Table II).
 * Derivatives include stock options, warrants, convertible securities, etc.
 */
export interface RawDerivativeTransaction {
  /** Derivative security name (e.g., "Stock Option (right to buy)") */
  securityTitle?: RawValueWithFootnote;
  /** Price to exercise or convert the derivative */
  conversionOrExercisePrice?: RawValueWithFootnote;
  /** Date the transaction was executed */
  transactionDate?: RawValueWithFootnote;
  /** Date transaction was deemed executed (X0306 only) */
  deemedExecutionDate?: RawValueWithFootnote;
  transactionCoding?: RawTransactionCoding;
  /** Timeliness indicator (X0306, X0407 only) */
  transactionTimeliness?: RawTransactionTimeliness;
  transactionAmounts?: RawTransactionAmounts;
  /** Date the derivative becomes exercisable */
  exerciseDate?: RawValueWithFootnote;
  /** Date the derivative expires */
  expirationDate?: RawValueWithFootnote;
  /** The security this derivative converts to */
  underlyingSecurity?: RawUnderlyingSecurity;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

/**
 * A derivative security holding (Table II, holdings only).
 * Reports derivatives held without a transaction.
 */
export interface RawDerivativeHolding {
  securityTitle?: RawValueWithFootnote;
  conversionOrExercisePrice?: RawValueWithFootnote;
  exerciseDate?: RawValueWithFootnote;
  expirationDate?: RawValueWithFootnote;
  underlyingSecurity?: RawUnderlyingSecurity;
  postTransactionAmounts?: RawPostTransactionAmounts;
  ownershipNature?: RawOwnershipNature;
}

/**
 * Table II: Derivative Securities.
 * Contains both transactions and holdings for options, warrants, etc.
 */
export interface RawDerivativeTable {
  derivativeTransaction?: RawDerivativeTransaction | RawDerivativeTransaction[];
  derivativeHolding?: RawDerivativeHolding | RawDerivativeHolding[];
}

/**
 * A single footnote explaining a special circumstance in the filing.
 */
export interface RawFootnote {
  /** Footnote identifier (e.g., "F1", "F2") */
  "@_id": string;
  /** Footnote text content */
  "#text"?: string;
}

/**
 * Container for all footnotes in the document.
 */
export interface RawFootnotes {
  footnote?: RawFootnote | RawFootnote[];
}

/**
 * Signature of a reporting owner or their representative.
 * Every Form 4 must have at least one signature.
 */
export interface RawOwnerSignature {
  /** Name of the signer (owner or authorized representative) */
  signatureName?: string;
  /** Date signed (YYYY-MM-DD) */
  signatureDate?: string;
}

/**
 * The complete content of an ownershipDocument element.
 * This represents the full Form 4 filing structure.
 */
export interface RawOwnershipDocumentContent {
  /** Schema version identifier (X0306, X0407, X0508) */
  schemaVersion?: string;
  /** "4" for Form 4, "4/A" for amended Form 4 */
  documentType?: string;
  /** Date of earliest transaction reported (YYYY-MM-DD) */
  periodOfReport?: string;
  /** For amendments: date of original filing */
  dateOfOriginalSubmission?: string;
  /** True if reporting person is exempt from Section 16 */
  notSubjectToSection16?: string | number;
  /** True if no securities are beneficially owned */
  noSecuritiesOwned?: string | number;
  /** 10b5-1 trading plan flag (X0407, X0508 only) */
  aff10b5One?: string | number;
  /** The company whose securities were traded */
  issuer?: RawIssuer;
  /** The insider(s) who made the transaction */
  reportingOwner?: RawReportingOwner | RawReportingOwner[];
  /** Non-derivative securities (Table I) */
  nonDerivativeTable?: RawNonDerivativeTable;
  /** Derivative securities (Table II) */
  derivativeTable?: RawDerivativeTable;
  /** Explanatory footnotes */
  footnotes?: RawFootnotes;
  /** Required signature(s) */
  ownerSignature?: RawOwnerSignature | RawOwnerSignature[];
  /** Optional remarks/explanations */
  remarks?: string;
}

/**
 * Root structure returned by fast-xml-parser for Form 4 XML.
 * The ownershipDocument element is the root of all Form 4 filings.
 */
export interface RawOwnershipDocument {
  ownershipDocument: RawOwnershipDocumentContent;
}
