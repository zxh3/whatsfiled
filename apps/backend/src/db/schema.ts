import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const formTypeEnum = pgEnum("form_type", [
  "3",
  "3/A",
  "4",
  "4/A",
  "5",
  "5/A",
]);

export const ownershipTypeEnum = pgEnum("ownership_type", ["D", "I"]); // Direct, Indirect

export const acquiredDisposedEnum = pgEnum("acquired_disposed", ["A", "D"]); // Acquired, Disposed

export const indexStatusEnum = pgEnum("index_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// ============================================================================
// Companies (Issuers)
// ============================================================================

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cik: varchar("cik", { length: 10 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    sicCode: varchar("sic_code", { length: 4 }),
    stateOfIncorporation: varchar("state_of_incorporation", { length: 2 }),
    fiscalYearEnd: varchar("fiscal_year_end", { length: 4 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("companies_cik_idx").on(table.cik),
    index("companies_name_idx").on(table.name),
  ],
);

export const companiesRelations = relations(companies, ({ many }) => ({
  tickers: many(companyTickers),
  insiderRoles: many(insiderRoles),
  filings: many(filings),
}));

// ============================================================================
// Company Tickers
// ============================================================================

export const companyTickers = pgTable(
  "company_tickers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    ticker: varchar("ticker", { length: 10 }).notNull(),
    exchange: varchar("exchange", { length: 20 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    activeFrom: date("active_from"),
    activeUntil: date("active_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("company_tickers_ticker_idx").on(table.ticker),
    index("company_tickers_company_primary_idx").on(
      table.companyId,
      table.isPrimary,
    ),
  ],
);

export const companyTickersRelations = relations(companyTickers, ({ one }) => ({
  company: one(companies, {
    fields: [companyTickers.companyId],
    references: [companies.id],
  }),
}));

// ============================================================================
// Insiders (Reporting Owners)
// ============================================================================

export const insiders = pgTable(
  "insiders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cik: varchar("cik", { length: 10 }),
    name: varchar("name", { length: 255 }).notNull(),
    isEntity: boolean("is_entity").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("insiders_cik_idx")
      .on(table.cik)
      .where(sql`cik IS NOT NULL`),
    index("insiders_name_idx").on(table.name),
  ],
);

export const insidersRelations = relations(insiders, ({ many }) => ({
  roles: many(insiderRoles),
  filingOwners: many(filingOwners),
}));

// ============================================================================
// Insider Roles (Insider <-> Company relationship)
// ============================================================================

export const insiderRoles = pgTable(
  "insider_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    insiderId: uuid("insider_id")
      .notNull()
      .references(() => insiders.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    isDirector: boolean("is_director").default(false).notNull(),
    isOfficer: boolean("is_officer").default(false).notNull(),
    isTenPercentOwner: boolean("is_ten_percent_owner").default(false).notNull(),
    isOther: boolean("is_other").default(false).notNull(),
    officerTitle: varchar("officer_title", { length: 100 }),
    otherText: varchar("other_text", { length: 255 }),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("insider_roles_insider_company_idx").on(
      table.insiderId,
      table.companyId,
    ),
    index("insider_roles_company_idx").on(table.companyId),
  ],
);

export const insiderRolesRelations = relations(insiderRoles, ({ one }) => ({
  insider: one(insiders, {
    fields: [insiderRoles.insiderId],
    references: [insiders.id],
  }),
  company: one(companies, {
    fields: [insiderRoles.companyId],
    references: [companies.id],
  }),
}));

// ============================================================================
// Filings
// ============================================================================

export const filings = pgTable(
  "filings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accessionNumber: varchar("accession_number", { length: 25 }).notNull(),
    formType: formTypeEnum("form_type").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    filedAt: timestamp("filed_at").notNull(),
    periodOfReport: date("period_of_report").notNull(),
    schemaVersion: varchar("schema_version", { length: 10 }),
    isAmendment: boolean("is_amendment").default(false).notNull(),
    amendmentType: varchar("amendment_type", { length: 50 }),
    documentUrl: varchar("document_url", { length: 500 }),
    rawContent: text("raw_content"),
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("filings_accession_number_idx").on(table.accessionNumber),
    index("filings_company_idx").on(table.companyId),
    index("filings_filed_at_idx").on(table.filedAt),
    index("filings_form_type_idx").on(table.formType),
  ],
);

export const filingsRelations = relations(filings, ({ one, many }) => ({
  company: one(companies, {
    fields: [filings.companyId],
    references: [companies.id],
  }),
  owners: many(filingOwners),
  transactions: many(transactions),
  holdings: many(holdings),
  derivativeTransactions: many(derivativeTransactions),
  derivativeHoldings: many(derivativeHoldings),
  footnotes: many(footnotes),
}));

// ============================================================================
// Filing Owners (Filing <-> Insider relationship)
// ============================================================================

export const filingOwners = pgTable(
  "filing_owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filings.id),
    insiderId: uuid("insider_id")
      .notNull()
      .references(() => insiders.id),
    isDirector: boolean("is_director").default(false).notNull(),
    isOfficer: boolean("is_officer").default(false).notNull(),
    isTenPercentOwner: boolean("is_ten_percent_owner").default(false).notNull(),
    isOther: boolean("is_other").default(false).notNull(),
    officerTitle: varchar("officer_title", { length: 100 }),
    otherText: varchar("other_text", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("filing_owners_filing_insider_idx").on(
      table.filingId,
      table.insiderId,
    ),
    index("filing_owners_insider_idx").on(table.insiderId),
  ],
);

export const filingOwnersRelations = relations(filingOwners, ({ one }) => ({
  filing: one(filings, {
    fields: [filingOwners.filingId],
    references: [filings.id],
  }),
  insider: one(insiders, {
    fields: [filingOwners.insiderId],
    references: [insiders.id],
  }),
}));

// ============================================================================
// Non-Derivative Transactions
// ============================================================================

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filings.id),
    securityTitle: varchar("security_title", { length: 255 }).notNull(),
    transactionDate: date("transaction_date"),
    deemedExecutionDate: date("deemed_execution_date"),
    transactionCode: varchar("transaction_code", { length: 2 }),
    transactionCodeDescription: varchar("transaction_code_description", {
      length: 100,
    }),
    equitySwap: boolean("equity_swap").default(false).notNull(),
    shares: decimal("shares", { precision: 20, scale: 4 }),
    pricePerShare: decimal("price_per_share", { precision: 20, scale: 4 }),
    totalValue: decimal("total_value", { precision: 20, scale: 2 }),
    acquiredDisposed: acquiredDisposedEnum("acquired_disposed"),
    sharesOwnedAfter: decimal("shares_owned_after", { precision: 20, scale: 4 }),
    ownershipType: ownershipTypeEnum("ownership_type"),
    indirectNature: varchar("indirect_nature", { length: 255 }),
    footnoteIds: text("footnote_ids").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("transactions_filing_idx").on(table.filingId),
    index("transactions_date_idx").on(table.transactionDate),
    index("transactions_code_idx").on(table.transactionCode),
  ],
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  filing: one(filings, {
    fields: [transactions.filingId],
    references: [filings.id],
  }),
}));

