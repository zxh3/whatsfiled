/**
 * Type exports for @whatsfiled/edgar-client.
 *
 * Types are organized by domain:
 * - common.ts: Shared utility types (Result, Logger, etc.)
 * - daily-index.ts: Daily index file types
 * - form4.ts: Form 4 specific types
 *
 * When adding a new form type (e.g., Form 3, Form 5, 13-F):
 * 1. Create a new file: form3.ts, form5.ts, or form13f.ts
 * 2. Export types from that file here
 */

// Re-export constants for convenience (actual definitions in ../constants.ts)
export { FORM_TYPES, FORM4_SCHEMA_VERSIONS } from "../constants.js";
// Common utility types
export type {
  Logger,
  Result,
  RetryOptions,
  ValueWithFootnotes,
} from "./common.js";
// Daily index types
export type {
  DailyIndexResult,
  DailyIndexRow,
  FormType,
} from "./daily-index.js";
// Form 4 types
export type {
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
} from "./form4.js";
