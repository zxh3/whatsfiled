#!/usr/bin/env tsx
import os from "node:os";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { companies, companyTickers } from "../db/schema.js";
import { env } from "../env.js";

type CompanyTickerExchangeResponse = {
  fields: ["cik", "name", "ticker", "exchange"];
  data: Array<[number, string, string, string]>;
};

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json";

function formatCik(value: number | string): string {
  const raw = typeof value === "number" ? String(value) : value;
  return raw.padStart(10, "0");
}

async function fetchCompanyTickers(): Promise<CompanyTickerExchangeResponse> {
  const response = await fetch(SEC_TICKERS_URL, {
    headers: {
      "User-Agent": env.EDGAR_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`SEC ticker fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CompanyTickerExchangeResponse>;
}

async function loadExistingPrimaryMap() {
  const rows = await db
    .select({
      companyId: companyTickers.companyId,
      isPrimary: companyTickers.isPrimary,
    })
    .from(companyTickers)
    .where(eq(companyTickers.isPrimary, true));

  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(row.companyId, true);
  }

  return map;
}

async function main() {
  console.log("\n=== Sync SEC Company Tickers ===");
  console.log(`Host: ${os.hostname()}`);
  console.log(`Source: ${SEC_TICKERS_URL}`);
  const today = new Date().toISOString().slice(0, 10);

  const payload = await fetchCompanyTickers();
  const hasPrimaryByCompanyId = await loadExistingPrimaryMap();

  let createdCompanies = 0;
  let updatedCompanies = 0;
  let insertedTickers = 0;
  let updatedTickers = 0;
  let skippedTickers = 0;

  for (const entry of payload.data) {
    const [rawCik, name, rawTicker, rawExchange] = entry;
    const cik = formatCik(rawCik);
    const ticker = rawTicker.trim().toUpperCase();
    const exchange = rawExchange?.trim() || null;

    if (!ticker) {
      skippedTickers++;
      continue;
    }

    const existingCompany = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.cik, cik))
      .limit(1);

    let companyId: string;

    if (existingCompany.length > 0) {
      companyId = existingCompany[0].id;
      if (existingCompany[0].name !== name) {
        await db
          .update(companies)
          .set({ name, updatedAt: new Date() })
          .where(eq(companies.id, companyId));
        updatedCompanies++;
      }
    } else {
      const [inserted] = await db
        .insert(companies)
        .values({ cik, name })
        .returning({ id: companies.id });
      companyId = inserted.id;
      createdCompanies++;
    }

    const hasPrimary = hasPrimaryByCompanyId.get(companyId) ?? false;
    const isPrimary = !hasPrimary;

    const existingTicker = await db
      .select({ id: companyTickers.id, exchange: companyTickers.exchange })
      .from(companyTickers)
      .where(
        and(
          eq(companyTickers.companyId, companyId),
          eq(companyTickers.ticker, ticker),
        ),
      )
      .limit(1);

    if (existingTicker.length > 0) {
      if (existingTicker[0].exchange !== exchange) {
        await db
          .update(companyTickers)
          .set({ exchange, activeUntil: null })
          .where(eq(companyTickers.id, existingTicker[0].id));
        updatedTickers++;
      } else {
        skippedTickers++;
      }
    } else {
      await db.insert(companyTickers).values({
        companyId,
        ticker,
        exchange,
        isPrimary,
        activeFrom: today,
      });
      insertedTickers++;
      if (isPrimary && !hasPrimary) {
        hasPrimaryByCompanyId.set(companyId, true);
      }
    }
  }

  const total = payload.data.length;
  console.log("");
  console.log(`Processed:         ${total}`);
  console.log(`Companies created: ${createdCompanies}`);
  console.log(`Companies updated: ${updatedCompanies}`);
  console.log(`Tickers inserted:  ${insertedTickers}`);
  console.log(`Tickers updated:   ${updatedTickers}`);
  console.log(`Tickers skipped:   ${skippedTickers}`);
  console.log("\n=== Sync Complete ===\n");
}

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exitCode = 1;
});
