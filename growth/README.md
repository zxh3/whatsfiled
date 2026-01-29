# WhatsFiled Growth Tracker

This folder tracks growth strategies, progress, and ideas for user acquisition.

## Strategy Documents

| File | Description |
|------|-------------|
| [seo-content.md](./seo-content.md) | SEO and content marketing strategies |
| [social-distribution.md](./social-distribution.md) | Social media and community distribution |
| [product-led-growth.md](./product-led-growth.md) | Product features that drive organic growth |
| [api-developer.md](./api-developer.md) | API and developer ecosystem strategy |

---

## Progress Tracker

### SEO & Technical Foundation

| Task | Status | Notes |
|------|--------|-------|
| Dynamic sitemap (`/sitemap.xml`) | ✅ Done | Includes companies, insiders, filings (limited to 10k/5k each) |
| Robots.txt | ✅ Done | Blocks /admin, /api/, /sign-in |
| Root metadata (title, description, keywords) | ✅ Done | Good keyword coverage for insider trading terms |
| OpenGraph tags (root) | ✅ Done | og:title, og:description, og:site_name |
| Twitter cards (root) | ✅ Done | summary_large_image card type |
| Canonical URLs (root) | ✅ Done | metadataBase set to whatsfiled.com |
| Company page dynamic metadata | ✅ Done | Title, description, OG, Twitter, canonical per company |
| Insider page dynamic metadata | ✅ Done | Title, description, OG, Twitter, canonical per insider |
| Filing page dynamic metadata | ✅ Done | Title, description, OG, publishedTime, canonical per filing |
| Search page metadata | ✅ Done | Static metadata |
| Coverage page metadata | ✅ Done | Static metadata |
| Resources/SEC filings metadata | ✅ Done | Static metadata |
| Favicon | ✅ Done | favicon.ico in app directory |
| Vercel Analytics | ✅ Done | Integrated in root layout |
| Submit to Google Search Console | ✅ Done | Sitemap submitted Jan 2025 |
| OpenGraph images (dynamic) | ✅ Done | PR #1 - Auto-generated preview cards for social sharing |
| Structured data (JSON-LD) | ⬜ Todo | Organization, Dataset, BreadcrumbList schemas |
| Core Web Vitals audit | ⬜ Todo | Check PageSpeed Insights scores |

### Content & Pages

| Task | Status | Notes |
|------|--------|-------|
| Company pages (`/company/[cik]`) | ✅ Done | Shows insider transactions by company |
| Insider pages (`/insider/[cik]`) | ✅ Done | Shows transactions by individual |
| Filing detail pages (`/filing/[accession]`) | ✅ Done | Full Form 4 details with footnotes |
| Search page | ✅ Done | Search companies and insiders |
| SEC filings reference guide | ✅ Done | Educational content at /resources/sec-filings |
| Coverage/data status page | ✅ Done | Shows backfill progress |
| Blog / news section | ⬜ Todo | Notable insider activity posts |
| "How to read Form 4" guide | ⬜ Todo | Educational content |
| Monthly/weekly roundup pages | ⬜ Todo | "[Month] insider trading activity" |

### Social Distribution

| Task | Status | Notes |
|------|--------|-------|
| Create Twitter/X account | ⬜ Todo | @whatsfiled or similar |
| First tweet | ⬜ Todo | Announce the product |
| Notable transaction posting | ⬜ Todo | Manual or automated |
| Twitter automation setup | ⬜ Todo | Auto-post significant insider buys |
| Reddit launch post | ⬜ Todo | r/stocks, r/investing |
| Hacker News Show HN | ⬜ Todo | When ready for dev audience |
| Newsletter / Substack | ⬜ Todo | Weekly digest |

### Product-Led Growth

| Task | Status | Notes |
|------|--------|-------|
| Email alerts for companies | ⬜ Todo | "Notify me when insiders trade at X" |
| User accounts / auth | ⬜ Partial | Sign-in page exists |
| Watchlists | ⬜ Todo | Save companies to track |
| Share buttons on filings | ⬜ Todo | Twitter share, copy link |
| Push notifications | ⬜ Todo | Browser notifications |

### API & Developer

| Task | Status | Notes |
|------|--------|-------|
| tRPC API (internal) | ✅ Done | Powers the frontend |
| Public REST API | ⬜ Todo | External developer access |
| API documentation | ⬜ Todo | OpenAPI spec, interactive docs |
| API authentication | ⬜ Todo | API keys |
| Rate limiting | ⬜ Todo | Per-key limits |
| Python client library | ⬜ Todo | `whatsfiled-python` |
| JavaScript client library | ⬜ Todo | `whatsfiled-js` |

---

## Priority Roadmap

### Phase 1: Foundation (Now)
1. ✅ Submit sitemap to Google Search Console
2. ⬜ Create Twitter account
3. ⬜ Post first notable insider trade

### Phase 2: Distribution (Next)
1. ⬜ Set up basic Twitter automation for large insider buys
2. ⬜ Write 2-3 blog posts about interesting insider activity
3. ⬜ Reddit launch post

### Phase 3: Retention (After)
1. ⬜ Email alerts for watched companies
2. ⬜ User watchlists
3. ⬜ OpenGraph images for better social sharing

### Phase 4: Expansion (Later)
1. ⬜ Public API launch
2. ⬜ Hacker News Show HN
3. ⬜ Newsletter

---

## Target Users

| Segment | Description | Where to Find |
|---------|-------------|---------------|
| Retail investors | Individual stock traders researching insider activity | Twitter fintwit, Reddit, StockTwits |
| Financial bloggers | Newsletter writers needing data | Substack, Twitter |
| Developers | Building finance tools | Hacker News, dev Twitter, GitHub |
| Day traders | Looking for real-time signals | Discord trading servers, Twitter |

---

## Competitors & Positioning

| Competitor | Pricing | Our Advantage |
|------------|---------|---------------|
| OpenInsider | Free | Cleaner UI, better mobile, separates signal from noise |
| WhaleWisdom | Freemium | Free Form 4 focus, simpler interface |
| Dataroma | Free | Modern design, faster updates |
| SEC EDGAR | Free | Parsed data, not raw XML |
| Quiver Quant | Paid | Free alternative |

**Positioning:** Free, clean, focused insider trading tracker that separates high-signal market trades from routine compensation events.

---

## Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| Organic search traffic | Google Search Console | 1k visits/month in 6 months |
| Pages indexed | Google Search Console | All company pages indexed |
| Twitter followers | Twitter | 1k in 3 months |
| Return visitors | Vercel Analytics | 20% weekly return rate |
| Email signups | (when implemented) | 500 in 3 months |