// ============================================================================
// Non-Derivative Holdings
// ============================================================================

export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filings.id),
    securityTitle: varchar("security_title", { length: 255 }).notNull(),
    sharesOwned: decimal("shares_owned", { precision: 20, scale: 4 }),
    ownershipType: ownershipTypeEnum("ownership_type"),
    indirectNature: varchar("indirect_nature", { length: 255 }),
    footnoteIds: text("footnote_ids").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("holdings_filing_idx").on(table.filingId)],
);

export const holdingsRelations = relations(holdings, ({ one }) => ({
  filing: one(filings, {
    fields: [holdings.filingId],
    references: [filings.id],
  }),
}));

// ============================================================================
// Derivative Transactions
// ============================================================================

export const derivativeTransactions = pgTable(
  "derivative_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filings.id),
    securityTitle: varchar("security_title", { length: 255 }).notNull(),
    conversionOrExercisePrice: decimal("conversion_or_exercise_price", {
      precision: 20,
      scale: 4,
    }),
    transactionDate: date("transaction_date"),
    deemedExecutionDate: date("deemed_execution_date"),
    transactionCode: varchar("transaction_code", { length: 2 }),
    transactionCodeDescription: varchar("transaction_code_description", {
      length: 100,
    }),
    equitySwap: boolean("equity_swap").default(false).notNull(),
    shares: decimal("shares", { precision: 20, scale: 4 }),
    pricePerShare: decimal("price_per_share", { precision: 20, scale: 4 }),
    totalValue: decimal("total_value", { precision: 20, scale: 2 }),
    acquiredDisposed: acquiredDisposedEnum("acquired_disposed"),
    exercisableDate: date("exercisable_date"),
    expirationDate: date("expiration_date"),
    underlyingSecurityTitle: varchar("underlying_security_title", {
      length: 255,
    }),
    underlyingShares: decimal("underlying_shares", { precision: 20, scale: 4 }),
    sharesOwnedAfter: decimal("shares_owned_after", { precision: 20, scale: 4 }),
    ownershipType: ownershipTypeEnum("ownership_type"),
    indirectNature: varchar("indirect_nature", { length: 255 }),
    footnoteIds: text("footnote_ids").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("derivative_transactions_filing_idx").on(table.filingId),
    index("derivative_transactions_date_idx").on(table.transactionDate),
    index("derivative_transactions_expiration_idx").on(table.expirationDate),
  ],
);

