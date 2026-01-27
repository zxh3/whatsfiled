import { z } from "zod";
import { publicProcedure, router } from "../init.js";

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
});

export type AppRouter = typeof appRouter;
