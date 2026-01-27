import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rawEdgarDailyIndexForms: defineTable({
    dateTimestamp: v.number(), // date timestamp since epoch
    url: v.string(), // e.g. "https://www.sec.gov/Archives/edgar/daily-index/2026/QTR1/form.20260120.idx"
    fileName: v.string(), // e.g. "form.20260102.idx"
    contentStorageId: v.id("_storage"),
    state: v.union(v.literal("pending"), v.literal("processed")),
  })
    .index("by_dateTimestamp", ["dateTimestamp"])
    .index("by_fileName", ["fileName"])
    .index("by_state", ["state"]),

  rawEdgarDailyIndexFormRows: defineTable({
    rawEdgarDailyIndexFormId: v.id("rawEdgarDailyIndexForms"),
    formType: v.string(), // e.g. "10-K", "10-Q", "8-K", etc.
    companyName: v.string(),
    cik: v.string(),
    dateFiled: v.string(), // YYYY-MM-DD
    fileName: v.string(), // edgar/data/.../*.txt
    state: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    failureReason: v.optional(v.string()),
  })
    .index("by_cik", ["cik"])
    .index("by_formType", ["formType"])
    .index("by_formType_state", ["formType", "state"])
    .index("by_fileName", ["fileName"])
    .index("by_state", ["state"]),

  // TODO: fix this schema;
  parsedForm4Docs: defineTable({
    // Reference to source
    rawEdgarDailyIndexFormRowId: v.id("rawEdgarDailyIndexFormRows"),

    // === Issuer info ===
    issuerCik: v.string(), // Stable identifier (never changes)
    issuerName: v.string(), // Name at time of filing
    issuerTradingSymbol: v.string(), // Ticker at time of filing

    // === Document metadata ===
    documentType: v.union(v.literal("4"), v.literal("4/A")),
    periodOfReport: v.string(), // YYYY-MM-DD
    periodOfReportTimestamp: v.number(), // Epoch ms for ordering/range queries

    // === Primary reporting owner ===
    primaryOwnerCik: v.string(),
    primaryOwnerName: v.string(),

    // === Summary fields ===
    // TODO: where to put actual transaction data?
    // we should probably embed the full document here, but that's a lot of data to store
    hasNonDerivativeTransactions: v.boolean(),
    hasDerivativeTransactions: v.boolean(),
    nonDerivativeTransactionCount: v.number(),
    derivativeTransactionCount: v.number(),

    // === Full parsed document ===
    document: v.any(), // Full Form4Document

    // === Source URLs ===
    rawXmlUrl: v.optional(v.string()),
    formattedXmlUrl: v.optional(v.string()),
  })
    // Primary query: by ticker, ordered by date
    .index("by_issuerTradingSymbol_periodOfReportTimestamp", [
      "issuerTradingSymbol",
      "periodOfReportTimestamp",
    ])
    // Stable query: by CIK (handles ticker changes), ordered by date
    .index("by_issuerCik_periodOfReportTimestamp", [
      "issuerCik",
      "periodOfReportTimestamp",
    ])
    // Owner queries
    .index("by_primaryOwnerCik_periodOfReportTimestamp", [
      "primaryOwnerCik",
      "periodOfReportTimestamp",
    ])
    // Simple lookups
    .index("by_issuerCik", ["issuerCik"])
    .index("by_issuerTradingSymbol", ["issuerTradingSymbol"])
    .index("by_primaryOwnerCik", ["primaryOwnerCik"]),
});
