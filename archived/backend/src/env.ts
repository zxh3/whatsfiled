import dotenv from "dotenv";
import { z } from "zod";

// Load .env first, then .env.local (overrides .env)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  EDGAR_USER_AGENT: z.string().min(10), // Required by SEC, e.g., "MyApp contact@example.com"
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
