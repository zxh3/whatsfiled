# SEO & Content Marketing

## Why This Matters

SEO is the highest-ROI channel for data products like WhatsFiled:
- Users actively searching for insider trading data have high intent
- Content compounds over time (unlike paid ads)
- Free traffic once you rank

## Strategy 1: Company Page SEO

**Target keywords:** "[TICKER] insider trading", "[COMPANY] insider buying", "[TICKER] Form 4"

### Current State
- Company pages exist at `/company/[cik]`
- Good meta descriptions already in place
- Need to ensure Google can discover and crawl them

### Action Items

- [ ] **Generate XML sitemap** with all company pages
  - Prioritize S&P 500 and popular tickers
  - Include lastmod dates for freshness signals

- [ ] **Submit to Google Search Console**
  - Verify domain ownership
  - Submit sitemap
  - Monitor indexing status

- [ ] **Improve internal linking**
  - Link from activity feed to company pages
  - Link between related companies (same sector)
  - Add "Related Companies" section

- [ ] **Add structured data (JSON-LD)**
  - Organization schema for company pages
  - BreadcrumbList for navigation
  - Consider Dataset schema for the data

## Strategy 2: Long-Tail Content Pages

Create pages targeting specific search queries:

### Insider Pages
- `/insider/[cik]` already exists
- Target: "[PERSON NAME] stock trades", "[CEO NAME] insider trading"

### Educational Content
- `/resources/sec-filings` already exists (good!)
- Add more guides:
  - "How to Read Form 4 Filings"
  - "What Insider Buying Signals Mean"
  - "Form 4 vs Form 3 vs Form 5 Explained"

### Time-Based Pages (Optional)
- `/insider-trading/2025/01` - Monthly summaries
- Good for "insider trading January 2025" searches

## Strategy 3: Blog / News Content

Write about notable insider activity to capture news-driven searches.

### Content Types

1. **Notable Transaction Posts**
   - "CEO of [Company] Buys $5M in Stock"
   - Include context, historical comparison
   - Publish within 24-48 hours of filing

2. **Weekly/Monthly Roundups**
   - "Biggest Insider Buys This Week"
   - "Tech Sector Insider Activity - January 2025"
   - Evergreen URL structure for SEO

3. **Educational Deep Dives**
   - "Why Cluster Buying Matters"
   - "Reading Insider Signals: What Works"

### Where to Publish
- Option A: `/blog` on whatsfiled.com (best for SEO)
- Option B: Substack (easier to start, has built-in distribution)
- Recommendation: Start with Substack, move to owned blog later

## Technical SEO Checklist

- [ ] Verify robots.txt allows crawling
- [ ] Check page load speed (Core Web Vitals)
- [ ] Ensure mobile responsiveness
- [ ] Add canonical URLs to prevent duplicates
- [ ] Implement proper 404 pages
- [ ] Add OpenGraph images for social sharing

## Measuring Success

Track in Google Search Console:
- Impressions for target keywords
- Click-through rates
- Average position
- Pages indexed

Target: Rank on page 1 for "[POPULAR_TICKER] insider trading" within 3-6 months
