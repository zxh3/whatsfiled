import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env files (same order as src/env.ts)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: env is loaded in the config file
    url: process.env.DATABASE_URL!,
  },
});
