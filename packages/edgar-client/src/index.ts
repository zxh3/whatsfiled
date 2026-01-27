// Main export - the EdgarClient class
export { EdgarClient } from "./edgar-client";
export type { EdgarClientOptions } from "./edgar-client";

// Error classes
export {
  EdgarFetchError,
  Form4ParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "./errors";

// Types
export type {
  // Daily index types
  DailyIndexResult,
  DailyIndexRow,
  FormType,

  // Form 4 types
  DocumentType,
  Form4DerivativeEntry,
  Form4DerivativeHolding,
  Form4DerivativeTable,
  Form4DerivativeTransaction,
  Form4Document,
  Form4Issuer,
  Form4NonDerivativeEntry,
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
  Form4XmlUrls,
  RetryOptions,
  SchemaVersion,
  ValueWithFootnotes,
} from "./types";

// Constants
export { KNOWN_FORMS, SUPPORTED_SCHEMA_VERSIONS } from "./types";
