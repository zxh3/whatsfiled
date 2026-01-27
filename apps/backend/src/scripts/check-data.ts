#!/usr/bin/env tsx
/**
 * Quick script to check the data in the database
 */

import { count } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  companies,
  filings,
  filingOwners,
  insiders,
  transactions,
  derivativeTransactions,
} from "../db/schema.js";

async function main() {
  const [companiesCount] = await db.select({ count: count() }).from(companies);
  const [filingsCount] = await db.select({ count: count() }).from(filings);
  const [insidersCount] = await db.select({ count: count() }).from(insiders);
  const [ownersCount] = await db.select({ count: count() }).from(filingOwners);
  const [txnCount] = await db.select({ count: count() }).from(transactions);
  const [derivTxnCount] = await db
    .select({ count: count() })
    .from(derivativeTransactions);

  console.log("\n=== Database Contents ===");
  console.log(`Companies:              ${companiesCount.count}`);
  console.log(`Insiders:               ${insidersCount.count}`);
  console.log(`Filings:                ${filingsCount.count}`);
  console.log(`Filing Owners:          ${ownersCount.count}`);
  console.log(`Transactions:           ${txnCount.count}`);
  console.log(`Derivative Transactions:${derivTxnCount.count}`);

  // Show a sample filing
  const sampleFilings = await db
    .select({
      accessionNumber: filings.accessionNumber,
      formType: filings.formType,
      periodOfReport: filings.periodOfReport,
    })
    .from(filings)
    .limit(3);

  console.log("\n=== Sample Filings ===");
  for (const f of sampleFilings) {
    console.log(`  ${f.accessionNumber} | ${f.formType} | ${f.periodOfReport}`);
  }

  process.exit(0);
}

main();
