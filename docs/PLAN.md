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

## Phase 2: Data Pipeline

> Automated SEC data ingestion and storage

### 2.1 Database Schema
- [ ] Companies table (CIK, name, ticker, sector)
- [ ] Insiders table (CIK, name, relationships)
- [ ] Filings table (accession number, form type, date, raw content)
- [ ] Transactions table (parsed Form 4 data, normalized)
- [ ] Holdings table (current positions)

### 2.2 Daily Index Fetcher
- [ ] Implement cron job to fetch SEC daily index
- [ ] Parse index and identify new Form 4 filings
- [ ] Queue filings for processing
- [ ] Handle rate limiting (SEC: 10 req/sec)

### 2.3 Filing Processor
- [ ] Fetch and parse queued filings
- [ ] Extract and normalize transaction data
- [ ] Link to companies and insiders
- [ ] Calculate derived metrics (% ownership change, etc.)

### 2.4 Historical Backfill
- [ ] Script to backfill historical filings
- [ ] Start with last 1 year of Form 4s
- [ ] Progress tracking and resumability

---

## Phase 3: Core Features

> Essential user-facing functionality

### 3.1 Company View
- [ ] Company profile page
- [ ] Recent insider transactions
- [ ] Insider roster with positions
- [ ] Transaction history chart
- [ ] Ownership breakdown

### 3.2 Insider View
- [ ] Insider profile page
- [ ] All companies they're affiliated with
- [ ] Transaction history across companies
- [ ] Performance tracking (buy/sell timing)

### 3.3 Filing View
- [ ] Filing detail page
- [ ] Visual transaction summary
- [ ] Before/after ownership comparison
- [ ] Original document link

### 3.4 Search
- [ ] Global search (companies, insiders, tickers)
- [ ] Autocomplete with recent/popular
- [ ] Search results page with filters

### 3.5 Activity Feed
- [ ] Real-time feed of latest filings
- [ ] Filter by form type, transaction type
- [ ] Highlight notable transactions (large buys, CEO trades)

---

## Phase 4: User Experience

> Delight users with insights and personalization

### 4.1 Dashboard
- [ ] Personalized home page
- [ ] Watchlist activity summary
- [ ] Notable transactions today
- [ ] Market-wide insider sentiment

### 4.2 Watchlists
- [ ] Follow companies
- [ ] Follow insiders
- [ ] Custom watchlist groupings
- [ ] Watchlist sharing

### 4.3 Alerts & Notifications
- [ ] Email alerts for watchlist activity
- [ ] Configurable alert thresholds
- [ ] Daily/weekly digest options
- [ ] Push notifications (future)

### 4.4 Analytics & Insights
- [ ] Insider buying/selling trends
- [ ] Sector heatmaps
- [ ] Unusual activity detection
- [ ] Historical pattern analysis

### 4.5 Data Visualization
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

### Near-term
1. Database schema design
2. Daily index fetcher cron job
3. Filing processor pipeline
4. Company and filing views

### Mid-term
1. Search functionality
2. Activity feed
3. Basic API endpoints
4. User authentication

### Long-term
1. Analytics and insights
2. Premium features
3. Agent-optimized API
4. Mobile experience

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
3. **Real-time**: WebSocket updates or polling?
4. **Mobile**: Responsive web or native app?
5. **Monetization**: Freemium model? API pricing?

---

## Next Steps

1. Design and implement database schema (Phase 2.1)
2. Build daily index fetcher cron job (Phase 2.2)
3. Create company view UI (Phase 3.1)
