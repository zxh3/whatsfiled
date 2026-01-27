import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import {
  companies,
  companyTickers,
  filingOwners,
  filings,
  insiders,
  transactions,
} from "../../db/schema.js";
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
    .query(async ({ input }) => {
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
        .orderBy(desc(filings.filedAt), desc(filings.createdAt), desc(filings.id))
        .limit(limit)
        .offset(offset);

      if (formType) {
        query = query.where(eq(filings.formType, formType)) as typeof query;
      }

      const recentFilings = await query;

      // For each filing, get the owners and transaction summary
      const filingsWithDetails = await Promise.all(
        recentFilings.map(async (filing) => {
          // Get filing owners with insider info
          const owners = await db
            .select({
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
            .where(eq(filingOwners.filingId, filing.id));

          // Get transaction summary
          const txnSummary = await db
            .select({
              totalAcquired: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'A' THEN shares ELSE 0 END), 0)`,
              totalDisposed: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'D' THEN shares ELSE 0 END), 0)`,
              totalAcquiredValue: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'A' THEN shares * price_per_share ELSE 0 END), 0)`,
              totalDisposedValue: sql<string>`COALESCE(SUM(CASE WHEN acquired_disposed = 'D' THEN shares * price_per_share ELSE 0 END), 0)`,
              avgPrice: sql<string>`COALESCE(AVG(price_per_share), 0)`,
              sharesOwnedAfter: sql<string>`MAX(shares_owned_after)`,
            })
            .from(transactions)
            .where(eq(transactions.filingId, filing.id));

          const summary = txnSummary[0];

          // Calculate ownership change percentage
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

          // Get primary ticker for company
          const ticker = await db
            .select({ ticker: companyTickers.ticker })
            .from(companyTickers)
            .where(eq(companyTickers.companyId, filing.companyId))
            .limit(1);

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
          let mixedTransactions:
            | Array<{
                transactionDate: Date | null;
                transactionCode: string | null;
                acquiredDisposed: "A" | "D" | null;
                shares: number | null;
                pricePerShare: number | null;
              }>
            | null = null;

          if (transactionType === "mixed") {
            const rows = await db
              .select({
                transactionDate: transactions.transactionDate,
                transactionCode: transactions.transactionCode,
                acquiredDisposed: transactions.acquiredDisposed,
                shares: transactions.shares,
                pricePerShare: transactions.pricePerShare,
              })
              .from(transactions)
              .where(eq(transactions.filingId, filing.id))
              .orderBy(transactions.transactionDate);

            mixedTransactions = rows.map((row) => ({
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
              ticker: ticker[0]?.ticker || null,
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
        }),
      );

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
    .query(async ({ input }) => {
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

      return filing;
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
