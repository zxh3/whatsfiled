# WhatsFiled Product Roadmap

## Vision

Make SEC filings easily digestible for retail investors, analysts, and AI agents. Transform complex regulatory documents into actionable insights with a delightful user experience.

## Core Value Props

1. **Clarity** - Complex filings → simple, visual summaries
2. **Speed** - Real-time alerts on insider activity
3. **Discovery** - Find patterns across insiders, companies, sectors
4. **Accessibility** - Beautiful UI for humans, clean API for agents

---

## Phase 1: Foundation ✅

> Infrastructure and core libraries

- [x] Monorepo setup (Turborepo + pnpm)
- [x] Backend: Express + tRPC + PostgreSQL + Drizzle
- [x] Frontend: Next.js 16 + React 19 + Tailwind + Shadcn
- [x] Edgar client library (Form 4 parsing)
- [x] Docker Compose for local dev
- [x] Basic frontend-backend connectivity

---

## Phase 2: Data Pipeline ✅

> Automated SEC data ingestion and storage

### 2.1 Database Schema ✅
- [x] Companies table (CIK, name, tickers)
- [x] Insiders table (CIK, name, relationships)
- [x] Insider Roles table (insider-company relationships with titles)
- [x] Filings table (accession number, form type, date, raw content)
- [x] Filing Owners table (filing-insider relationships)
- [x] Transactions table (parsed Form 4 non-derivative data)
- [x] Holdings table (non-derivative positions)
- [x] Derivative Transactions table (options, warrants, etc.)
- [x] Derivative Holdings table
- [x] Footnotes table
- [x] Daily Index Files table (tracking index file processing)
- [x] Filing Queue table (tracking individual filing processing)

### 2.2 Daily Index Fetcher ✅
- [x] Implement cron job to fetch SEC daily index (`cron/index.ts`)
- [x] Index discovery stage (`pipeline/stages/index-discovery.ts`)
- [x] Parse index and identify new Form 4/4A filings
- [x] Queue filings for processing in `filing_queue` table
- [x] Handle rate limiting (300ms between requests)
- [x] Idempotent inserts via unique constraints

### 2.3 Filing Processor ✅
- [x] Index processing stage (`pipeline/stages/index-processing.ts`)
- [x] Filing processing stage (`pipeline/stages/filing-processing.ts`)
- [x] Form4-to-DB mapper (`pipeline/mappers/form4-to-db.ts`)
- [x] Fetch and parse queued filings with EdgarClient
- [x] Extract and normalize transaction data
- [x] Link to companies and insiders (upsert logic)
- [x] Distributed locking via `locked_until` column
- [x] Retry logic with max 3 attempts
- [x] Error tracking with `last_error`, `last_error_at`

### 2.4 Historical Backfill ✅
- [x] CLI script for backfill (`scripts/backfill.ts`)
- [x] Supports year-based discovery
- [x] Dry-run mode for testing
- [x] Progress tracking via queue stats
- [x] Resumable - idempotent operations

### 2.5 Pipeline Visibility ✅
- [x] tRPC router for pipeline management (`trpc/routers/pipeline.ts`)
- [x] Stats endpoint (queue status counts)
- [x] Index coverage endpoint (by year)
- [x] Gap detection (find missing dates)
- [x] Failed filings list with error details
- [x] Retry endpoints for failed filings/indexes
- [x] Manual trigger endpoints for each stage

### Pipeline Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Stage 1:       │     │  Stage 2:       │     │  Stage 3:       │
│  Index          │────►│  Index          │────►│  Filing         │
│  Discovery      │     │  Processing     │     │  Processing     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ daily_index_    │     │ filing_queue    │     │ companies,      │
│ files           │     │                 │     │ filings, etc.   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Cron Schedule (UTC)
| Time | Job | Purpose |
|------|-----|---------|
| 00:00 | Index Discovery | Find new daily index files |
| 00:30 | Index Processing | Parse index, create queue entries |
| 01:00-05:00 | Filing Processing | Process queued filings (hourly) |
| */30 | Cleanup | Clean up stale locks |

---

## Phase 3: Core Features

> Essential user-facing functionality
> **Philosophy: No login required.** All core browsing is public. Auth only needed for personalization features (Phase 4).

### 3.1 Activity Feed (Homepage) ← Start Here
- [ ] Real-time feed of latest filings
- [ ] Clean, minimal card design
- [ ] Each card shows: Company, Insider, Buy/Sell, Shares, Price, % Ownership Change
- [ ] Filter by form type (4, 4/A)
- [ ] Highlight notable transactions (large buys, C-suite trades)
- [ ] Click to drill into filing/company/insider

### 3.2 Filing View
- [ ] Filing detail page (`/filing/[accessionNumber]`)
- [ ] Visual transaction summary
- [ ] Before/after ownership comparison
- [ ] All transactions in the filing
- [ ] Footnotes display
- [ ] Link to original SEC document

