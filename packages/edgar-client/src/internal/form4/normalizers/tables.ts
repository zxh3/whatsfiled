/**
 * Non-derivative and derivative table normalization functions.
 */

import type {
  Form4DerivativeHolding,
  Form4DerivativeTransaction,
  Form4NonDerivativeHolding,
  Form4NonDerivativeTransaction,
  SchemaVersion,
} from "../../../types/form4.js";
import type {
  RawDerivativeHolding,
  RawDerivativeTransaction,
  RawNonDerivativeHolding,
  RawNonDerivativeTransaction,
} from "../raw-types.js";
import {
  normalizeDateValue,
  normalizeNumberValue,
  normalizeRequiredStringValue,
} from "./primitives.js";
import {
  normalizeOwnershipNature,
  normalizePostTransactionAmounts,
  normalizeTransactionAmounts,
  normalizeTransactionCoding,
  normalizeTransactionTimeliness,
  normalizeUnderlyingSecurity,
} from "./transaction.js";
import { normalizeValueWithFootnotes } from "./value-with-footnotes.js";

/**
 * Normalize a non-derivative transaction.
 */
export function normalizeNonDerivativeTransaction(
  raw: RawNonDerivativeTransaction,
  schemaVersion: SchemaVersion,
): Form4NonDerivativeTransaction {
  return {
    securityTitle: normalizeValueWithFootnotes(raw.securityTitle, (v) =>
      normalizeRequiredStringValue(v),
    ),
    transactionDate: normalizeValueWithFootnotes(
      raw.transactionDate,
      normalizeDateValue,
    ),
    // X0306 only - will be null for X0407, X0508, and X0609
    deemedExecutionDate:
      schemaVersion === "X0306"
        ? normalizeValueWithFootnotes(
            raw.deemedExecutionDate,
            normalizeDateValue,
          )
        : null,
    transactionCoding: normalizeTransactionCoding(raw.transactionCoding),
    // X0306 and X0407 only (not X0508 or X0609)
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

/**
 * Normalize a non-derivative holding.
 */
export function normalizeNonDerivativeHolding(
  raw: RawNonDerivativeHolding,
): Form4NonDerivativeHolding {
  return {
    securityTitle: normalizeValueWithFootnotes(raw.securityTitle, (v) =>
      normalizeRequiredStringValue(v),
    ),
    postTransactionAmounts: normalizePostTransactionAmounts(
      raw.postTransactionAmounts,
    ),
    ownershipNature: normalizeOwnershipNature(raw.ownershipNature),
  };
}

/**
 * Normalize a derivative transaction.
 */
export function normalizeDerivativeTransaction(
  raw: RawDerivativeTransaction,
  schemaVersion: SchemaVersion,
): Form4DerivativeTransaction {
  return {
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
    // X0306 and X0407 only (not X0508 or X0609)
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

/**
 * Normalize a derivative holding.
 */
export function normalizeDerivativeHolding(
  raw: RawDerivativeHolding,
): Form4DerivativeHolding {
  return {
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
