// Database client
export { createDb, getDb, type Database } from "./client.js";

// Schema exports
export * from "./schema.js";

// Re-export commonly used drizzle-orm functions for consistent versions
export { desc, eq, or, sql } from "drizzle-orm";
