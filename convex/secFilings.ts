import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  fetchEdgarDailyIndexFormFileNamesByYear,
  fetchRawEdgarDailyIndexFormContent,
  parseRawEdgarDailyIndexFormContent,
} from "./helpers/edgarDailyIndexForms";
import { chunk, sleep } from "./helpers/utils";

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
        .query("edgarDailyIndexFormRows")
        .withIndex("by_fileName", (q) => q.eq("fileName", row.fileName))
        .unique();
      if (existing) continue;
      await ctx.db.insert("edgarDailyIndexFormRows", row);
    }
  },
});

export const _updateEdgarDailyIndexFormRows = internalMutation({
  args: {
    id: v.id("edgarDailyIndexFormRows"),
    state: v.union(v.literal("pending"), v.literal("processed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("edgarDailyIndexFormRows", args.id, {
      state: args.state,
    });
  },
});

export const _getExistingRawEdgarDailyIndexForms = internalQuery({
  args: {
    begin: v.number(),
    end: v.number(),
    state: v.optional(v.union(v.literal("pending"), v.literal("processed"))),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("rawEdgarDailyIndexForms")
      .withIndex("by_dateTimestamp", (q) =>
        q.gte("dateTimestamp", args.begin).lt("dateTimestamp", args.end),
      )
      .filter((q) => {
        if (!args.state) return true;
        return q.eq(q.field("state"), args.state);
      })
      .collect();
  },
});

export const fetchRawEdgarDailyIndexFormsByYear = internalAction({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const currentYear = args.year ?? now.getFullYear();

    const fileNames =
      await fetchEdgarDailyIndexFormFileNamesByYear(currentYear);

    const existingRawEdgarDailyIndexForms = await ctx.runQuery(
      internal.secFilings._getExistingRawEdgarDailyIndexForms,
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
        await fetchRawEdgarDailyIndexFormContent(fileName);
      const blob = new Blob([content]);
      const storageId = await ctx.storage.store(blob);
      ctx.runMutation(internal.secFilings._insertRawEdgarDailyIndexForm, {
        dateTimestamp,
        fileName,
        url,
        contentStorageId: storageId,
        state: "pending",
      });
      await sleep(5000);
    }

    return fileNames;
  },
});

export const parseEdgarDailyIndexFormRows = internalAction({
  args: {},
  handler: async (ctx) => {
    const existingRawEdgarDailyIndexForms = await ctx.runQuery(
      internal.secFilings._getExistingRawEdgarDailyIndexForms,
      {
        begin: new Date("2026-01-01").getTime(),
        end: new Date("2027-01-01").getTime(),
        state: "pending",
      },
    );

    for (const rawEdgarDailyIndexForm of existingRawEdgarDailyIndexForms) {
      if (rawEdgarDailyIndexForm._id !== "k177vekp2f5z42yt36tvxqsw1h7zthst") {
        continue;
      }

      const contentBlob = await ctx.storage.get(
        rawEdgarDailyIndexForm.contentStorageId,
      );
      if (!contentBlob) throw new Error("Content not found");
      const content = await contentBlob.text();
      const rows = parseRawEdgarDailyIndexFormContent(content);

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
