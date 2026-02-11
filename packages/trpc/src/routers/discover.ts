import {
  companies,
  companyTickers,
  filingOwners,
  filings,
  insiders,
  transactions,
} from "@whatsfiled/db/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../init.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getWindowStart(window: "1d" | "7d" | "30d"): Date {
  const now = new Date();
  const days = window === "1d" ? 1 : window === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * MS_PER_DAY);
}

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

export const discoverRouter = router({
  getFeed: publicProcedure
    .input(
      z.object({
        window: z.enum(["1d", "7d", "30d"]).default("7d"),
        direction: z.enum(["all", "buy", "sell"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        minValue: z.number().min(0).optional(),
        companyIds: z.array(z.string().uuid()).max(500).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { window, direction, limit, offset, minValue, companyIds } = input;

      if (companyIds && companyIds.length === 0) {
        return {
          items: [],
          pagination: {
            offset,
            limit,
            totalCount: 0,
            hasMore: false,
          },
        };
      }

      const windowStart = getWindowStart(window);
      const codes = ["P", "S"];

      const conditions = [
        inArray(transactions.transactionCode, codes),
        gte(filings.filedAt, windowStart),
        lte(transactions.transactionDate, sql`CURRENT_DATE`),
      ];
      if (companyIds && companyIds.length > 0) {
        conditions.push(inArray(filings.companyId, companyIds));
      }
      const whereClause = and(...conditions);

      const aggregateBase = db
        .select({
          filingId: filings.id,
          accessionNumber: filings.accessionNumber,
          filedAt: filings.filedAt,
          companyId: companies.id,
          companyName: companies.name,
          companyCik: companies.cik,
          totalAcquired: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} ELSE 0 END), 0)`,
          totalDisposed: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} ELSE 0 END), 0)`,
          totalAcquiredValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END), 0)`,
          totalDisposedValue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END), 0)`,
          avgPricePerShare: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.pricePerShare} IS NOT NULL AND ${transactions.shares} IS NOT NULL THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END) / NULLIF(SUM(CASE WHEN ${transactions.pricePerShare} IS NOT NULL AND ${transactions.shares} IS NOT NULL THEN ${transactions.shares} ELSE 0 END), 0), 0)`,
          sharesOwnedAfter: sql<string>`MAX(${transactions.sharesOwnedAfter})`,
          txCount: sql<number>`count(*)::int`,
        })
        .from(filings)
        .innerJoin(transactions, eq(transactions.filingId, filings.id))
        .innerJoin(companies, eq(filings.companyId, companies.id))
        .where(whereClause)
        .groupBy(
          filings.id,
          filings.accessionNumber,
          filings.filedAt,
          companies.id,
          companies.name,
          companies.cik,
        );

      const havingConditions = [];
      if (direction === "buy") {
        havingConditions.push(
          sql`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} ELSE 0 END), 0) > COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} ELSE 0 END), 0)`,
        );
      } else if (direction === "sell") {
        havingConditions.push(
          sql`COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} ELSE 0 END), 0) < COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} ELSE 0 END), 0)`,
        );
      }
      if (minValue !== undefined) {
        havingConditions.push(
          sql`(COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'A' THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN ${transactions.acquiredDisposed} = 'D' THEN ${transactions.shares} * ${transactions.pricePerShare} ELSE 0 END), 0)) >= ${minValue}`,
        );
      }

      const aggregateRows =
        havingConditions.length > 0
          ? await aggregateBase.having(and(...havingConditions))
          : await aggregateBase;

      if (aggregateRows.length === 0) {
        return {
          items: [],
          pagination: {
            offset,
            limit,
            totalCount: 0,
            hasMore: false,
          },
        };
      }

      const filingIds = aggregateRows.map((r) => r.filingId);
      const resultCompanyIds = [
        ...new Set(aggregateRows.map((r) => r.companyId)),
      ];

      const [tickerRows, ownerRows] = await Promise.all([
        db
          .select({
            companyId: companyTickers.companyId,
            ticker: companyTickers.ticker,
          })
          .from(companyTickers)
          .where(inArray(companyTickers.companyId, resultCompanyIds)),
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
      ]);

      const tickerByCompany = new Map<string, string>();
      for (const row of tickerRows) {
        if (!tickerByCompany.has(row.companyId)) {
          tickerByCompany.set(row.companyId, row.ticker);
        }
      }

      const ownerByFiling = new Map<
        string,
        {
          id: string;
          name: string;
          cik: string | null;
          title: string;
          isDirector: boolean;
          isOfficer: boolean;
          isTenPercentOwner: boolean;
        }
      >();
      for (const owner of ownerRows) {
        if (!ownerByFiling.has(owner.filingId)) {
          ownerByFiling.set(owner.filingId, {
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
            isDirector: owner.isDirector,
            isOfficer: owner.isOfficer,
            isTenPercentOwner: owner.isTenPercentOwner,
          });
        }
      }

      const filingsPerCompany = new Map<string, number>();
      for (const row of aggregateRows) {
        filingsPerCompany.set(
          row.companyId,
          (filingsPerCompany.get(row.companyId) ?? 0) + 1,
        );
      }

      const rawItems = aggregateRows.map((row) => {
        const buyShares = Number(row.totalAcquired ?? "0");
        const sellShares = Number(row.totalDisposed ?? "0");
        const buyValue = Number(row.totalAcquiredValue ?? "0");
        const sellValue = Number(row.totalDisposedValue ?? "0");
        const tradeValue = buyValue + sellValue;
        const netShares = buyShares - sellShares;
        const ownedAfter = Number(row.sharesOwnedAfter ?? "0");
        const before = ownedAfter - netShares;
        const deltaOwnPct = before > 0 ? (netShares / before) * 100 : null;
        const transactionType: "buy" | "sell" | "mixed" | "none" =
          buyShares > 0 && sellShares > 0
            ? "mixed"
            : buyShares > 0
              ? "buy"
              : sellShares > 0
                ? "sell"
                : "none";

        return {
          filingId: row.filingId,
          accessionNumber: row.accessionNumber,
          filedAt: row.filedAt,
          company: {
            id: row.companyId,
            cik: row.companyCik,
            name: row.companyName,
            ticker: tickerByCompany.get(row.companyId) ?? null,
          },
          insider: ownerByFiling.get(row.filingId) ?? {
            id: "",
            name: "Unknown",
            cik: null,
            title: "",
            isDirector: false,
            isOfficer: false,
            isTenPercentOwner: false,
          },
          metrics: {
            transactionType,
            netShares,
            tradeValue,
            buyValue,
            sellValue,
            avgPricePerShare: Number(row.avgPricePerShare ?? "0"),
            ownedAfter,
            deltaOwnPct,
            txCount: row.txCount ?? 0,
          },
          clusterCount: filingsPerCompany.get(row.companyId) ?? 1,
          filedAtMs: row.filedAt.getTime(),
        };
      });

      const maxTradeValue = Math.max(
        1,
        ...rawItems.map((item) => item.metrics.tradeValue),
      );
      const maxAbsDelta = Math.max(
        1,
        ...rawItems.map((item) => Math.abs(item.metrics.deltaOwnPct ?? 0)),
      );

      const scored = rawItems.map((item) => {
        const reasons: string[] = [];
        let score = 0;

        if (item.metrics.transactionType === "buy") {
          score += 40;
          reasons.push("Net Buy");
        } else if (item.metrics.transactionType === "sell") {
          score += 20;
          reasons.push("Net Sell");
        }

        const valueNorm = item.metrics.tradeValue / maxTradeValue;
        score += valueNorm * 25;
        if (valueNorm >= 0.7) reasons.push("Large Value");

        const deltaNorm = Math.abs(item.metrics.deltaOwnPct ?? 0) / maxAbsDelta;
        score += deltaNorm * 20;
        if (deltaNorm >= 0.7) reasons.push("High ΔOwn");

        const titleUpper = (item.insider.title ?? "").toUpperCase();
        if (
          item.insider.isDirector ||
          titleUpper.includes("CEO") ||
          titleUpper.includes("CFO")
        ) {
          score += 15;
          reasons.push("Key Officer/Director");
        }

        if (item.clusterCount >= 2) {
          score += 20;
          reasons.push("Cluster Activity");
        }

        const ageMs = Date.now() - item.filedAtMs;
        if (ageMs <= MS_PER_DAY) {
          score += 10;
          reasons.push("Recent Filing");
        }

        return {
          ...item,
          score: Math.round(score * 10) / 10,
          reasons,
        };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.filedAt.getTime() - a.filedAt.getTime();
      });

      const totalCount = scored.length;
      const items = scored.slice(offset, offset + limit).map((item) => ({
        filingId: item.filingId,
        accessionNumber: item.accessionNumber,
        filedAt: item.filedAt,
        company: item.company,
        insider: {
          id: item.insider.id,
          name: item.insider.name,
          cik: item.insider.cik,
          title: item.insider.title,
        },
        metrics: item.metrics,
        score: item.score,
        reasons: item.reasons,
      }));

      return {
        items,
        pagination: {
          offset,
          limit,
          totalCount,
          hasMore: offset + items.length < totalCount,
        },
      };
    }),
});
