import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import {
  companies,
  companyTickers,
  derivativeTransactions,
  filingOwners,
  filings,
  insiders,
  insiderRoles,
  transactions,
} from "../../db/schema.js";
import { publicProcedure, router } from "../init.js";

export const companiesRouter = router({
  getByCik: publicProcedure
    .input(
      z.object({
        cik: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const normalizedCik = input.cik.replace(/^0+/, "");
      const company = await db
        .select({
          id: companies.id,
          name: companies.name,
          cik: companies.cik,
        })
        .from(companies)
        .where(
          or(
            eq(companies.cik, input.cik),
            sql`ltrim(${companies.cik}, '0') = ${normalizedCik}`,
          ),
        )
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

      const filingsWithDetails = await Promise.all(
        recentFilings.map(async (filing) => {
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
              pricePerShare: row.pricePerShare
                ? Number(row.pricePerShare)
                : null,
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
              totalAcquiredValue: parseFloat(
                summary?.totalAcquiredValue || "0",
              ),
              totalDisposedValue: parseFloat(
                summary?.totalDisposedValue || "0",
              ),
              avgPrice: parseFloat(summary?.avgPrice || "0"),
              sharesOwnedAfter,
              ownershipChangePercent,
            },
            transactions: mixedTransactions,
          };
        }),
      );

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
        filter: z.enum(["all", "common", "options"]).default("all"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }),
    )
    .query(async ({ input }) => {
      const normalizedCik = input.cik.replace(/^0+/, "");

      // Find the company
      const company = await db
        .select({
          id: companies.id,
          name: companies.name,
          cik: companies.cik,
        })
        .from(companies)
        .where(
          or(
            eq(companies.cik, input.cik),
            sql`ltrim(${companies.cik}, '0') = ${normalizedCik}`,
          ),
        )
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

      // Filter determines which table(s) to query:
      // - "common" = transactions table (non-derivative securities, Table I)
      // - "options" = derivative_transactions table (derivative securities, Table II)
      // - "all" = both tables combined

      let totalCount = 0;
      type TxnRow = {
        id: string;
        transactionDate: string | null;
        transactionCode: string | null;
        shares: string | null;
        pricePerShare: string | null;
        acquiredDisposed: "A" | "D" | null;
        sharesOwnedAfter: string | null;
        securityTitle: string;
        filingId: string;
        accessionNumber: string;
        filedAt: Date;
        isDerivative: boolean;
      };
      let txnRows: TxnRow[] = [];

      if (input.filter === "common") {
        // Query only open-market purchases (P) and sales (S) of common stock
        // Excludes exercise (M), award (A), tax (F), gift (G) which are option-related
        const openMarketCodes = ["P", "S"];
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .innerJoin(filings, eq(transactions.filingId, filings.id))
          .where(
            and(
              eq(filings.companyId, companyId),
              inArray(transactions.transactionCode, openMarketCodes),
            ),
          );
        totalCount = countResult[0]?.count ?? 0;

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
          })
          .from(transactions)
          .innerJoin(filings, eq(transactions.filingId, filings.id))
          .where(
            and(
              eq(filings.companyId, companyId),
              inArray(transactions.transactionCode, openMarketCodes),
            ),
          )
          .orderBy(desc(transactions.transactionDate), desc(filings.filedAt))
          .limit(input.pageSize)
          .offset(offset);

        txnRows = rows.map((r) => ({ ...r, isDerivative: false }));
      } else if (input.filter === "options") {
        // Query derivative transactions AND exercise-related non-derivative transactions
        // Exercise-related codes: M (exercise), A (award), F (tax), G (gift), C (conversion)
        const exerciseRelatedCodes = ["M", "A", "F", "G", "C"];

        // Count from both tables
        const [derivCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(derivativeTransactions)
          .innerJoin(filings, eq(derivativeTransactions.filingId, filings.id))
          .where(eq(filings.companyId, companyId));
        const [nonDerivExerciseCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .innerJoin(filings, eq(transactions.filingId, filings.id))
          .where(
            and(
              eq(filings.companyId, companyId),
              inArray(transactions.transactionCode, exerciseRelatedCodes),
            ),
          );
        totalCount =
          (derivCount?.count ?? 0) + (nonDerivExerciseCount?.count ?? 0);

        // Fetch from both tables and merge
        const derivRows = await db
          .select({
            id: derivativeTransactions.id,
            transactionDate: derivativeTransactions.transactionDate,
            transactionCode: derivativeTransactions.transactionCode,
            shares: derivativeTransactions.shares,
            pricePerShare: derivativeTransactions.pricePerShare,
            acquiredDisposed: derivativeTransactions.acquiredDisposed,
            sharesOwnedAfter: derivativeTransactions.sharesOwnedAfter,
            securityTitle: derivativeTransactions.securityTitle,
            filingId: filings.id,
            accessionNumber: filings.accessionNumber,
            filedAt: filings.filedAt,
          })
          .from(derivativeTransactions)
          .innerJoin(filings, eq(derivativeTransactions.filingId, filings.id))
          .where(eq(filings.companyId, companyId));

        const nonDerivExerciseRows = await db
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
          })
          .from(transactions)
          .innerJoin(filings, eq(transactions.filingId, filings.id))
          .where(
            and(
              eq(filings.companyId, companyId),
              inArray(transactions.transactionCode, exerciseRelatedCodes),
            ),
          );

        // Combine, sort, and paginate
        const combined = [
          ...derivRows.map((r) => ({ ...r, isDerivative: true as const })),
          ...nonDerivExerciseRows.map((r) => ({
            ...r,
            isDerivative: false as const,
          })),
        ].sort((a, b) => {
          const dateA = a.transactionDate
            ? new Date(a.transactionDate).getTime()
            : 0;
          const dateB = b.transactionDate
            ? new Date(b.transactionDate).getTime()
            : 0;
          if (dateB !== dateA) return dateB - dateA;
          return b.filedAt.getTime() - a.filedAt.getTime();
        });

        txnRows = combined.slice(offset, offset + input.pageSize);
      } else {
        // "all" - query both tables using UNION via raw SQL for proper pagination
        // Count from both tables
        const [nonDerivCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .innerJoin(filings, eq(transactions.filingId, filings.id))
          .where(eq(filings.companyId, companyId));
        const [derivCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(derivativeTransactions)
          .innerJoin(filings, eq(derivativeTransactions.filingId, filings.id))
          .where(eq(filings.companyId, companyId));
        totalCount = (nonDerivCount?.count ?? 0) + (derivCount?.count ?? 0);

        // Fetch from both tables separately and merge
        const nonDerivRows = await db
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
          })
          .from(transactions)
          .innerJoin(filings, eq(transactions.filingId, filings.id))
          .where(eq(filings.companyId, companyId));

        const derivRows = await db
          .select({
            id: derivativeTransactions.id,
            transactionDate: derivativeTransactions.transactionDate,
            transactionCode: derivativeTransactions.transactionCode,
            shares: derivativeTransactions.shares,
            pricePerShare: derivativeTransactions.pricePerShare,
            acquiredDisposed: derivativeTransactions.acquiredDisposed,
            sharesOwnedAfter: derivativeTransactions.sharesOwnedAfter,
            securityTitle: derivativeTransactions.securityTitle,
            filingId: filings.id,
            accessionNumber: filings.accessionNumber,
            filedAt: filings.filedAt,
          })
          .from(derivativeTransactions)
          .innerJoin(filings, eq(derivativeTransactions.filingId, filings.id))
          .where(eq(filings.companyId, companyId));

        // Combine, sort, and paginate in JS
        const combined = [
          ...nonDerivRows.map((r) => ({ ...r, isDerivative: false as const })),
          ...derivRows.map((r) => ({ ...r, isDerivative: true as const })),
        ].sort((a, b) => {
          // Sort by transaction date desc, then filed_at desc
          const dateA = a.transactionDate
            ? new Date(a.transactionDate).getTime()
            : 0;
          const dateB = b.transactionDate
            ? new Date(b.transactionDate).getTime()
            : 0;
          if (dateB !== dateA) return dateB - dateA;
          return b.filedAt.getTime() - a.filedAt.getTime();
        });

        txnRows = combined.slice(offset, offset + input.pageSize);
      }

      const totalPages = Math.ceil(totalCount / input.pageSize);

      // Fetch insider info for each transaction's filing
      const filingIds = [...new Set(txnRows.map((t) => t.filingId))];
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

      // Build response
      const txns = txnRows.map((row) => {
        const owners = ownersByFiling.get(row.filingId) ?? [];
        const insider = owners[0] ?? {
          id: "",
          name: "Unknown",
          cik: null,
          title: "",
        };

        return {
          id: row.id,
          transactionDate: row.transactionDate,
          transactionCode: row.transactionCode,
          shares: row.shares ? Number(row.shares) : null,
          pricePerShare: row.pricePerShare ? Number(row.pricePerShare) : null,
          acquiredDisposed: row.acquiredDisposed,
          sharesOwnedAfter: row.sharesOwnedAfter
            ? Number(row.sharesOwnedAfter)
            : null,
          securityTitle: row.securityTitle,
          isDerivative: row.isDerivative,
          insider,
          filing: {
            accessionNumber: row.accessionNumber,
            filedAt: row.filedAt,
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
        transactions: txns,
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
