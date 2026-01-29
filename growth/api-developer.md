# API & Developer Ecosystem

## Why This Matters

An API strategy can:
- Create distribution through apps built on your data
- Reach developer communities (HN, dev Twitter)
- Generate revenue from B2B/enterprise
- Build moat through ecosystem

## Strategy 1: Public API

### What to Offer

**Free Tier**
- Recent filings (last 30 days)
- Basic company/insider lookup
- Rate limit: 100 requests/day
- Attribution required

**Paid Tier**
- Historical data (full archive)
- Higher rate limits
- Bulk export endpoints
- No attribution required
- Webhooks for real-time

### Endpoints (MVP)

```
GET /api/v1/filings
  ?ticker=AAPL
  &from=2025-01-01
  &to=2025-01-31

GET /api/v1/filings/:accessionNumber

GET /api/v1/companies/:cik
GET /api/v1/companies/:cik/transactions

GET /api/v1/insiders/:cik
GET /api/v1/insiders/:cik/transactions
```

### Documentation
- OpenAPI/Swagger spec
- Interactive docs (Swagger UI or similar)
- Code examples in Python, JavaScript
- "Getting Started" guide

## Strategy 2: Developer Marketing

### Hacker News
- "Show HN: Free API for SEC insider trading data"
- Technical angle: parsing challenges, data model
- Be active in comments

### Dev Twitter
- Tweet about the API launch
- Share interesting things you can build with it
- Engage with fintech/data developers

### GitHub
- Open source the client libraries
- `whatsfiled-python`, `whatsfiled-js`
- README with examples
- Stars = social proof

### Product Hunt
- Launch the API specifically
- Developer tools category
- Good for initial visibility spike

## Strategy 3: Integrations

Build or encourage integrations with popular tools:

### Spreadsheets
- Google Sheets add-on
- Excel plugin
- `=WHATSFILED("AAPL", "insider_buys_30d")`

### Trading Platforms
- TradingView indicators
- Notion databases
- Airtable integration

### No-Code Tools
- Zapier integration
- Make (Integromat)
- n8n

## Strategy 4: B2B / Enterprise

Longer-term revenue opportunity:

### Target Customers
- Hedge funds
- Financial advisors
- Fintech startups
- Research firms

### What They Pay For
- Bulk data access
- Real-time webhooks
- Custom data feeds
- SLA guarantees
- Historical archive

### Pricing
- Self-serve: $99-299/month
- Enterprise: Custom pricing

## Implementation Roadmap

### Phase 1: Foundation
- [ ] Design API schema
- [ ] Implement basic endpoints
- [ ] Add API key authentication
- [ ] Rate limiting

### Phase 2: Documentation
- [ ] OpenAPI spec
- [ ] Interactive docs page
- [ ] Getting started guide
- [ ] Code examples

### Phase 3: Launch
- [ ] Announce on HN, Twitter, PH
- [ ] Python client library
- [ ] JavaScript client library

### Phase 4: Monetization
- [ ] Paid tier implementation
- [ ] Stripe integration
- [ ] Usage tracking

## Technical Considerations

### Current Architecture
- tRPC API exists internally
- Would need REST wrapper or separate REST API
- Consider GraphQL for flexibility

### Authentication Options
- API keys (simple, recommended to start)
- OAuth (for user-specific data)
- JWT tokens

### Rate Limiting
- Redis-based rate limiting
- Per-key limits
- Graceful degradation

## Measuring Success

- API keys created
- Monthly active API users
- Requests per day
- Conversion to paid tier
- Apps built on API (qualitative)

## Competition

- SEC EDGAR API (official, raw data, complex)
- OpenInsider (no API)
- Quiver Quant (paid API)
- Polygon.io (expensive, broad)

**Positioning:** Free tier more generous than competitors, focused specifically on insider trading data
