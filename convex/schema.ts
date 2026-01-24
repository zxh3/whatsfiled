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

  edgarDailyIndexFormRows: defineTable({
    rawEdgarDailyIndexFormId: v.id("rawEdgarDailyIndexForms"),
    formType: v.string(), // e.g. "10-K", "10-Q", "8-K", etc.
    companyName: v.string(),
    cik: v.string(),
    dateFiled: v.string(), // YYYY-MM-DD
    fileName: v.string(), // edgar/data/.../*.txt
    state: v.union(v.literal("pending"), v.literal("processed")),
  })
    .index("by_cik", ["cik"])
    .index("by_formType", ["formType"])
    .index("by_formType_state", ["formType", "state"])
    .index("by_fileName", ["fileName"])
    .index("by_state", ["state"]),
});
