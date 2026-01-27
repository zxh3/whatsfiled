// Main export - the EdgarClient class

// Constants
export { FORM_TYPES, FORM4_SCHEMA_VERSIONS } from "./constants.js";
export type { EdgarClientOptions } from "./edgar-client.js";
export { EdgarClient } from "./edgar-client.js";
// Error classes
export {
  EdgarFetchError,
  Form4ParseError,
  FormParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "./errors.js";

// Types
export type {
  // Daily index types
  DailyIndexResult,
  DailyIndexRow,
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
  FormType,
  // Utility types
  Logger,
  Result,
  RetryOptions,
  SchemaVersion,
  ValueWithFootnotes,
} from "./types.js";
