import { eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { companies, companyTickers, insiders } from "../../db/schema.js";
import { publicProcedure, router } from "../init.js";

export const searchRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ input }) => {
      const term = `%${input.query}%`;

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
