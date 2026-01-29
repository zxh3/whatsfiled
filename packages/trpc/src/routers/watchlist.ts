import {
  companies,
  companyTickers,
  filingOwners,
  filings,
  insiders,
  transactions,
  watchlistItems,
} from "@whatsfiled/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";

export const watchlistRouter = router({
  /**
   * Get user's watched companies with recent activity info.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    const userId = session.user.id;

    const items = await db
      .select({
        id: watchlistItems.id,
        companyId: watchlistItems.companyId,
        createdAt: watchlistItems.createdAt,
        companyName: companies.name,
        companyCik: companies.cik,
      })
      .from(watchlistItems)
      .innerJoin(companies, eq(watchlistItems.companyId, companies.id))
      .where(eq(watchlistItems.userId, userId))
      .orderBy(desc(watchlistItems.createdAt));

    // Get primary tickers for watched companies
    const companyIds = items.map((item) => item.companyId);
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

    return items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      company: {
        id: item.companyId,
        name: item.companyName,
        cik: item.companyCik,
        ticker: tickerMap.get(item.companyId) ?? null,
      },
    }));
  }),

  /**
   * Add a company to user's watchlist.
   */
  add: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;
      const { companyId } = input;

      // Insert with ON CONFLICT DO NOTHING to handle duplicates gracefully
      await db
        .insert(watchlistItems)
        .values({ userId, companyId })
        .onConflictDoNothing();

      return { success: true };
    }),

  /**
   * Remove a company from user's watchlist.
   */
  remove: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;
      const { companyId } = input;

      await db
        .delete(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.companyId, companyId),
          ),
        );

      return { success: true };
    }),

  /**
   * Check if user is watching a specific company.
   */
  isWatching: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;
      const { companyId } = input;

      const item = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.companyId, companyId),
          ),
        )
        .limit(1);

      return { isWatching: item.length > 0 };
    }),

  /**
   * Get transactions for watched companies (for personalized homepage feed).
   */
  getWatchlistFeed: protectedProcedure
    .input(
      z.object({
        filter: z.enum(["common", "options"]).default("common"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;
      const { filter, limit, offset } = input;

      // Get user's watched company IDs
      const watchedCompanies = await db
        .select({ companyId: watchlistItems.companyId })
        .from(watchlistItems)
        .where(eq(watchlistItems.userId, userId));

      const watchedCompanyIds = watchedCompanies.map((w) => w.companyId);

      if (watchedCompanyIds.length === 0) {
        return {
          transactions: [],
          pagination: { offset, limit, totalCount: 0, hasMore: false },
          watchlistCount: 0,
        };
      }

      // Determine which transaction codes to include
      const codes =
        filter === "common"
          ? ["P", "S"] // Market trades
          : ["M", "A", "F", "G", "C"]; // Awards & exercises

      // Count total for watched companies
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .innerJoin(filings, eq(transactions.filingId, filings.id))
        .where(
          and(
            inArray(transactions.transactionCode, codes),
            inArray(filings.companyId, watchedCompanyIds),
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
            inArray(filings.companyId, watchedCompanyIds),
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
        watchlistCount: watchedCompanyIds.length,
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
