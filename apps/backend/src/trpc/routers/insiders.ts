import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import {
  companies,
  companyTickers,
  filingOwners,
  filings,
  insiders,
  insiderRoles,
  transactions,
} from "../../db/schema.js";
import { publicProcedure, router } from "../init.js";

export const insidersRouter = router({
  getByCik: publicProcedure
    .input(
      z.object({
        cik: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const normalizedCik = input.cik.replace(/^0+/, "");
      const insider = await db
        .select({
          id: insiders.id,
          name: insiders.name,
          cik: insiders.cik,
          isEntity: insiders.isEntity,
        })
        .from(insiders)
        .where(
          or(
            eq(insiders.cik, input.cik),
            sql`ltrim(${insiders.cik}, '0') = ${normalizedCik}`,
          ),
        )
        .limit(1);

      if (insider.length === 0) {
        return null;
      }

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
        .from(filingOwners)
        .innerJoin(filings, eq(filingOwners.filingId, filings.id))
        .innerJoin(companies, eq(filings.companyId, companies.id))
        .where(eq(filingOwners.insiderId, insider[0].id))
        .orderBy(desc(filings.filedAt), desc(filings.createdAt))
        .limit(input.limit);

      const affiliations = await db
        .select({
          companyId: companies.id,
          companyName: companies.name,
          companyCik: companies.cik,
          isDirector: insiderRoles.isDirector,
          isOfficer: insiderRoles.isOfficer,
          isTenPercentOwner: insiderRoles.isTenPercentOwner,
          isOther: insiderRoles.isOther,
          officerTitle: insiderRoles.officerTitle,
          otherText: insiderRoles.otherText,
          lastSeenAt: insiderRoles.lastSeenAt,
        })
        .from(insiderRoles)
        .innerJoin(companies, eq(insiderRoles.companyId, companies.id))
        .where(eq(insiderRoles.insiderId, insider[0].id))
        .orderBy(desc(insiderRoles.lastSeenAt), companies.name);

      const affiliationCompanyIds = affiliations.map(
        (entry) => entry.companyId,
      );
      const affiliationTickers =
        affiliationCompanyIds.length === 0
          ? []
          : await db
              .select({
                companyId: companyTickers.companyId,
                ticker: companyTickers.ticker,
              })
              .from(companyTickers)
              .where(inArray(companyTickers.companyId, affiliationCompanyIds));

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
            transactionDate: Date | null;
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

          const ticker = await db
            .select({ ticker: companyTickers.ticker })
            .from(companyTickers)
            .where(eq(companyTickers.companyId, filing.companyId))
            .limit(1);

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
        insider: insider[0],
        affiliations: affiliations.map((entry) => ({
          id: entry.companyId,
          name: entry.companyName,
          cik: entry.companyCik,
          ticker:
            affiliationTickers.find((t) => t.companyId === entry.companyId)
              ?.ticker || null,
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
