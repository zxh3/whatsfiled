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

export const filingQueueStatusEnum = pgEnum("filing_queue_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "skipped",
]);

export const pipelineWorkerStatusEnum = pgEnum("pipeline_worker_status", [
  "running",
  "stopped",
]);

// NOTE: Source enum supports future RSS feed ingestion
// When adding RSS, entries go to same queue - fileName uniqueness prevents duplicates
export const filingSourceEnum = pgEnum("filing_source", [
  "daily_index", // From daily index files
  "rss_feed", // Future: Real-time RSS feed
  "manual", // Manual backfill/import
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
  watchlistItems: many(watchlistItems),
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
    uniqueIndex("company_tickers_company_ticker_idx").on(
      table.companyId,
      table.ticker,
    ),
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
    uniqueIndex("insiders_cik_idx").on(table.cik).where(sql`cik IS NOT NULL`),
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
    filedAt: timestamp("filed_at", { withTimezone: true }).notNull(),
    periodOfReport: date("period_of_report").notNull(),
    schemaVersion: varchar("schema_version", { length: 10 }),
    isAmendment: boolean("is_amendment").default(false).notNull(),
    amendmentType: varchar("amendment_type", { length: 50 }),
    documentUrl: varchar("document_url", { length: 500 }),
    rawContent: text("raw_content"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("filings_accession_number_idx").on(table.accessionNumber),
    index("filings_company_idx").on(table.companyId),
    index("filings_filed_at_idx").on(table.filedAt),
    index("filings_filed_at_created_at_idx").on(table.filedAt, table.createdAt),
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
    sharesOwnedAfter: decimal("shares_owned_after", {
      precision: 20,
      scale: 4,
    }),
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
    sharesOwnedAfter: decimal("shares_owned_after", {
      precision: 20,
      scale: 4,
    }),
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
    fileName: varchar("file_name", { length: 100 }).notNull(), // e.g., "form.20260102.idx"
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
    // Compound index for backfill queries: WHERE status = 'pending' AND indexDate BETWEEN
    index("daily_index_files_status_date_idx").on(
      table.status,
      table.indexDate,
    ),
  ],
);

export const dailyIndexFilesRelations = relations(
  dailyIndexFiles,
  ({ many }) => ({
    filingQueueEntries: many(filingQueue),
  }),
);

// ============================================================================
// Filing Queue (for tracking individual filing processing)
// ============================================================================

export const filingQueue = pgTable(
  "filing_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // NOTE: Nullable for RSS-sourced filings (discovered before daily index exists)
    // Daily index filings will have this set; RSS filings will have NULL
    dailyIndexFileId: uuid("daily_index_file_id").references(
      () => dailyIndexFiles.id,
    ),

    fileName: varchar("file_name", { length: 500 }).notNull(), // e.g., "edgar/data/123/000123-24-001.txt"
    formType: varchar("form_type", { length: 10 }).notNull(), // e.g., "4", "4/A"
    companyName: varchar("company_name", { length: 255 }).notNull(),
    cik: varchar("cik", { length: 10 }).notNull(),
    dateFiled: varchar("date_filed", { length: 8 }).notNull(), // YYYYMMDD

    // Tracks where this entry came from - critical for analytics and debugging
    // RSS filings: source='rss_feed', dailyIndexFileId=NULL, higher priority
    // Daily index filings: source='daily_index', dailyIndexFileId set
    source: filingSourceEnum("source").default("daily_index").notNull(),

    status: filingQueueStatusEnum("status").default("pending").notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at"),

    // RSS filings get higher priority (e.g., 100) for faster processing
    priority: integer("priority").default(0).notNull(),
    lockedUntil: timestamp("locked_until"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // CRITICAL: Unique on fileName ensures no duplicate filings from multiple sources
    // When RSS adds a filing first, daily index will skip it (ON CONFLICT DO NOTHING)
    uniqueIndex("filing_queue_file_name_idx").on(table.fileName),
    index("filing_queue_status_priority_idx").on(table.status, table.priority),
    index("filing_queue_date_filed_idx").on(table.dateFiled), // For gap detection
    index("filing_queue_source_idx").on(table.source), // For source analytics
    index("filing_queue_daily_index_file_idx").on(table.dailyIndexFileId),
    // Compound index for backfill queries: WHERE status = 'pending' AND dateFiled BETWEEN
    index("filing_queue_status_date_filed_idx").on(
      table.status,
      table.dateFiled,
    ),
  ],
);

export const filingQueueRelations = relations(filingQueue, ({ one }) => ({
  dailyIndexFile: one(dailyIndexFiles, {
    fields: [filingQueue.dailyIndexFileId],
    references: [dailyIndexFiles.id],
  }),
}));

// ============================================================================
// Pipeline Workers (backfill/cron heartbeats)
// ============================================================================

export const pipelineWorkers = pgTable(
  "pipeline_workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerKey: varchar("worker_key", { length: 120 }).notNull(),
    workerType: varchar("worker_type", { length: 30 }).notNull(), // e.g., backfill, cron
    stage: varchar("stage", { length: 30 }),
    host: varchar("host", { length: 255 }),
    pid: integer("pid"),
    status: pipelineWorkerStatusEnum("status").default("running").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    details: text("details"),
  },
  (table) => [
    uniqueIndex("pipeline_workers_key_idx").on(table.workerKey),
    index("pipeline_workers_status_idx").on(table.status),
    index("pipeline_workers_heartbeat_idx").on(table.lastHeartbeatAt),
  ],
);

// ============================================================================
// Better Auth Tables
// ============================================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Watchlist Items
// ============================================================================

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("watchlist_user_company_idx").on(table.userId, table.companyId),
    index("watchlist_user_idx").on(table.userId),
  ],
);

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  user: one(users, {
    fields: [watchlistItems.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [watchlistItems.companyId],
    references: [companies.id],
  }),
}));

// ============================================================================
// Chat Messages (Real-time chat)
// ============================================================================

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 50 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("chat_messages_created_at_idx").on(table.createdAt)],
);
