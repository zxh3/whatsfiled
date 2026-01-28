import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export function getEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export type Env = z.infer<typeof envSchema>;
