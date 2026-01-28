// Database client

// Re-export commonly used drizzle-orm functions for consistent versions
export { desc, eq, or, sql } from "drizzle-orm";
export { createDb, type Database, getDb } from "./client.js";
// Schema exports
export * from "./schema.js";
