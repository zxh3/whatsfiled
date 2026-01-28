import { z } from "zod";
import { publicProcedure, router } from "../init.js";
import { authRouter } from "./auth.js";
import { companiesRouter } from "./companies.js";
import { filingsRouter } from "./filings.js";
import { insidersRouter } from "./insiders.js";
import { pipelineRouter } from "./pipeline.js";
import { searchRouter } from "./search.js";

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  // Example procedure - remove or replace
  echo: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return { echo: input.message };
    }),

  // Auth
  auth: authRouter,

  // Public filing data
  filings: filingsRouter,
  companies: companiesRouter,
  insiders: insidersRouter,
  search: searchRouter,

  // Pipeline management (admin)
  pipeline: pipelineRouter,
});

export type AppRouter = typeof appRouter;
