// Main export - the EdgarClient class
export { EdgarClient } from "./edgar-client";
export type { EdgarClientOptions } from "./edgar-client";

// Error classes
export {
  EdgarFetchError,
  Form4ParseError,
  FormParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "./errors";

// Constants
export { FORM_TYPES, FORM4_SCHEMA_VERSIONS } from "./constants";

// Types
export type {
  // Utility types
  Logger,
  Result,
  RetryOptions,
  ValueWithFootnotes,
  // Daily index types
  DailyIndexResult,
  DailyIndexRow,
  FormType,
  // Form 4 types
  DocumentType,
  Form4DerivativeHolding,
  Form4DerivativeTable,
  Form4DerivativeTransaction,
  Form4Document,
  Form4Issuer,
  Form4NonDerivativeHolding,
  Form4NonDerivativeTable,
  Form4NonDerivativeTransaction,
  Form4OwnershipNature,
  Form4ParseOptions,
  Form4PostTransactionAmounts,
  Form4ReportingOwner,
  Form4ReportingOwnerAddress,
  Form4ReportingOwnerId,
  Form4ReportingOwnerRelationship,
  Form4Signature,
  Form4SourceInfo,
  Form4TransactionAmounts,
  Form4TransactionCoding,
  Form4UnderlyingSecurity,
  SchemaVersion,
} from "./types";
