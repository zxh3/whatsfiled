import { EdgarClient, type FormType } from "@whatsfiled/edgar-client";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { chunk, sleep } from "./utils";

// Create a shared EdgarClient instance
const edgarClient = new EdgarClient();

export const _insertRawEdgarDailyIndexForm = internalMutation({
  args: {
    dateTimestamp: v.number(),
    fileName: v.string(),
    url: v.string(),
    contentStorageId: v.id("_storage"),
    state: v.union(v.literal("pending"), v.literal("processed")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rawEdgarDailyIndexForms")
      .filter((q) => q.eq(q.field("fileName"), args.fileName))
      .unique();
    if (existing) return;
    await ctx.db.insert("rawEdgarDailyIndexForms", args);
  },
});

export const _updateRawEdgarDailyIndexForm = internalMutation({
  args: {
    id: v.id("rawEdgarDailyIndexForms"),
    state: v.union(v.literal("pending"), v.literal("processed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("rawEdgarDailyIndexForms", args.id, {
      state: args.state,
    });
  },
});

export const _insertEdgarDailyIndexFormRows = internalMutation({
  args: {
    rows: v.array(
      v.object({
        rawEdgarDailyIndexFormId: v.id("rawEdgarDailyIndexForms"),
        formType: v.string(),
        companyName: v.string(),
        cik: v.string(),
        dateFiled: v.string(),
        fileName: v.string(),
        state: v.union(v.literal("pending"), v.literal("processed")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("rawEdgarDailyIndexFormRows")
        .withIndex("by_fileName", (q) => q.eq("fileName", row.fileName))
        .unique();
      if (existing) continue;
      await ctx.db.insert("rawEdgarDailyIndexFormRows", row);
    }
  },
});

export const _updateEdgarDailyIndexFormRows = internalMutation({
  args: {
    id: v.id("rawEdgarDailyIndexFormRows"),
    state: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("rawEdgarDailyIndexFormRows", args.id, {
      state: args.state,
      failureReason: args.failureReason,
    });
  },
});

export const _getExistingRawEdgarDailyIndexFormsByDate = internalQuery({
  args: {
    begin: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("rawEdgarDailyIndexForms")
      .withIndex("by_dateTimestamp", (q) =>
        q.gte("dateTimestamp", args.begin).lt("dateTimestamp", args.end),
      )
      .collect();
  },
});

export const _getExistingRawEdgarDailyIndexFormsByState = internalQuery({
  args: {
    state: v.union(v.literal("pending"), v.literal("processed")),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("rawEdgarDailyIndexForms")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .collect();
  },
});

export const _getExistingRawEdgarDailyIndexFormRowsByState = internalQuery({
  args: {
    state: v.union(v.literal("pending"), v.literal("processed")),
  },
  handler: async (ctx, args) => {
    const formTypes: FormType[] = ["4", "4/A"];

    const rows = (
      await Promise.all(
        formTypes.map(async (formType) => {
          return ctx.db
            .query("rawEdgarDailyIndexFormRows")
            .withIndex("by_formType_state", (q) =>
              q.eq("formType", formType).eq("state", args.state),
            )
            .collect();
        }),
      )
    ).flat();

    return rows;
  },
});

export const _insertParsedForm4Docs = internalMutation({
  args: {
    rows: v.array(
      v.object({
        rawEdgarDailyIndexFormRowId: v.id("rawEdgarDailyIndexFormRows"),

        issuerCik: v.string(),
        issuerName: v.string(),
        issuerTradingSymbol: v.string(),

        documentType: v.union(v.literal("4"), v.literal("4/A")),
        periodOfReport: v.string(),
        periodOfReportTimestamp: v.number(),

        primaryOwnerCik: v.string(),
        primaryOwnerName: v.string(),

        document: v.any(),
        rawXmlUrl: v.optional(v.string()),
        formattedXmlUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      // TODO
    }
  },
});

export const fetchRawEdgarDailyIndexForms = internalAction({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const currentYear = args.year ?? now.getFullYear();

    const fileNames = await edgarClient.getDailyIndexFileNames(currentYear);

    const existingRawEdgarDailyIndexForms = await ctx.runQuery(
      internal.secFilings._getExistingRawEdgarDailyIndexFormsByDate,
      {
        begin: new Date(currentYear, 0).getTime(),
        end: new Date(currentYear + 1, 0).getTime(),
      },
    );

    const filteredFileNames = fileNames.filter(
      (fileName) =>
        !existingRawEdgarDailyIndexForms.some((f) => f.fileName === fileName),
    );

    for (const fileName of filteredFileNames) {
      const { url, content, dateTimestamp } =
        await edgarClient.fetchDailyIndex(fileName);
      const blob = new Blob([content]);
      const storageId = await ctx.storage.store(blob);
      ctx.runMutation(internal.secFilings._insertRawEdgarDailyIndexForm, {
        dateTimestamp,
        fileName,
        url,
        contentStorageId: storageId,
        state: "pending",
      });
      await sleep(2000);
    }

    return fileNames;
  },
});

export const fetchRawEdgarDailyIndexFormRows = internalAction({
  args: {},
  handler: async (ctx) => {
    const existingRawEdgarDailyIndexForms = await ctx.runQuery(
      internal.secFilings._getExistingRawEdgarDailyIndexFormsByState,
      {
        state: "pending",
      },
    );

    for (const rawEdgarDailyIndexForm of existingRawEdgarDailyIndexForms) {
      const contentBlob = await ctx.storage.get(
        rawEdgarDailyIndexForm.contentStorageId,
      );
      if (!contentBlob) throw new Error("Content not found");
      const content = await contentBlob.text();
      const rows = edgarClient.parseDailyIndex(content);

      const chunks = chunk(rows, 100);
      for (const rows of chunks) {
        await ctx.runMutation(
          internal.secFilings._insertEdgarDailyIndexFormRows,
          {
            rows: rows.map((r) => ({
              ...r,
              rawEdgarDailyIndexFormId: rawEdgarDailyIndexForm._id,
              state: "pending" as const,
            })),
          },
        );
      }

      await ctx.runMutation(internal.secFilings._updateRawEdgarDailyIndexForm, {
        id: rawEdgarDailyIndexForm._id,
        state: "processed",
      });
    }
  },
});

export const parseForm4Docs = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingRows = await ctx.runQuery(
      internal.secFilings._getExistingRawEdgarDailyIndexFormRowsByState,
      {
        state: "pending",
      },
    );

    for (const row of pendingRows) {
      const fileName = row.fileName;
      const content = await edgarClient.fetchFiling(fileName);
      const parsed = edgarClient.parseForm4(content);
      const sourceInfo = edgarClient.getForm4SourceInfo(fileName, content);
      if (!sourceInfo) {
        await ctx.runMutation(
          internal.secFilings._updateEdgarDailyIndexFormRows,
          {
            id: row._id,
            state: "failed",
            failureReason: "Source info not found",
          },
        );
        continue;
      }

      // TODO: populate the parsed form4 docs
      // await ctx.runMutation(internal.secFilings._insertParsedForm4Docs, {
      //   rawEdgarDailyIndexFormRowId: row._id,
      //   issuerCik: row.cik,
      //   issuerName: row.companyName,
      //   issuerTradingSymbol: row.companyName,
      //   documentType: row.formType,
      //   periodOfReport: row.dateFiled,
      //   periodOfReportTimestamp: new Date(row.dateFiled).getTime(),
      //   primaryOwnerCik: row.cik,
      //   primaryOwnerName: row.companyName,
      //   document: parsed,
      //   rawXmlUrl: sourceInfo.rawXmlUrl,
      // });
      await ctx.runMutation(
        internal.secFilings._updateEdgarDailyIndexFormRows,
        {
          id: row._id,
          state: "processed",
        },
      );
    }
  },
});
