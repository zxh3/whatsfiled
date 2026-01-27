import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initCronJobs } from "./cron/index.js";
import { env } from "./env.js";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/routers/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = env.PORT;

const app = express();

// CORS - allow frontend origin in development
if (env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: ["http://localhost:3001"],
      credentials: true,
    }),
  );
}

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

// Serve static frontend in production
const publicDir = join(__dirname, "../public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback - serve index.html for non-API routes
  // Express 5 requires named wildcard syntax
  app.get("/{*path}", (_req, res) => {
    res.sendFile(join(publicDir, "index.html"));
  });
  console.log(`Serving static files from ${publicDir}`);
}

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`tRPC endpoint: http://localhost:${port}/trpc`);
});
