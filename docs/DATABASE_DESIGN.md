# Database Design

## Entity Relationship Overview

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│  Companies  │       │  Insider Roles  │       │   Insiders  │
│  (Issuers)  │◄──────│  (Join Table)   │──────►│ (Reporters) │
└─────────────┘       └─────────────────┘       └─────────────┘
       │                                               │
       │              ┌─────────────────┐              │
       └─────────────►│    Filings      │◄─────────────┘
                      │  (Form 4, etc)  │
                      └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌───────────────┐ ┌───────────┐ ┌─────────────────┐
      │ Transactions  │ │ Holdings  │ │   Derivatives   │
      │(Non-Deriv Txn)│ │(Positions)│ │ (Options, etc)  │
      └───────────────┘ └───────────┘ └─────────────────┘

## Pipeline / Ingestion Tables

┌──────────────────┐      ┌───────────────┐      ┌──────────────────┐
│ Daily Index Files│─────►│ Filing Queue  │      │ Pipeline Workers │
│ (Index tracking) │      │ (Job queue)   │      │ (Heartbeats)     │
└──────────────────┘      └───────────────┘      └──────────────────┘
```

## Design Principles

1. **SEC CIK as natural key** - SEC assigns unique CIKs to companies and persons
2. **Accession number as filing key** - Unique identifier for each filing
3. **Immutable filings** - Once filed, data doesn't change (amendments are new filings)
4. **Temporal data** - Track when relationships and holdings change over time
5. **Denormalize for reads** - Store computed fields for common queries
6. **Soft deletes** - Never hard delete, use `deleted_at` timestamp

## Enums

| Enum                   | Values                                          | Description                |
| ---------------------- | ----------------------------------------------- | -------------------------- |
| form_type              | 3, 3/A, 4, 4/A, 5, 5/A                          | SEC form types             |
| ownership_type         | D, I                                            | Direct, Indirect ownership |
| acquired_disposed      | A, D                                            | Acquired, Disposed         |
| index_status           | pending, processing, completed, failed          | Daily index file status    |
| filing_queue_status    | pending, processing, completed, failed, skipped | Filing queue entry status  |
| filing_source          | daily_index, rss_feed, manual                   | Source of filing entry     |
| pipeline_worker_status | running, stopped                                | Worker heartbeat status    |

## Tables

### companies

Issuers - public companies whose securities are traded.

| Column                 | Type         | Description                                 |
| ---------------------- | ------------ | ------------------------------------------- |
| id                     | uuid         | Primary key                                 |
| cik                    | varchar(10)  | SEC Central Index Key (unique, zero-padded) |
| name                   | varchar(255) | Company name (from latest filing)           |
| sic_code               | varchar(4)   | Standard Industrial Classification          |
| state_of_incorporation | varchar(2)   | State code                                  |
| fiscal_year_end        | varchar(4)   | MMDD format                                 |
| created_at             | timestamp    |                                             |
| updated_at             | timestamp    |                                             |

**Indexes**: cik (unique), name (for search)

### company_tickers

Companies can have multiple ticker symbols across exchanges.

| Column       | Type        | Description                |
| ------------ | ----------- | -------------------------- |
| id           | uuid        | Primary key                |
| company_id   | uuid        | FK to companies            |
| ticker       | varchar(10) | Ticker symbol              |
| exchange     | varchar(20) | NYSE, NASDAQ, etc.         |
| is_primary   | boolean     | Primary ticker for display |
| active_from  | date        | When ticker became active  |
| active_until | date        | Null if current            |
| created_at   | timestamp   |                            |

**Indexes**: ticker, (company_id, ticker) unique, (company_id, is_primary)

### insiders

Reporting owners - individuals or entities who file ownership reports.

| Column     | Type         | Description                                            |
| ---------- | ------------ | ------------------------------------------------------ |
| id         | uuid         | Primary key                                            |
| cik        | varchar(10)  | SEC CIK (unique, may be null for entities without CIK) |
| name       | varchar(255) | Person or entity name                                  |
| is_entity  | boolean      | True if trust/fund/etc, false if individual            |
| created_at | timestamp    |                                                        |
| updated_at | timestamp    |                                                        |

**Indexes**: cik (unique where not null), name (for search)

### insider_roles

Many-to-many relationship between insiders and companies with role details.

| Column               | Type         | Description                               |
| -------------------- | ------------ | ----------------------------------------- |
| id                   | uuid         | Primary key                               |
| insider_id           | uuid         | FK to insiders                            |
| company_id           | uuid         | FK to companies                           |
| is_director          | boolean      | Board member                              |
| is_officer           | boolean      | Executive officer                         |
| is_ten_percent_owner | boolean      | >10% beneficial owner                     |
| is_other             | boolean      | Other relationship                        |
| officer_title        | varchar(100) | Title if officer (CEO, CFO, etc.)         |
| other_text           | varchar(255) | Description if "other"                    |
| first_seen_at        | timestamp    | First filing with this relationship       |
| last_seen_at         | timestamp    | Most recent filing with this relationship |
| created_at           | timestamp    |                                           |
| updated_at           | timestamp    |                                           |

**Indexes**: (insider_id, company_id) unique, company_id

### filings

Individual SEC filings (Form 3, 4, 5 and amendments).

| Column           | Type         | Description                                          |
| ---------------- | ------------ | ---------------------------------------------------- |
| id               | uuid         | Primary key                                          |
| accession_number | varchar(25)  | SEC accession number (unique)                        |
| form_type        | varchar(10)  | "3", "3/A", "4", "4/A", "5", "5/A"                   |
| company_id       | uuid         | FK to companies (issuer)                             |
| filed_at         | timestamp    | When filed with SEC                                  |
| period_of_report | date         | Reporting period date                                |
| schema_version   | varchar(10)  | XML schema version (X0306, X0407, X0508)             |
| is_amendment     | boolean      | True if /A form                                      |
| amendment_type   | varchar(10)  | Null, or reason for amendment                        |
| document_url     | varchar(500) | Full URL to SEC document                             |
| raw_content      | text         | Original filing content (optional, for reprocessing) |
| processed_at     | timestamp    | When we parsed the filing                            |
| processing_error | text         | Error message if processing failed                   |
| created_at       | timestamp    |                                                      |

**Indexes**: accession_number (unique), company_id, filed_at, (filed_at, created_at), form_type

### filing_owners

Links filings to their reporting owners (a filing can have multiple owners).

| Column               | Type         | Description            |
| -------------------- | ------------ | ---------------------- |
| id                   | uuid         | Primary key            |
| filing_id            | uuid         | FK to filings          |
| insider_id           | uuid         | FK to insiders         |
| is_director          | boolean      | Role at time of filing |
| is_officer           | boolean      |                        |
| is_ten_percent_owner | boolean      |                        |
| is_other             | boolean      |                        |
| officer_title        | varchar(100) |                        |
| other_text           | varchar(255) |                        |
| created_at           | timestamp    |                        |

**Indexes**: (filing_id, insider_id) unique, insider_id

### transactions

Non-derivative transactions (direct stock buys/sells).

| Column                       | Type          | Description                        |
| ---------------------------- | ------------- | ---------------------------------- |
| id                           | uuid          | Primary key                        |
| filing_id                    | uuid          | FK to filings                      |
| security_title               | varchar(255)  | "Common Stock", etc.               |
| transaction_date             | date          | When transaction occurred          |
| deemed_execution_date        | date          | If different from transaction_date |
| transaction_code             | varchar(2)    | P=Purchase, S=Sale, A=Award, etc.  |
| transaction_code_description | varchar(100)  | Human-readable description         |
| equity_swap                  | boolean       | Part of equity swap                |
| shares                       | decimal(20,4) | Number of shares                   |
| price_per_share              | decimal(20,4) | Price per share (null if N/A)      |
| total_value                  | decimal(20,2) | Computed: shares \* price          |
| acquired_disposed            | varchar(1)    | A=Acquired, D=Disposed             |
| shares_owned_after           | decimal(20,4) | Position after transaction         |
| ownership_type               | varchar(1)    | D=Direct, I=Indirect               |
| indirect_nature              | varchar(255)  | Nature of indirect ownership       |
| footnote_ids                 | text[]        | Array of footnote references       |
| created_at                   | timestamp     |                                    |

**Indexes**: filing_id, transaction_date, transaction_code

### holdings

Non-derivative holdings (positions without transactions in the filing).

| Column          | Type          | Description          |
| --------------- | ------------- | -------------------- |
| id              | uuid          | Primary key          |
| filing_id       | uuid          | FK to filings        |
| security_title  | varchar(255)  |                      |
| shares_owned    | decimal(20,4) |                      |
| ownership_type  | varchar(1)    | D=Direct, I=Indirect |
| indirect_nature | varchar(255)  |                      |
| footnote_ids    | text[]        |                      |
| created_at      | timestamp     |                      |

**Indexes**: filing_id

### derivative_transactions

Derivative transactions (options, warrants, convertibles).

| Column                       | Type          | Description                         |
| ---------------------------- | ------------- | ----------------------------------- |
| id                           | uuid          | Primary key                         |
| filing_id                    | uuid          | FK to filings                       |
| security_title               | varchar(255)  | "Stock Option", "Warrant", etc.     |
| conversion_or_exercise_price | decimal(20,4) |                                     |
| transaction_date             | date          |                                     |
| deemed_execution_date        | date          |                                     |
| transaction_code             | varchar(2)    |                                     |
| transaction_code_description | varchar(100)  |                                     |
| equity_swap                  | boolean       |                                     |
| shares                       | decimal(20,4) | Derivative securities amount        |
| price_per_share              | decimal(20,4) |                                     |
| total_value                  | decimal(20,2) |                                     |
| acquired_disposed            | varchar(1)    |                                     |
| exercisable_date             | date          |                                     |
| expiration_date              | date          |                                     |
| underlying_security_title    | varchar(255)  | Usually "Common Stock"              |
| underlying_shares            | decimal(20,4) | Shares of underlying per derivative |
| shares_owned_after           | decimal(20,4) |                                     |
| ownership_type               | varchar(1)    |                                     |
| indirect_nature              | varchar(255)  |                                     |
| footnote_ids                 | text[]        |                                     |
| created_at                   | timestamp     |                                     |

**Indexes**: filing_id, transaction_date, expiration_date

### derivative_holdings

Derivative holdings (options/warrants held, no transaction).

| Column                       | Type          | Description   |
| ---------------------------- | ------------- | ------------- |
| id                           | uuid          | Primary key   |
| filing_id                    | uuid          | FK to filings |
| security_title               | varchar(255)  |               |
| conversion_or_exercise_price | decimal(20,4) |               |
| exercisable_date             | date          |               |
| expiration_date              | date          |               |
| underlying_security_title    | varchar(255)  |               |
| underlying_shares            | decimal(20,4) |               |
| shares_owned                 | decimal(20,4) |               |
| ownership_type               | varchar(1)    |               |
| indirect_nature              | varchar(255)  |               |
| footnote_ids                 | text[]        |               |
| created_at                   | timestamp     |               |

**Indexes**: filing_id, expiration_date

### footnotes

Footnotes from filings that explain transaction details.

| Column      | Type        | Description                      |
| ----------- | ----------- | -------------------------------- |
| id          | uuid        | Primary key                      |
| filing_id   | uuid        | FK to filings                    |
| footnote_id | varchar(10) | F1, F2, etc. (unique per filing) |
| content     | text        | Footnote text                    |
| created_at  | timestamp   |                                  |

**Indexes**: (filing_id, footnote_id) unique

### daily_index_files

Track which SEC daily index files have been processed.

| Column          | Type         | Description                                 |
| --------------- | ------------ | ------------------------------------------- |
| id              | uuid         | Primary key                                 |
| index_date      | date         | Date of the index file                      |
| form_type       | varchar(10)  | Form type filter used                       |
| file_name       | varchar(100) | Index file name (e.g., "form.20260102.idx") |
| file_url        | varchar(500) | URL of the index file                       |
| entries_count   | integer      | Number of entries in file                   |
| processed_count | integer      | Entries successfully processed              |
| status          | index_status | pending, processing, completed, failed      |
| started_at      | timestamp    |                                             |
| completed_at    | timestamp    |                                             |
| error_message   | text         |                                             |
| created_at      | timestamp    |                                             |

**Indexes**: (index_date, form_type) unique, status

### filing_queue

Job queue for individual filing processing. Supports multiple sources (daily index, RSS feed, manual).

| Column              | Type                | Description                                            |
| ------------------- | ------------------- | ------------------------------------------------------ |
| id                  | uuid                | Primary key                                            |
| daily_index_file_id | uuid                | FK to daily_index_files (nullable for RSS)             |
| file_name           | varchar(500)        | Filing path (e.g., "edgar/data/123/000123-24-001.txt") |
| form_type           | varchar(10)         | "4", "4/A", etc.                                       |
| company_name        | varchar(255)        | Company name from index                                |
| cik                 | varchar(10)         | Company CIK                                            |
| date_filed          | varchar(8)          | YYYYMMDD format                                        |
| source              | filing_source       | daily_index, rss_feed, manual                          |
| status              | filing_queue_status | pending, processing, completed, failed, skipped        |
| retry_count         | integer             | Number of retry attempts                               |
| last_error          | text                | Last error message                                     |
| last_error_at       | timestamp           | When last error occurred                               |
| priority            | integer             | Higher = processed first (RSS gets 100)                |
| locked_until        | timestamp           | Lock for concurrent processing                         |
| processed_at        | timestamp           | When successfully processed                            |
| created_at          | timestamp           |                                                        |

**Indexes**: file_name (unique), (status, priority), date_filed, source, daily_index_file_id

**Notes**:

- `file_name` uniqueness prevents duplicate filings from multiple sources
- RSS filings: `source='rss_feed'`, `daily_index_file_id=NULL`, higher priority
- Daily index filings: `source='daily_index'`, `daily_index_file_id` set

### pipeline_workers

Track active pipeline workers (backfill, cron jobs) with heartbeats.

| Column            | Type                   | Description                              |
| ----------------- | ---------------------- | ---------------------------------------- |
| id                | uuid                   | Primary key                              |
| worker_key        | varchar(120)           | Unique worker identifier                 |
| worker_type       | varchar(30)            | "backfill", "cron", etc.                 |
| stage             | varchar(30)            | Current stage (discovery, index, filing) |
| host              | varchar(255)           | Hostname running the worker              |
| pid               | integer                | Process ID                               |
| status            | pipeline_worker_status | running, stopped                         |
| started_at        | timestamp              | When worker started                      |
| last_heartbeat_at | timestamp              | Last heartbeat timestamp                 |
| ended_at          | timestamp              | When worker stopped                      |
| details           | text                   | Additional worker details                |

**Indexes**: worker_key (unique), status, last_heartbeat_at

**Notes**:

- Used to detect stale workers and prevent duplicate processing
- Workers should update `last_heartbeat_at` periodically

## Materialized Views / Aggregates

For performance, consider materialized views or aggregate tables:

### insider_summary (per insider-company pair)

- Total shares owned (direct + indirect)
- Total transactions count
- Net shares bought/sold (30d, 90d, 1y, all-time)
- Last transaction date
- Average buy price, average sell price

### company_insider_activity (per company)

- Total insider buy volume (30d, 90d)
- Total insider sell volume (30d, 90d)
- Net insider sentiment
- Most active insiders

## Future Considerations

1. **Form 3 & 5 Support**
   - Same structure works, just different form_type values
   - Form 3: Initial ownership, mostly holdings
   - Form 5: Annual summary, deferred transactions

2. **13F Holdings**
   - Institutional ownership (quarterly)
   - Different structure - would need separate tables

3. **10-K, 10-Q, 8-K**
   - Company filings, not insider filings
   - Would need document parsing, not structured XML

4. **Full-text Search**
   - PostgreSQL tsvector for company/insider name search
   - Consider dedicated search index (Elasticsearch/Meilisearch)

5. **Time-series Optimization**
   - TimescaleDB extension for transaction history
   - Partitioning by date for large tables

6. **Multi-tenancy**
   - If supporting multiple users with private data
   - Add tenant_id to relevant tables
