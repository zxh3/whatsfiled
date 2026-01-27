// Raw XML types that fast-xml-parser produces

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
