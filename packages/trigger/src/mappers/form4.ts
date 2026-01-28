import {
  companies,
  companyTickers,
  type Database,
  derivativeHoldings,
  derivativeTransactions,
  filingOwners,
  filings,
  footnotes,
  type formTypeEnum,
  holdings,
  insiderRoles,
  insiders,
  transactions,
} from "@whatsfiled/db";
import type { Form4Document } from "@whatsfiled/edgar-client";
import { and, eq } from "drizzle-orm";
import type { Form4ToDbOptions, Form4ToDbResult } from "./types.js";

/**
 * Maps a parsed Form4Document to database inserts.
 * Performs upserts for companies and insiders to handle duplicates.
 * Creates filing, filing_owners, transactions, holdings, derivatives, and footnotes.
 *
 * All operations are performed within the provided transaction.
 * Idempotent: if the filing already exists, returns early with skipped=true.
 */
export async function mapForm4ToDb(
  tx: Database,
  doc: Form4Document,
  options: Form4ToDbOptions = {},
): Promise<Form4ToDbResult> {
  const { rawContent, documentUrl, filedAt } = options;

  // 1. Upsert company (issuer) - always safe to run
  const companyId = await upsertCompany(tx, doc);

  // 2. Upsert insiders (reporting owners) - always safe to run
  const insiderIds = await upsertInsiders(tx, doc, companyId);

  // 3. Create filing (atomic with onConflictDoNothing)
  const { filingId, alreadyExists } = await createFiling(tx, doc, companyId, {
    rawContent,
    documentUrl,
    filedAt,
  });

  // If filing already exists, skip creating related records
  // (they were already created in the previous run)
  if (alreadyExists) {
    return { filingId, companyId, insiderIds, skipped: true };
  }

  // 4. Create filing owners (link filing to insiders)
  await createFilingOwners(tx, filingId, doc, insiderIds);

  // 5. Create transactions and holdings
  await createNonDerivativeRecords(tx, filingId, doc);
  await createDerivativeRecords(tx, filingId, doc);

  // 6. Create footnotes
  await createFootnotes(tx, filingId, doc);

  return { filingId, companyId, insiderIds };
}

async function upsertCompany(
  tx: Database,
  doc: Form4Document,
): Promise<string> {
  const { issuer } = doc;

  // Single query upsert using ON CONFLICT DO UPDATE RETURNING
  const [result] = await tx
    .insert(companies)
    .values({
      cik: issuer.cik,
      name: issuer.name,
    })
    .onConflictDoUpdate({
      target: companies.cik,
      set: { name: issuer.name, updatedAt: new Date() },
    })
    .returning({ id: companies.id });

  const companyId = result.id;

  // Upsert ticker if available and valid (single query with ON CONFLICT DO NOTHING)
  const invalidTickers = ["NONE", "N/A", "NA", ""];
  if (
    issuer.tradingSymbol &&
    !invalidTickers.includes(issuer.tradingSymbol.trim().toUpperCase())
  ) {
    const ticker = issuer.tradingSymbol.trim().toUpperCase();
    await tx
      .insert(companyTickers)
      .values({
        companyId,
        ticker,
        isPrimary: true,
      })
      .onConflictDoNothing();
  }

  return companyId;
}

async function upsertInsiders(
  tx: Database,
  doc: Form4Document,
  companyId: string,
): Promise<string[]> {
  const insiderIds: string[] = [];

  for (const owner of doc.reportingOwners) {
    let insiderId: string | null = null;

    if (owner.id.cik) {
      // Find by CIK (globally unique identifier)
      // Note: Can't use ON CONFLICT because insiders.cik has a PARTIAL unique index (WHERE cik IS NOT NULL)
      // PostgreSQL doesn't match partial indexes with ON CONFLICT (column) syntax
      const existing = await tx
        .select({ id: insiders.id })
        .from(insiders)
        .where(eq(insiders.cik, owner.id.cik))
        .limit(1);

      if (existing.length > 0) {
        insiderId = existing[0].id;
        // Update name if changed
        await tx
          .update(insiders)
          .set({ name: owner.id.name, updatedAt: new Date() })
          .where(eq(insiders.id, insiderId));
      }
    } else {
      // Fallback for insiders without CIK: find by name + existing role at this company
      // This prevents creating duplicates when re-processing filings
      const existingByName = await tx
        .select({ id: insiders.id })
        .from(insiders)
        .innerJoin(insiderRoles, eq(insiders.id, insiderRoles.insiderId))
        .where(
          and(
            eq(insiders.name, owner.id.name),
            eq(insiderRoles.companyId, companyId),
          ),
        )
        .limit(1);

      if (existingByName.length > 0) {
        insiderId = existingByName[0].id;
      }
    }

    // If no existing insider found, create new one
    if (!insiderId) {
      const [inserted] = await tx
        .insert(insiders)
        .values({
          cik: owner.id.cik || null,
          name: owner.id.name,
          isEntity: false,
        })
        .returning({ id: insiders.id });
      insiderId = inserted.id;
    }

    insiderIds.push(insiderId);

    // Upsert insider role (relationship between insider and company)
    await upsertInsiderRole(tx, insiderId, companyId, owner.relationship);
  }

  return insiderIds;
}

