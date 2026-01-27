import { z } from "zod";
import { publicProcedure, router } from "../init.js";
import { filingsRouter } from "./filings.js";
import { companiesRouter } from "./companies.js";
import { insidersRouter } from "./insiders.js";
import { pipelineRouter } from "./pipeline.js";

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

  // Public filing data
  filings: filingsRouter,
  companies: companiesRouter,
  insiders: insidersRouter,

  // Pipeline management (admin)
  pipeline: pipelineRouter,
});

export type AppRouter = typeof appRouter;
