import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const filings = pgTable("filings", {
  id: serial("id").primaryKey(),
  cik: varchar("cik", { length: 20 }).notNull(),
  formType: varchar("form_type", { length: 20 }).notNull(),
  filedAt: timestamp("filed_at").notNull(),
  fileName: text("file_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
