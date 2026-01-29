import {
  companies,
  companyTickers,
  filingOwners,
  filings,
  insiders,
  transactions,
} from "@whatsfiled/db/schema";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../init.js";

export const filingsRouter = router({
  /**
   * Get recent filings for the activity feed.
   * Returns filings with company, insider, and transaction summary.
   */
  getRecentFilings: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        formType: z.enum(["4", "4/A"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { limit, offset, formType } = input;

      // Build base query for filings
      let query = db
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
        .orderBy(
          desc(filings.filedAt),
          desc(filings.createdAt),
          desc(filings.id),
        )
        .limit(limit)
        .offset(offset);

      if (formType) {
        query = query.where(eq(filings.formType, formType)) as typeof query;
      }

      const recentFilings = await query;

      // Early return if no filings
      if (recentFilings.length === 0) {
        return { filings: [], hasMore: false };
      }

      // Collect IDs for batch queries
      const filingIds = recentFilings.map((f) => f.id);
      const companyIds = [...new Set(recentFilings.map((f) => f.companyId))];

      // Batch fetch all related data (4 queries instead of 150-200)
      const [allOwners, allSummaries, allTickers, allMixedTransactions] =
        await Promise.all([
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

          // Batch fetch tickers
          db
            .select({
              companyId: companyTickers.companyId,
              ticker: companyTickers.ticker,
            })
            .from(companyTickers)
            .where(inArray(companyTickers.companyId, companyIds)),

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
        ]);

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

      const tickerByCompany = new Map<string, string>();
      for (const t of allTickers) {
        if (!tickerByCompany.has(t.companyId)) {
          tickerByCompany.set(t.companyId, t.ticker);
        }
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
          ownershipChangePercent = 100; // New position
        }

        // Determine transaction type (buy/sell/mixed)
        let transactionType: "buy" | "sell" | "mixed" | "none" = "none";
        if (totalAcquired > 0 && totalDisposed > 0) {
          transactionType = "mixed";
        } else if (totalAcquired > 0) {
          transactionType = "buy";
        } else if (totalDisposed > 0) {
          transactionType = "sell";
        }

        // For mixed filings, include compact transaction list for hover detail
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
            ticker: tickerByCompany.get(filing.companyId) ?? null,
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
        filings: filingsWithDetails,
        hasMore: recentFilings.length === limit,
      };
    }),

  /**
   * Get a single filing by accession number.
   */
  getByAccessionNumber: publicProcedure
    .input(z.object({ accessionNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { accessionNumber } = input;

      const filing = await db.query.filings.findFirst({
        where: eq(filings.accessionNumber, accessionNumber),
        with: {
          company: {
            with: {
              tickers: true,
            },
          },
          owners: {
            with: {
              insider: true,
            },
          },
          transactions: true,
          holdings: true,
          derivativeTransactions: true,
          derivativeHoldings: true,
          footnotes: true,
        },
      });

      if (!filing) {
        return null;
      }

      // Filter out future-dated transactions
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return {
        ...filing,
        transactions: filing.transactions.filter(
          (t) => !t.transactionDate || new Date(t.transactionDate) <= today,
        ),
        derivativeTransactions: filing.derivativeTransactions.filter(
          (t) => !t.transactionDate || new Date(t.transactionDate) <= today,
        ),
      };
    }),

  /**
   * Get recent transactions across all companies for the activity feed.
   * Returns individual transactions (not filings) with company and insider info.
   */
  getRecentTransactions: publicProcedure
    .input(
      z.object({
        filter: z.enum(["common", "options"]).default("common"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { filter, limit, offset } = input;

      // Determine which transaction codes to include
      const codes =
        filter === "common"
          ? ["P", "S"] // Market trades
          : ["M", "A", "F", "G", "C"]; // Awards & exercises

      // Count total
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .innerJoin(filings, eq(transactions.filingId, filings.id))
        .where(
          and(
            inArray(transactions.transactionCode, codes),
            lte(transactions.transactionDate, sql`CURRENT_DATE`),
          ),
        );
      const totalCount = countResult?.count ?? 0;

      // Fetch transactions with company and filing info
      const rows = await db
        .select({
          id: transactions.id,
          transactionDate: transactions.transactionDate,
          transactionCode: transactions.transactionCode,
          shares: transactions.shares,
          pricePerShare: transactions.pricePerShare,
          acquiredDisposed: transactions.acquiredDisposed,
          sharesOwnedAfter: transactions.sharesOwnedAfter,
          securityTitle: transactions.securityTitle,
          filingId: filings.id,
          accessionNumber: filings.accessionNumber,
          filedAt: filings.filedAt,
          companyId: companies.id,
          companyName: companies.name,
          companyCik: companies.cik,
        })
        .from(transactions)
        .innerJoin(filings, eq(transactions.filingId, filings.id))
        .innerJoin(companies, eq(filings.companyId, companies.id))
        .where(
          and(
            inArray(transactions.transactionCode, codes),
            lte(transactions.transactionDate, sql`CURRENT_DATE`),
          ),
        )
        .orderBy(
          desc(transactions.transactionDate),
          desc(filings.filedAt),
          desc(transactions.id),
        )
        .limit(limit)
        .offset(offset);

      // Get tickers for companies
      const companyIds = [...new Set(rows.map((r) => r.companyId))];
      const tickers =
        companyIds.length > 0
          ? await db
              .select({
                companyId: companyTickers.companyId,
                ticker: companyTickers.ticker,
              })
              .from(companyTickers)
              .where(inArray(companyTickers.companyId, companyIds))
          : [];
      const tickerMap = new Map(tickers.map((t) => [t.companyId, t.ticker]));

      // Get insider info for each filing
      const filingIds = [...new Set(rows.map((r) => r.filingId))];
      const ownerRows =
        filingIds.length > 0
          ? await db
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
              .where(inArray(filingOwners.filingId, filingIds))
          : [];

      // Group owners by filing
      const ownersByFiling = new Map<
        string,
        { id: string; name: string; cik: string | null; title: string }
      >();
      for (const owner of ownerRows) {
        if (!ownersByFiling.has(owner.filingId)) {
          ownersByFiling.set(owner.filingId, {
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
        }
      }

      const txns = rows.map((row) => ({
        id: row.id,
        transactionDate: row.transactionDate,
        transactionCode: row.transactionCode,
        shares: row.shares ? parseFloat(row.shares) : null,
        pricePerShare: row.pricePerShare ? parseFloat(row.pricePerShare) : null,
        acquiredDisposed: row.acquiredDisposed,
        sharesOwnedAfter: row.sharesOwnedAfter
          ? parseFloat(row.sharesOwnedAfter)
          : null,
        securityTitle: row.securityTitle,
        company: {
          id: row.companyId,
          name: row.companyName,
          cik: row.companyCik,
          ticker: tickerMap.get(row.companyId) ?? null,
        },
        insider: ownersByFiling.get(row.filingId) ?? {
          id: "",
          name: "Unknown",
          cik: null,
          title: "",
        },
        filing: {
          accessionNumber: row.accessionNumber,
          filedAt: row.filedAt,
        },
      }));

      return {
        transactions: txns,
        pagination: {
          offset,
          limit,
          totalCount,
          hasMore: offset + rows.length < totalCount,
        },
      };
    }),
});

function getOwnerRole(owner: {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
}): string {
  const roles: string[] = [];
  if (owner.isDirector) roles.push("Director");
  if (owner.isOfficer) roles.push("Officer");
  if (owner.isTenPercentOwner) roles.push("10% Owner");
  return roles.join(", ") || "Insider";
}
