import type { Form4Document } from "@whatsfiled/edgar-client";
import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import {
  companies,
  companyTickers,
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
} from "../../db/schema.js";

export interface Form4ToDbOptions {
  /** The raw filing content (for storing in filings.raw_content) */
  rawContent?: string;
  /** The document URL */
  documentUrl?: string;
  /** The actual SEC filing date (from daily index) */
  filedAt?: Date;
}

export interface Form4ToDbResult {
  filingId: string;
  companyId: string;
  insiderIds: string[];
}

/**
 * Maps a parsed Form4Document to database inserts.
 * Performs upserts for companies and insiders to handle duplicates.
 * Creates filing, filing_owners, transactions, holdings, derivatives, and footnotes.
 *
 * All operations are performed within the provided transaction.
 */
export async function mapForm4ToDb(
  tx: Database,
  doc: Form4Document,
  options: Form4ToDbOptions = {},
): Promise<Form4ToDbResult> {
  const { rawContent, documentUrl, filedAt } = options;

  // 1. Upsert company (issuer)
  const companyId = await upsertCompany(tx, doc);

  // 2. Upsert insiders (reporting owners)
  const insiderIds = await upsertInsiders(tx, doc, companyId);

  // 3. Create filing
  const filingId = await createFiling(tx, doc, companyId, {
    rawContent,
    documentUrl,
    filedAt,
  });

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

  // Try to find existing company by CIK
  const existing = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.cik, issuer.cik))
    .limit(1);

  let companyId: string;

  if (existing.length > 0) {
    companyId = existing[0].id;
    // Update name if changed
    await tx
      .update(companies)
      .set({ name: issuer.name, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
  } else {
    // Insert new company
    const [inserted] = await tx
      .insert(companies)
      .values({
        cik: issuer.cik,
        name: issuer.name,
      })
      .returning({ id: companies.id });
    companyId = inserted.id;
  }

  // Upsert ticker if available and valid
  const invalidTickers = ["NONE", "N/A", "NA", ""];
  if (issuer.tradingSymbol && !invalidTickers.includes(issuer.tradingSymbol.trim().toUpperCase())) {
    const ticker = issuer.tradingSymbol.trim().toUpperCase();

    // Check if ticker already exists for this company
    const existingTicker = await tx
      .select({ id: companyTickers.id })
      .from(companyTickers)
      .where(
        and(
          eq(companyTickers.companyId, companyId),
          eq(companyTickers.ticker, ticker)
        )
      )
      .limit(1);

    if (existingTicker.length === 0) {
      // Insert new ticker
      await tx.insert(companyTickers).values({
        companyId,
        ticker,
        isPrimary: true,
      });
    }
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
    // Try to find existing insider by CIK (if provided)
    let insiderId: string | null = null;

    if (owner.id.cik) {
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
    }

    // If no existing insider found, create new one
    if (!insiderId) {
      const [inserted] = await tx
        .insert(insiders)
        .values({
          cik: owner.id.cik || null,
          name: owner.id.name,
          isEntity: false, // Could be improved with heuristics
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
  const existing = await tx
    .select({ id: insiderRoles.id })
    .from(insiderRoles)
    .where(eq(insiderRoles.insiderId, insiderId))
    .limit(1);

  if (existing.length > 0) {
    // Update role flags and last seen
    await tx
      .update(insiderRoles)
      .set({
        isDirector: relationship.isDirector,
        isOfficer: relationship.isOfficer,
        isTenPercentOwner: relationship.isTenPercentOwner,
        isOther: relationship.isOther,
        officerTitle: relationship.officerTitle,
        otherText: relationship.otherText,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(insiderRoles.id, existing[0].id));
  } else {
    // Create new role
    await tx.insert(insiderRoles).values({
      insiderId,
      companyId,
      isDirector: relationship.isDirector,
      isOfficer: relationship.isOfficer,
      isTenPercentOwner: relationship.isTenPercentOwner,
      isOther: relationship.isOther,
      officerTitle: relationship.officerTitle,
      otherText: relationship.otherText,
    });
  }
}

async function createFiling(
  tx: Database,
  doc: Form4Document,
  companyId: string,
  options: { rawContent?: string; documentUrl?: string; filedAt?: Date },
): Promise<string> {
  // Extract accession number from source or generate from document info
  const accessionNumber = doc.source?.fileName
    ? extractAccessionNumber(doc.source.fileName)
    : `${doc.issuer.cik}-${Date.now()}`;

  const formType = doc.documentType as (typeof formTypeEnum.enumValues)[number];

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
    .returning({ id: filings.id });

  return inserted.id;
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
  for (let i = 0; i < doc.reportingOwners.length; i++) {
    const owner = doc.reportingOwners[i];
    const insiderId = insiderIds[i];

    await tx.insert(filingOwners).values({
      filingId,
      insiderId,
      isDirector: owner.relationship.isDirector,
      isOfficer: owner.relationship.isOfficer,
      isTenPercentOwner: owner.relationship.isTenPercentOwner,
      isOther: owner.relationship.isOther,
      officerTitle: owner.relationship.officerTitle,
      otherText: owner.relationship.otherText,
    });
  }
}

async function createNonDerivativeRecords(
  tx: Database,
  filingId: string,
  doc: Form4Document,
): Promise<void> {
  // Create non-derivative transactions
  for (const txn of doc.nonDerivativeTable.transactions) {
    await tx.insert(transactions).values({
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
      ownershipType: txn.ownershipNature.isDirect.value ? "D" : "I",
      indirectNature: txn.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectFootnoteIds(txn),
    });
  }

  // Create non-derivative holdings
  for (const holding of doc.nonDerivativeTable.holdings) {
    await tx.insert(holdings).values({
      filingId,
      securityTitle: holding.securityTitle.value,
      sharesOwned:
        holding.postTransactionAmounts.sharesOwned.value?.toString() ?? null,
      ownershipType: holding.ownershipNature.isDirect.value ? "D" : "I",
      indirectNature: holding.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectHoldingFootnoteIds(holding),
    });
  }
}

async function createDerivativeRecords(
  tx: Database,
  filingId: string,
  doc: Form4Document,
): Promise<void> {
  // Create derivative transactions
  for (const txn of doc.derivativeTable.transactions) {
    await tx.insert(derivativeTransactions).values({
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
      ownershipType: txn.ownershipNature.isDirect.value ? "D" : "I",
      indirectNature: txn.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectDerivativeFootnoteIds(txn),
    });
  }

  // Create derivative holdings
  for (const holding of doc.derivativeTable.holdings) {
    await tx.insert(derivativeHoldings).values({
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
      ownershipType: holding.ownershipNature.isDirect.value ? "D" : "I",
      indirectNature: holding.ownershipNature.natureOfOwnership.value,
      footnoteIds: collectDerivativeHoldingFootnoteIds(holding),
    });
  }
}

async function createFootnotes(
  tx: Database,
  filingId: string,
  doc: Form4Document,
): Promise<void> {
  for (const [footnoteId, content] of Object.entries(doc.footnotes)) {
    await tx
      .insert(footnotes)
      .values({
        filingId,
        footnoteId,
        content: content as string,
      })
      .onConflictDoNothing();
  }
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