async function upsertInsiderRole(
  tx: Database,
  insiderId: string,
  companyId: string,
  relationship: Form4Document["reportingOwners"][0]["relationship"],
): Promise<void> {
  // Single query upsert using ON CONFLICT DO UPDATE
  await tx
    .insert(insiderRoles)
    .values({
      insiderId,
      companyId,
      isDirector: relationship.isDirector,
      isOfficer: relationship.isOfficer,
      isTenPercentOwner: relationship.isTenPercentOwner,
      isOther: relationship.isOther,
      officerTitle: relationship.officerTitle,
      otherText: relationship.otherText,
    })
    .onConflictDoUpdate({
      target: [insiderRoles.insiderId, insiderRoles.companyId],
      set: {
        isDirector: relationship.isDirector,
        isOfficer: relationship.isOfficer,
        isTenPercentOwner: relationship.isTenPercentOwner,
        isOther: relationship.isOther,
        officerTitle: relationship.officerTitle,
        otherText: relationship.otherText,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

interface CreateFilingResult {
  filingId: string;
  alreadyExists: boolean;
}

async function createFiling(
  tx: Database,
  doc: Form4Document,
  companyId: string,
  options: { rawContent?: string; documentUrl?: string; filedAt?: Date },
): Promise<CreateFilingResult> {
  // Extract accession number from source or generate from document info
  const accessionNumber = doc.source?.fileName
    ? extractAccessionNumber(doc.source.fileName)
    : `${doc.issuer.cik}-${Date.now()}`;

  const formType = doc.documentType as (typeof formTypeEnum.enumValues)[number];

  // Use onConflictDoNothing for atomic idempotency - prevents race conditions
  const [inserted] = await tx
    .insert(filings)
    .values({
      accessionNumber,
      formType,
      companyId,
      filedAt: options.filedAt ?? new Date(),
      periodOfReport: normalizeDate(doc.periodOfReport),
      schemaVersion: doc.schemaVersion,
      isAmendment: doc.documentType === "4/A",
      amendmentType: doc.documentType === "4/A" ? "amendment" : null,
      documentUrl: options.documentUrl ?? doc.source?.formattedXmlUrl ?? null,
      rawContent: options.rawContent,
      processedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: filings.id });

  if (inserted) {
    return { filingId: inserted.id, alreadyExists: false };
  }

  // Filing already exists - fetch the existing id
  const [existing] = await tx
    .select({ id: filings.id })
    .from(filings)
    .where(eq(filings.accessionNumber, accessionNumber))
    .limit(1);

  return { filingId: existing.id, alreadyExists: true };
}

function extractAccessionNumber(fileName: string): string {
  // e.g., "edgar/data/123/0001234567-24-000001.txt" -> "0001234567-24-000001"
  const match = fileName.match(/(\d{10}-\d{2}-\d{6})/);
  return match ? match[1] : fileName;
}

/**
 * Normalize SEC date string for PostgreSQL date column.
 * SEC formats: "2026-01-05" or "2026-01-05-05:00" (with timezone offset)
 * PostgreSQL date type needs format "YYYY-MM-DD".
 */
function normalizeDate(dateStr: string): string;
function normalizeDate(dateStr: string | null | undefined): string | null;
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Strip timezone offset if present (e.g., "2026-01-05-05:00" -> "2026-01-05")
  return dateStr.replace(/-\d{2}:\d{2}$/, "");
}

async function createFilingOwners(
  tx: Database,
  filingId: string,
  doc: Form4Document,
  insiderIds: string[],
): Promise<void> {
  if (doc.reportingOwners.length === 0) return;

  const values = doc.reportingOwners.map((owner, i) => ({
    filingId,
    insiderId: insiderIds[i],
    isDirector: owner.relationship.isDirector,
    isOfficer: owner.relationship.isOfficer,
    isTenPercentOwner: owner.relationship.isTenPercentOwner,
    isOther: owner.relationship.isOther,
    officerTitle: owner.relationship.officerTitle,
    otherText: owner.relationship.otherText,
  }));

  await tx.insert(filingOwners).values(values);
}

async function createNonDerivativeRecords(
  tx: Database,
  filingId: string,
  doc: Form4Document,
): Promise<void> {
  // Batch insert non-derivative transactions
  if (doc.nonDerivativeTable.transactions.length > 0) {
    const txnValues = doc.nonDerivativeTable.transactions.map((txn) => ({
      filingId,
      securityTitle: txn.securityTitle.value,
      transactionDate: normalizeDate(txn.transactionDate.value),
      deemedExecutionDate: normalizeDate(txn.deemedExecutionDate?.value),
      transactionCode: txn.transactionCoding.code,
      equitySwap: txn.transactionCoding.equitySwapInvolved,
      shares: txn.amounts.shares.value?.toString() ?? null,
      pricePerShare: txn.amounts.pricePerShare.value?.toString() ?? null,
      totalValue: txn.amounts.totalValue.value?.toString() ?? null,
      acquiredDisposed: txn.amounts.acquiredDisposedCode.value,
      sharesOwnedAfter:
        txn.postTransactionAmounts.sharesOwned.value?.toString() ?? null,
      ownershipType: (txn.ownershipNature.isDirect.value ? "D" : "I") as
        | "D"
        | "I",
      indirectNature: txn.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectFootnoteIds(txn),
    }));
    await tx.insert(transactions).values(txnValues);
  }

  // Batch insert non-derivative holdings
  if (doc.nonDerivativeTable.holdings.length > 0) {
    const holdingValues = doc.nonDerivativeTable.holdings.map((holding) => ({
      filingId,
      securityTitle: holding.securityTitle.value,
      sharesOwned:
        holding.postTransactionAmounts.sharesOwned.value?.toString() ?? null,
      ownershipType: (holding.ownershipNature.isDirect.value ? "D" : "I") as
        | "D"
        | "I",
      indirectNature: holding.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectHoldingFootnoteIds(holding),
    }));
    await tx.insert(holdings).values(holdingValues);
  }
}

async function createDerivativeRecords(
  tx: Database,
  filingId: string,
  doc: Form4Document,
): Promise<void> {
  // Batch insert derivative transactions
  if (doc.derivativeTable.transactions.length > 0) {
    const txnValues = doc.derivativeTable.transactions.map((txn) => ({
      filingId,
      securityTitle: txn.securityTitle.value,
      conversionOrExercisePrice:
        txn.conversionOrExercisePrice.value?.toString() ?? null,
      transactionDate: normalizeDate(txn.transactionDate.value),
      deemedExecutionDate: normalizeDate(txn.deemedExecutionDate?.value),
      transactionCode: txn.transactionCoding.code,
      equitySwap: txn.transactionCoding.equitySwapInvolved,
      shares: txn.amounts.shares.value?.toString() ?? null,
      pricePerShare: txn.amounts.pricePerShare.value?.toString() ?? null,
      totalValue: txn.amounts.totalValue.value?.toString() ?? null,
      acquiredDisposed: txn.amounts.acquiredDisposedCode.value,
      exercisableDate: normalizeDate(txn.exerciseDate.value),
      expirationDate: normalizeDate(txn.expirationDate.value),
      underlyingSecurityTitle: txn.underlyingSecurity.title.value,
      underlyingShares: txn.underlyingSecurity.shares.value?.toString() ?? null,
      sharesOwnedAfter:
        txn.postTransactionAmounts.sharesOwned.value?.toString() ?? null,
      ownershipType: (txn.ownershipNature.isDirect.value ? "D" : "I") as
        | "D"
        | "I",
      indirectNature: txn.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectDerivativeFootnoteIds(txn),
    }));
    await tx.insert(derivativeTransactions).values(txnValues);
  }

  // Batch insert derivative holdings
  if (doc.derivativeTable.holdings.length > 0) {
    const holdingValues = doc.derivativeTable.holdings.map((holding) => ({
      filingId,
      securityTitle: holding.securityTitle.value,
      conversionOrExercisePrice:
        holding.conversionOrExercisePrice.value?.toString() ?? null,
      exercisableDate: normalizeDate(holding.exerciseDate.value),
      expirationDate: normalizeDate(holding.expirationDate.value),
      underlyingSecurityTitle: holding.underlyingSecurity.title.value,
      underlyingShares:
        holding.underlyingSecurity.shares.value?.toString() ?? null,
      sharesOwned:
        holding.postTransactionAmounts.sharesOwned.value?.toString() ?? null,
      ownershipType: (holding.ownershipNature.isDirect.value ? "D" : "I") as
        | "D"
        | "I",
      indirectNature: holding.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectDerivativeHoldingFootnoteIds(holding),
    }));
    await tx.insert(derivativeHoldings).values(holdingValues);
  }
}

async function createFootnotes(
  tx: Database,
  filingId: string,
  doc: Form4Document,
): Promise<void> {
  const footnoteEntries = Object.entries(doc.footnotes);
  if (footnoteEntries.length === 0) return;

  const values = footnoteEntries.map(([footnoteId, content]) => ({
    filingId,
    footnoteId,
    content: content as string,
  }));

  await tx.insert(footnotes).values(values).onConflictDoNothing();
}

// Helper functions to collect footnote IDs from various fields
function collectFootnoteIds(
  txn: Form4Document["nonDerivativeTable"]["transactions"][0],
): string[] {
  const ids: string[] = [];
  ids.push(...txn.securityTitle.footnoteIds);
  ids.push(...txn.transactionDate.footnoteIds);
  ids.push(...txn.transactionCoding.footnoteIds);
  ids.push(...txn.amounts.shares.footnoteIds);
  ids.push(...txn.amounts.pricePerShare.footnoteIds);
  ids.push(...txn.amounts.acquiredDisposedCode.footnoteIds);
  ids.push(...txn.postTransactionAmounts.sharesOwned.footnoteIds);
  ids.push(...txn.ownershipNature.isDirect.footnoteIds);
  ids.push(...txn.ownershipNature.natureOfOwnership.footnoteIds);
  return [...new Set(ids)];
}

function collectHoldingFootnoteIds(
  holding: Form4Document["nonDerivativeTable"]["holdings"][0],
): string[] {
  const ids: string[] = [];
  ids.push(...holding.securityTitle.footnoteIds);
  ids.push(...holding.postTransactionAmounts.sharesOwned.footnoteIds);
  ids.push(...holding.ownershipNature.isDirect.footnoteIds);
  ids.push(...holding.ownershipNature.natureOfOwnership.footnoteIds);
  return [...new Set(ids)];
}

function collectDerivativeFootnoteIds(
  txn: Form4Document["derivativeTable"]["transactions"][0],
): string[] {
  const ids: string[] = [];
  ids.push(...txn.securityTitle.footnoteIds);
  ids.push(...txn.conversionOrExercisePrice.footnoteIds);
  ids.push(...txn.transactionDate.footnoteIds);
  ids.push(...txn.transactionCoding.footnoteIds);
  ids.push(...txn.amounts.shares.footnoteIds);
  ids.push(...txn.amounts.pricePerShare.footnoteIds);
  ids.push(...txn.exerciseDate.footnoteIds);
  ids.push(...txn.expirationDate.footnoteIds);
  ids.push(...txn.underlyingSecurity.title.footnoteIds);
  ids.push(...txn.underlyingSecurity.shares.footnoteIds);
  ids.push(...txn.postTransactionAmounts.sharesOwned.footnoteIds);
  ids.push(...txn.ownershipNature.isDirect.footnoteIds);
  return [...new Set(ids)];
}

function collectDerivativeHoldingFootnoteIds(
  holding: Form4Document["derivativeTable"]["holdings"][0],
): string[] {
  const ids: string[] = [];
  ids.push(...holding.securityTitle.footnoteIds);
  ids.push(...holding.conversionOrExercisePrice.footnoteIds);
  ids.push(...holding.exerciseDate.footnoteIds);
  ids.push(...holding.expirationDate.footnoteIds);
  ids.push(...holding.underlyingSecurity.title.footnoteIds);
  ids.push(...holding.underlyingSecurity.shares.footnoteIds);
  ids.push(...holding.postTransactionAmounts.sharesOwned.footnoteIds);
  ids.push(...holding.ownershipNature.isDirect.footnoteIds);
  return [...new Set(ids)];
}
