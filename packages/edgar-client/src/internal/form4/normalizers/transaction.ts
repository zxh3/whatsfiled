/**
 * Transaction-related normalization functions.
 */

import type { ValueWithFootnotes } from "../../../types/common";
import type {
  Form4OwnershipNature,
  Form4PostTransactionAmounts,
  Form4TransactionAmounts,
  Form4TransactionCoding,
  Form4UnderlyingSecurity,
} from "../../../types/form4";
import type {
  RawDerivativeTransaction,
  RawNonDerivativeTransaction,
  RawTransactionCoding,
  RawTransactionTimeliness,
} from "../raw-types";
import {
  normalizeAcquiredDisposedCode,
  normalizeBoolean,
  normalizeIsDirect,
  normalizeNumberValue,
  normalizeStringValue,
} from "./primitives";
import {
  extractFootnoteIds,
  normalizeValueWithFootnotes,
} from "./value-with-footnotes";

/**
 * Normalize transaction coding (type and code).
 */
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

/**
 * Normalize transaction amounts (shares, price, etc.).
 */
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

/**
 * Normalize post-transaction amounts (holdings after transaction).
 */
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

/**
 * Normalize ownership nature (direct vs indirect).
 */
export function normalizeOwnershipNature(
  raw: RawNonDerivativeTransaction["ownershipNature"] | undefined,
): Form4OwnershipNature {
  return {
    isDirect: normalizeValueWithFootnotes(
      raw?.directOrIndirectOwnership,
      normalizeIsDirect,
    ),
    natureOfOwnership: normalizeValueWithFootnotes(
      raw?.natureOfOwnership,
      normalizeStringValue,
    ),
  };
}

/**
 * Normalize underlying security for derivatives.
 */
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

/**
 * Normalize transaction timeliness (X0306 and X0407 only).
 */
export function normalizeTransactionTimeliness(
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
