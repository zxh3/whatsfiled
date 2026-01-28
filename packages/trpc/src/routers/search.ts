import { eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { companies, companyTickers, insiders } from "@whatsfiled/db/schema";
import { publicProcedure, router } from "../init.js";

export const searchRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const rawQuery = input.query.trim();
      const term = `%${rawQuery}%`;
      const upperQuery = rawQuery.toUpperCase();

      const companyMatches = await db
        .select({
          id: companies.id,
          name: companies.name,
          cik: companies.cik,
          ticker: companyTickers.ticker,
        })
        .from(companies)
        .leftJoin(companyTickers, eq(companyTickers.companyId, companies.id))
        .where(
          or(
            ilike(companies.name, term),
            ilike(companies.cik, term),
            ilike(companyTickers.ticker, term),
          ),
        )
        .orderBy(
          sql`case
            when upper(${companyTickers.ticker}) = ${upperQuery} then 0
            when upper(${companyTickers.ticker}) like ${`${upperQuery}%`} then 1
            when upper(${companies.cik}) = ${upperQuery} then 2
            when upper(${companyTickers.ticker}) like ${`%${upperQuery}%`} then 3
            when upper(${companies.name}) like ${`%${upperQuery}%`} then 4
            else 5
          end`,
          companyTickers.ticker,
          companies.name,
        )
        .limit(input.limit);

      const insiderMatches = await db
        .select({
          id: insiders.id,
          name: insiders.name,
          cik: insiders.cik,
        })
        .from(insiders)
        .where(or(ilike(insiders.name, term), ilike(insiders.cik, term)))
        .limit(input.limit);

      return {
        companies: companyMatches,
        insiders: insiderMatches,
      };
    }),
});
