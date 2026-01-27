import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import { initCronJobs } from "./cron/index.js";
import { env } from "./env.js";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/routers/index.js";

const port = env.PORT;

const app = express();

// CORS - allow frontend origin
app.use(
  cors({
    origin: ["http://localhost:3001"],
    credentials: true,
  }),
);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// tRPC middleware
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// Initialize cron jobs
initCronJobs();

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`tRPC endpoint: http://localhost:${port}/trpc`);
});
