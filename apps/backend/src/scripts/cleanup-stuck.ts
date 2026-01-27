#!/usr/bin/env tsx
/**
 * Quick script to reset stuck "processing" entries back to "pending"
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { filingQueue } from "../db/schema.js";

async function main() {
  const result = await db
    .update(filingQueue)
    .set({ status: "pending", lockedUntil: null })
    .where(eq(filingQueue.status, "processing"))
    .returning({ id: filingQueue.id });

  console.log(`Reset ${result.length} stuck processing entries to pending`);
  process.exit(0);
}

main();