export const derivativeTransactionsRelations = relations(
  derivativeTransactions,
  ({ one }) => ({
    filing: one(filings, {
      fields: [derivativeTransactions.filingId],
      references: [filings.id],
    }),
  }),
);

// ============================================================================
// Derivative Holdings
// ============================================================================

export const derivativeHoldings = pgTable(
  "derivative_holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filings.id),
    securityTitle: varchar("security_title", { length: 255 }).notNull(),
    conversionOrExercisePrice: decimal("conversion_or_exercise_price", {
      precision: 20,
      scale: 4,
    }),
    exercisableDate: date("exercisable_date"),
    expirationDate: date("expiration_date"),
    underlyingSecurityTitle: varchar("underlying_security_title", {
      length: 255,
    }),
    underlyingShares: decimal("underlying_shares", { precision: 20, scale: 4 }),
    sharesOwned: decimal("shares_owned", { precision: 20, scale: 4 }),
    ownershipType: ownershipTypeEnum("ownership_type"),
    indirectNature: varchar("indirect_nature", { length: 255 }),
    footnoteIds: text("footnote_ids").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("derivative_holdings_filing_idx").on(table.filingId),
    index("derivative_holdings_expiration_idx").on(table.expirationDate),
  ],
);

export const derivativeHoldingsRelations = relations(
  derivativeHoldings,
  ({ one }) => ({
    filing: one(filings, {
      fields: [derivativeHoldings.filingId],
      references: [filings.id],
    }),
  }),
);

// ============================================================================
// Footnotes
// ============================================================================

export const footnotes = pgTable(
  "footnotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => filings.id),
    footnoteId: varchar("footnote_id", { length: 10 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("footnotes_filing_footnote_idx").on(
      table.filingId,
      table.footnoteId,
    ),
  ],
);

export const footnotesRelations = relations(footnotes, ({ one }) => ({
  filing: one(filings, {
    fields: [footnotes.filingId],
    references: [filings.id],
  }),
}));

// ============================================================================
// Daily Index Files (for tracking ingestion)
// ============================================================================

export const dailyIndexFiles = pgTable(
  "daily_index_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indexDate: date("index_date").notNull(),
    formType: varchar("form_type", { length: 10 }).notNull(),
    fileUrl: varchar("file_url", { length: 500 }),
    entriesCount: integer("entries_count"),
    processedCount: integer("processed_count").default(0).notNull(),
    status: indexStatusEnum("status").default("pending").notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_index_files_date_form_idx").on(
      table.indexDate,
      table.formType,
    ),
    index("daily_index_files_status_idx").on(table.status),
  ],
);
