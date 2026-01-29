import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // NOTE: drizzle-kit push/pull has a bug with Supabase that causes crashes
  // when introspecting CHECK constraints. Use raw SQL for schema changes.
  // See: https://github.com/drizzle-team/drizzle-orm/issues/4496
});