### 3.3 Company View
- [ ] Company profile page (`/company/[cik]`)
- [ ] Company name, ticker, basic info
- [ ] Recent insider transactions list
- [ ] Insider roster with titles
- [ ] Transaction history chart (future)

### 3.4 Insider View
- [ ] Insider profile page (`/insider/[cik]`)
- [ ] All companies they're affiliated with
- [ ] Transaction history across companies
- [ ] Role at each company

### 3.5 Search
- [ ] Global search (companies, insiders, tickers)
- [ ] Autocomplete with suggestions
- [ ] Search results page

---

## Phase 4: Personalization (Requires Auth)

> Features that require user accounts - deferred until core experience is solid

### 4.1 User Accounts
- [ ] Authentication (email, OAuth)
- [ ] User preferences storage

### 4.2 Watchlists
- [ ] Follow companies
- [ ] Follow insiders
- [ ] Custom watchlist groupings
- [ ] Personalized dashboard

### 4.3 Alerts & Notifications
- [ ] Email alerts for watchlist activity
- [ ] Configurable alert thresholds
- [ ] Daily/weekly digest options

### 4.4 Analytics & Insights (Public)
- [ ] Insider buying/selling trends
- [ ] Sector heatmaps
- [ ] Unusual activity detection
- [ ] Historical pattern analysis

### 4.5 Data Visualization (Public)
- [ ] Interactive transaction charts
- [ ] Ownership pie charts
- [ ] Timeline views
- [ ] Comparison tools

---

## Phase 5: API for Agents

> First-class API for programmatic access

### 5.1 Public API Design
- [ ] RESTful endpoints for all entities
- [ ] GraphQL alternative (optional)
- [ ] Comprehensive filtering/pagination
- [ ] Bulk data endpoints

### 5.2 API Infrastructure
- [ ] API key authentication
- [ ] Rate limiting tiers
- [ ] Usage tracking
- [ ] Webhook support for real-time updates

### 5.3 Documentation
- [ ] OpenAPI/Swagger spec
- [ ] Interactive API explorer
- [ ] Code examples (Python, JS, curl)
- [ ] Use case guides

### 5.4 Agent-Friendly Features
- [ ] Structured data responses (JSON)
- [ ] Natural language query endpoint (AI-powered)
- [ ] Batch operations
- [ ] Change detection feeds

---

## Phase 6: Growth & Monetization

> Scale and sustainability

### 6.1 User Accounts
- [ ] Authentication (email, OAuth)
- [ ] User preferences
- [ ] Saved searches
- [ ] Export capabilities

### 6.2 Premium Features
- [ ] Real-time alerts (vs delayed)
- [ ] Advanced analytics
- [ ] API access tiers
- [ ] Historical data access

### 6.3 Performance & Scale
- [ ] Caching layer (Redis)
- [ ] CDN for static assets
- [ ] Database optimization
- [ ] Horizontal scaling

---

## Technical Priorities

### Near-term (Current Focus)
1. ~~Database schema design~~ ✅
2. ~~Daily index fetcher cron job~~ ✅
3. ~~Filing processor pipeline~~ ✅
4. Backfill 2026 data
5. Activity Feed homepage (Phase 3.1)
6. Filing detail view (Phase 3.2)

### Mid-term
1. Company view (Phase 3.3)
2. Insider view (Phase 3.4)
3. Search functionality (Phase 3.5)
4. Public API endpoints (Phase 5)

### Long-term
1. User accounts & watchlists (Phase 4)
2. Analytics and insights
3. Premium features
4. Agent-optimized API

---

## Success Metrics

- **Data freshness**: Filings processed within 15 min of SEC publication
- **Coverage**: 100% of Form 4 filings captured
- **Performance**: Page load < 1s, API response < 200ms
- **Engagement**: Users return to check activity
- **API adoption**: Agents/developers using API

---

## Open Questions

1. **Scope**: Start with Form 4 only, or include Form 3/5 from the start?
2. **Historical depth**: How far back to backfill? (Cost vs value)
3. **Real-time**: WebSocket updates or polling? → RSS feed support designed into filing_queue
4. **Mobile**: Responsive web or native app?
5. **Monetization**: Freemium model? API pricing?

---

## Next Steps

1. ~~Design and implement database schema (Phase 2.1)~~ ✅
2. ~~Build daily index fetcher cron job (Phase 2.2)~~ ✅
3. ~~Build filing processor pipeline (Phase 2.3)~~ ✅
4. **Backfill 2026 data** ← Current
5. Build Activity Feed homepage (Phase 3.1)
6. Build Filing detail view (Phase 3.2)
7. Build Company view (Phase 3.3)
8. Build Insider view (Phase 3.4)
9. Add Search (Phase 3.5)

---

## Backfill Commands

```bash
# Check pipeline stats
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage stats

# Discover index files for a year (dry run first)
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2025 --stage discovery --dry-run
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2025 --stage discovery

# Process index files (creates queue entries)
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage index --limit 20

# Process filings from queue
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage filing --limit 100

# Run all stages
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2025 --limit 50
```
