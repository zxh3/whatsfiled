import {
  companies,
  companyTickers,
  filingOwners,
  filings,
  holdings,
  insiderRoles,
  insiders,
  transactions,
} from "@whatsfiled/db/schema";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../init.js";

export const companiesRouter = router({
  getByCik: publicProcedure
    .input(
      z.object({
        cik: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const cikCandidates = buildCikCandidates(input.cik);
      const company = await db
        .select({
          id: companies.id,
          name: companies.name,
          cik: companies.cik,
        })
        .from(companies)
        .where(inArray(companies.cik, cikCandidates))
        .limit(1);

      if (company.length === 0) {
        return null;
      }

      const ticker = await db
        .select({ ticker: companyTickers.ticker })
        .from(companyTickers)
        .where(eq(companyTickers.companyId, company[0].id))
        .limit(1);

      const recentFilings = await db
        .select({
          id: filings.id,
          accessionNumber: filings.accessionNumber,
          formType: filings.formType,
          filedAt: filings.filedAt,
          periodOfReport: filings.periodOfReport,
          isAmendment: filings.isAmendment,
          documentUrl: filings.documentUrl,
          companyId: filings.companyId,
          companyName: companies.name,
          companyCik: companies.cik,
        })
        .from(filings)
        .innerJoin(companies, eq(filings.companyId, companies.id))
        .where(eq(filings.companyId, company[0].id))
        .orderBy(desc(filings.filedAt), desc(filings.createdAt))
        .limit(input.limit);

      const roster = await db
        .select({
          insiderId: insiders.id,
          insiderName: insiders.name,
          insiderCik: insiders.cik,
          isDirector: insiderRoles.isDirector,
          isOfficer: insiderRoles.isOfficer,
          isTenPercentOwner: insiderRoles.isTenPercentOwner,
          isOther: insiderRoles.isOther,
          officerTitle: insiderRoles.officerTitle,
          otherText: insiderRoles.otherText,
          lastSeenAt: insiderRoles.lastSeenAt,
        })
        .from(insiderRoles)
        .innerJoin(insiders, eq(insiderRoles.insiderId, insiders.id))
        .where(eq(insiderRoles.companyId, company[0].id))
        .orderBy(desc(insiderRoles.lastSeenAt), insiders.name);

      // Batch fetch all related data for filings (3 queries instead of 100-150)
      const filingIds = recentFilings.map((f) => f.id);

      const [allOwners, allSummaries, allMixedTransactions] =
        filingIds.length > 0
          ? await Promise.all([
              // Batch fetch owners
              db
                .select({
                  filingId: filingOwners.filingId,
                  insiderId: insiders.id,
                  insiderName: insiders.name,
                  insiderCik: insiders.cik,
                  isDirector: filingOwners.isDirector,
                  isOfficer: filingOwners.isOfficer,
                  isTenPercentOwner: filingOwners.isTenPercentOwner,
                  officerTitle: filingOwners.officerTitle,
                })
                .from(filingOwners)
                .innerJoin(insiders, eq(filingOwners.insiderId, insiders.id))
                .where(inArray(filingOwners.filingId, filingIds)),

              // Batch fetch transaction summaries
              db
                .select({
                  filingId: transactions.filingId,
                  totalAcquired: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'A' THEN shares ELSE 0 END), 0)`,
                  totalDisposed: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'D' THEN shares ELSE 0 END), 0)`,
                  totalAcquiredValue: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'A' THEN shares * price_per_share ELSE 0 END), 0)`,
                  totalDisposedValue: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'D' THEN shares * price_per_share ELSE 0 END), 0)`,
                  avgPrice: sql<string>`COALESCE(AVG(price_per_share), 0)`,
                  sharesOwnedAfter: sql<string>`MAX(shares_owned_after)`,
                })
                .from(transactions)
                .where(inArray(transactions.filingId, filingIds))
                .groupBy(transactions.filingId),

              // Batch fetch all transactions for potential mixed filings
              db
                .select({
                  filingId: transactions.filingId,
                  transactionDate: transactions.transactionDate,
                  transactionCode: transactions.transactionCode,
                  acquiredDisposed: transactions.acquiredDisposed,
                  shares: transactions.shares,
                  pricePerShare: transactions.pricePerShare,
                })
                .from(transactions)
                .where(
                  and(
                    inArray(transactions.filingId, filingIds),
                    lte(transactions.transactionDate, sql`CURRENT_DATE`),
                  ),
                )
                .orderBy(transactions.transactionDate),
            ])
          : [[], [], []];

      // Create lookup Maps
      const ownersByFiling = new Map<
        string,
        Array<{
          insiderId: string;
          insiderName: string;
          insiderCik: string | null;
          isDirector: boolean;
          isOfficer: boolean;
          isTenPercentOwner: boolean;
          officerTitle: string | null;
        }>
      >();
      for (const owner of allOwners) {
        const list = ownersByFiling.get(owner.filingId) ?? [];
        list.push(owner);
        ownersByFiling.set(owner.filingId, list);
      }

      const summaryByFiling = new Map<
        string,
        {
          totalAcquired: string;
          totalDisposed: string;
          totalAcquiredValue: string;
          totalDisposedValue: string;
          avgPrice: string;
          sharesOwnedAfter: string;
        }
      >();
      for (const summary of allSummaries) {
        summaryByFiling.set(summary.filingId, summary);
      }

      const transactionsByFiling = new Map<
        string,
        Array<{
          transactionDate: string | null;
          transactionCode: string | null;
          acquiredDisposed: "A" | "D" | null;
          shares: string | null;
          pricePerShare: string | null;
        }>
      >();
      for (const txn of allMixedTransactions) {
        const list = transactionsByFiling.get(txn.filingId) ?? [];
        list.push(txn);
        transactionsByFiling.set(txn.filingId, list);
      }

      // Assemble response using Maps (no additional queries)
      const companyTicker = ticker[0]?.ticker || null;
      const filingsWithDetails = recentFilings.map((filing) => {
        const owners = ownersByFiling.get(filing.id) ?? [];
        const summary = summaryByFiling.get(filing.id);

        const sharesOwnedAfter = parseFloat(summary?.sharesOwnedAfter || "0");
        const totalAcquired = parseFloat(summary?.totalAcquired || "0");
        const totalDisposed = parseFloat(summary?.totalDisposed || "0");
        const netChange = totalAcquired - totalDisposed;
        const sharesOwnedBefore = sharesOwnedAfter - netChange;

        let ownershipChangePercent: number | null = null;
        if (sharesOwnedBefore > 0) {
          ownershipChangePercent = (netChange / sharesOwnedBefore) * 100;
        } else if (netChange > 0) {
          ownershipChangePercent = 100;
        }

        let transactionType: "buy" | "sell" | "mixed" | "none" = "none";
        if (totalAcquired > 0 && totalDisposed > 0) {
          transactionType = "mixed";
        } else if (totalAcquired > 0) {
          transactionType = "buy";
        } else if (totalDisposed > 0) {
          transactionType = "sell";
        }

        let mixedTransactions: Array<{
          transactionDate: string | null;
          transactionCode: string | null;
          acquiredDisposed: "A" | "D" | null;
          shares: number | null;
          pricePerShare: number | null;
        }> | null = null;

        if (transactionType === "mixed") {
          const txns = transactionsByFiling.get(filing.id) ?? [];
          mixedTransactions = txns.map((row) => ({
            transactionDate: row.transactionDate,
            transactionCode: row.transactionCode ?? null,
            acquiredDisposed: row.acquiredDisposed ?? null,
            shares: row.shares ? Number(row.shares) : null,
            pricePerShare: row.pricePerShare ? Number(row.pricePerShare) : null,
          }));
        }

        return {
          id: filing.id,
          accessionNumber: filing.accessionNumber,
          formType: filing.formType,
          filedAt: filing.filedAt,
          periodOfReport: filing.periodOfReport,
          isAmendment: filing.isAmendment,
          documentUrl: filing.documentUrl,
          company: {
            id: filing.companyId,
            name: filing.companyName,
            cik: filing.companyCik,
            ticker: companyTicker,
          },
          owners: owners.map((o) => ({
            id: o.insiderId,
            name: o.insiderName,
            cik: o.insiderCik,
            title: o.officerTitle || getOwnerRole(o),
          })),
          summary: {
            transactionType,
            totalAcquired: parseFloat(summary?.totalAcquired || "0"),
            totalDisposed: parseFloat(summary?.totalDisposed || "0"),
            totalAcquiredValue: parseFloat(summary?.totalAcquiredValue || "0"),
            totalDisposedValue: parseFloat(summary?.totalDisposedValue || "0"),
            avgPrice: parseFloat(summary?.avgPrice || "0"),
            sharesOwnedAfter,
            ownershipChangePercent,
          },
          transactions: mixedTransactions,
        };
      });

      return {
        company: {
          ...company[0],
          ticker: ticker[0]?.ticker || null,
        },
        roster: roster.map((entry) => ({
          id: entry.insiderId,
          name: entry.insiderName,
          cik: entry.insiderCik,
          title: entry.officerTitle || getOwnerRole(entry),
          isDirector: entry.isDirector,
          isOfficer: entry.isOfficer,
          isTenPercentOwner: entry.isTenPercentOwner,
          otherText: entry.otherText,
          lastSeenAt: entry.lastSeenAt,
        })),
        filings: filingsWithDetails,
      };
    }),

  getTransactions: publicProcedure
    .input(
      z.object({
        cik: z.string().min(1),
        filter: z.enum(["common", "options"]).default("common"),
        direction: z.enum(["all", "buy", "sell"]).default("all"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const cikCandidates = buildCikCandidates(input.cik);

      // Find the company
      const company = await db
        .select({
          id: companies.id,
          name: companies.name,
          cik: companies.cik,
        })
        .from(companies)
        .where(inArray(companies.cik, cikCandidates))
        .limit(1);

      if (company.length === 0) {
        return null;
      }

      const companyId = company[0].id;

      // Get ticker
      const ticker = await db
        .select({ ticker: companyTickers.ticker })
        .from(companyTickers)
        .where(eq(companyTickers.companyId, companyId))
        .limit(1);

      const offset = (input.page - 1) * input.pageSize;
      const codes =
        input.filter === "common" ? ["P", "S"] : ["M", "A", "F", "G", "C"];
      const whereClause = and(
        eq(filings.companyId, companyId),
        inArray(transactions.transactionCode, codes),
        lte(transactions.transactionDate, sql`CURRENT_DATE`),
      );

      const aggregateBase = db
        .select({
          id: filings.id,
          accessionNumber: filings.accessionNumber,
          filedAt: filings.filedAt,
          createdAt: filings.createdAt,
          totalAcquired: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} ELSE 0 END), 0)`,
          totalDisposed: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} ELSE 0 END), 0)`,
          totalAcquiredValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END), 0)`,
          totalDisposedValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END), 0)`,
          avgPricePerShare: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.pricePerShare} IS NOT NULL AND ${transactions.shares} IS NOT NULL THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${transactions.pricePerShare} IS NOT NULL AND ${transactions.shares} IS NOT NULL THEN ${transactions.shares} ELSE 0 END), 0), 0)`,
          transactionCount: sql<number>`count(*)::int`,
        })
        .from(filings)
        .innerJoin(transactions, eq(transactions.filingId, filings.id))
        .where(whereClause)
        .groupBy(
          filings.id,
          filings.accessionNumber,
          filings.filedAt,
          filings.createdAt,
        );

      const aggregateQuery =
        input.direction === "buy"
          ? aggregateBase.having(
              sql`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} ELSE 0 END), 0) > COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} ELSE 0 END), 0)`,
            )
          : input.direction === "sell"
            ? aggregateBase.having(
                sql`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} ELSE 0 END), 0) < COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} ELSE 0 END), 0)`,
              )
            : aggregateBase;

      const aggregateSubquery = aggregateQuery.as("company_filing_agg");
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aggregateSubquery);
      const totalCount = countRow?.count ?? 0;
      const totalPages = Math.ceil(totalCount / input.pageSize);

      const pagedRows = await aggregateQuery
        .orderBy(
          desc(filings.filedAt),
          desc(filings.createdAt),
          desc(filings.id),
        )
        .limit(input.pageSize)
        .offset(offset);
      const filingIds = pagedRows.map((row) => row.id);

      const [ownerRows, ownedRows, holdingRows] =
        filingIds.length > 0
          ? await Promise.all([
              db
                .select({
                  filingId: filingOwners.filingId,
                  insiderId: insiders.id,
                  insiderName: insiders.name,
                  insiderCik: insiders.cik,
                  officerTitle: filingOwners.officerTitle,
                  isDirector: filingOwners.isDirector,
                  isOfficer: filingOwners.isOfficer,
                  isTenPercentOwner: filingOwners.isTenPercentOwner,
                })
                .from(filingOwners)
                .innerJoin(insiders, eq(filingOwners.insiderId, insiders.id))
                .where(inArray(filingOwners.filingId, filingIds)),
              db
                .select({
                  filingId: transactions.filingId,
                  securityTitle: transactions.securityTitle,
                  ownershipType: transactions.ownershipType,
                  indirectNature: transactions.indirectNature,
                  sequence: transactions.sequence,
                  sharesOwnedAfter: transactions.sharesOwnedAfter,
                })
                .from(transactions)
                .where(
                  and(
                    inArray(transactions.filingId, filingIds),
                    lte(transactions.transactionDate, sql`CURRENT_DATE`),
                  ),
                ),
              db
                .select({
                  filingId: holdings.filingId,
                  securityTitle: holdings.securityTitle,
                  ownershipType: holdings.ownershipType,
                  indirectNature: holdings.indirectNature,
                  sharesOwned: holdings.sharesOwned,
                })
                .from(holdings)
                .where(inArray(holdings.filingId, filingIds)),
            ])
          : [[], [], []];

      const ownersByFiling = new Map<
        string,
        Array<{
          id: string;
          name: string;
          cik: string | null;
          title: string;
        }>
      >();
      for (const owner of ownerRows) {
        const list = ownersByFiling.get(owner.filingId) ?? [];
        list.push({
          id: owner.insiderId,
          name: owner.insiderName,
          cik: owner.insiderCik,
          title:
            owner.officerTitle ||
            getOwnerRole({
              isDirector: owner.isDirector,
              isOfficer: owner.isOfficer,
              isTenPercentOwner: owner.isTenPercentOwner,
            }),
        });
        ownersByFiling.set(owner.filingId, list);
      }

      const toOwnershipKey = (
        securityTitle: string | null | undefined,
        ownershipType: string | null | undefined,
        indirectNature: string | null | undefined,
      ): string =>
        `${securityTitle ?? ""}|${ownershipType ?? ""}|${indirectNature ?? ""}`;

      const txOwnedByFiling = new Map<
        string,
        Map<string, { sharesOwned: number; sequence: number }>
      >();
      for (const row of ownedRows) {
        const sharesOwned = row.sharesOwnedAfter
          ? Number(row.sharesOwnedAfter)
          : NaN;
        if (!Number.isFinite(sharesOwned)) continue;

        const filingMap =
          txOwnedByFiling.get(row.filingId) ??
          new Map<string, { sharesOwned: number; sequence: number }>();
        const key = toOwnershipKey(
          row.securityTitle,
          row.ownershipType,
          row.indirectNature,
        );
        const sequence = row.sequence ?? 0;
        const existing = filingMap.get(key);
        if (!existing || sequence >= existing.sequence) {
          filingMap.set(key, { sharesOwned, sequence });
        }
        txOwnedByFiling.set(row.filingId, filingMap);
      }

      const holdingRowsByFiling = new Map<
        string,
        Array<{
          securityTitle: string;
          ownershipType: string | null;
          indirectNature: string | null;
          sharesOwned: string | null;
        }>
      >();
      for (const row of holdingRows) {
        const list = holdingRowsByFiling.get(row.filingId) ?? [];
        list.push(row);
        holdingRowsByFiling.set(row.filingId, list);
      }

      const totalOwnedByFiling = new Map<string, number>();
      for (const filingId of filingIds) {
        const txMap = txOwnedByFiling.get(filingId) ?? new Map();
        let totalOwned = 0;

        for (const value of txMap.values()) {
          totalOwned += value.sharesOwned;
        }

        const holdingList = holdingRowsByFiling.get(filingId) ?? [];
        for (const row of holdingList) {
          const key = toOwnershipKey(
            row.securityTitle,
            row.ownershipType,
            row.indirectNature,
          );
          if (txMap.has(key)) continue;
          const sharesOwned = row.sharesOwned ? Number(row.sharesOwned) : NaN;
          if (!Number.isFinite(sharesOwned)) continue;
          totalOwned += sharesOwned;
        }

        totalOwnedByFiling.set(filingId, totalOwned);
      }

      const filingsWithSummary = pagedRows.map((row) => {
        const totalAcquired = Number(row.totalAcquired ?? "0");
        const totalDisposed = Number(row.totalDisposed ?? "0");
        const netShares = totalAcquired - totalDisposed;
        const totalAcquiredValue = Number(row.totalAcquiredValue ?? "0");
        const totalDisposedValue = Number(row.totalDisposedValue ?? "0");
        const avgPricePerShare = Number(row.avgPricePerShare ?? "0");
        const sharesOwnedAfter = totalOwnedByFiling.get(row.id) ?? 0;
        const sharesOwnedBefore = sharesOwnedAfter - netShares;
        let ownershipChangePercent: number | null = null;
        if (sharesOwnedBefore > 0) {
          ownershipChangePercent = (netShares / sharesOwnedBefore) * 100;
        } else if (netShares > 0) {
          ownershipChangePercent = 100;
        }

        let transactionType: "buy" | "sell" | "mixed" | "none" = "none";
        if (totalAcquired > 0 && totalDisposed > 0) {
          transactionType = "mixed";
        } else if (totalAcquired > 0) {
          transactionType = "buy";
        } else if (totalDisposed > 0) {
          transactionType = "sell";
        }

        const owners = ownersByFiling.get(row.id) ?? [];

        return {
          id: row.id,
          accessionNumber: row.accessionNumber,
          filedAt: row.filedAt,
          company: {
            id: company[0].id,
            name: company[0].name,
            cik: company[0].cik,
            ticker: ticker[0]?.ticker || null,
          },
          primaryOwner: owners[0] ?? null,
          ownerCount: owners.length,
          summary: {
            transactionType,
            totalAcquired,
            totalDisposed,
            totalAcquiredValue,
            totalDisposedValue,
            avgPricePerShare,
            netShares,
            totalActivityValue: totalAcquiredValue + totalDisposedValue,
            sharesOwnedAfter,
            ownershipChangePercent,
            transactionCount: row.transactionCount ?? 0,
          },
        };
      });

      return {
        company: {
          id: company[0].id,
          name: company[0].name,
          cik: company[0].cik,
          ticker: ticker[0]?.ticker || null,
        },
        filings: filingsWithSummary,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
        },
      };
    }),
});

function getOwnerRole(owner: {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther?: boolean;
}): string {
  const roles: string[] = [];
  if (owner.isDirector) roles.push("Director");
  if (owner.isOfficer) roles.push("Officer");
  if (owner.isTenPercentOwner) roles.push("10% Owner");
  if (owner.isOther) roles.push("Other");
  return roles.join(", ") || "Insider";
}

function buildCikCandidates(rawCik: string): string[] {
  const trimmed = rawCik.trim();
  const normalized = trimmed.replace(/^0+/, "");
  const padded = normalized.padStart(10, "0");

  return [...new Set([trimmed, normalized, padded])].filter(
    (value) => value.length > 0,
  );
}
