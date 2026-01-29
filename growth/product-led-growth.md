# Product-Led Growth

## Why This Matters

Product features that naturally encourage sharing and return visits:
- Lower CAC (users acquire other users)
- Higher retention (users have reasons to come back)
- Builds habit and switching costs

## Strategy 1: Alerts & Notifications

**"Get notified when insiders trade at [COMPANY]"**

### Implementation
- Email alerts when insider buys/sells at watched companies
- Optional: Browser push notifications
- Optional: SMS for power users (paid feature?)

### User Flow
1. User views company page
2. CTA: "Get alerts for this company"
3. Enter email (creates account)
4. Receive email when Form 4 filed

### Why It Works
- Creates reason to return
- Email capture for remarketing
- Habit formation

### MVP Version
- Simple email signup per company
- Daily digest of watched companies
- No account required initially

## Strategy 2: Watchlists

**"Track your portfolio's insider activity"**

### Features
- Add companies to watchlist
- Dashboard showing recent activity across watchlist
- Watchlist-specific alerts

### User Flow
1. Sign up / create account
2. Add tickers to watchlist
3. Homepage shows watchlist activity first

### Why It Works
- Personalization increases engagement
- More invested users (literally)
- Reason to create account

## Strategy 3: Shareable Content

Make it easy to share specific transactions and findings.

### Shareable Filing Pages
- `/filing/[accessionNumber]` already exists
- Add OpenGraph images (auto-generated preview cards)
- Include key data in OG description

### Share Buttons
- Twitter share with pre-filled text
- Copy link button
- "Share this transaction" CTA

### Embeddable Widgets (Future)
- Embed insider activity table on other sites
- Like TradingView widgets
- Attribution link back to WhatsFiled

## Strategy 4: Public Profiles

**For insiders and companies**

### Company Profiles
- `/company/[cik]` exists
- Add: historical charts, summary stats
- "Most active insiders" section
- Make it the definitive page for that company's insider data

### Insider Profiles
- `/insider/[cik]` exists
- Add: track record, total bought/sold
- "Also an insider at [other companies]"

### Why It Works
- Link-worthy pages (SEO benefit)
- Shareable profiles
- Comprehensive = credible

## Strategy 5: Free vs Paid (Future)

If you want to monetize while keeping growth:

### Free Tier (Growth Driver)
- All current features
- Basic alerts (daily digest)
- Limited watchlist (10 companies?)

### Paid Tier (Revenue)
- Real-time alerts
- Unlimited watchlist
- API access
- Historical data export
- Advanced filters

### Why It Works
- Free tier drives word-of-mouth
- Paid tier captures value from power users
- Classic freemium model

## Feature Priority Matrix

| Feature | Effort | Growth Impact | Priority |
|---------|--------|---------------|----------|
| Email alerts | Medium | High | 1 |
| Shareable OG images | Low | Medium | 2 |
| Watchlist | Medium | High | 3 |
| Share buttons | Low | Low | 4 |
| Embeddable widgets | High | Medium | Later |

## Measuring Success

- Accounts created
- Alerts set up per user
- Return visit rate (weekly active / monthly active)
- Shares per notable transaction
