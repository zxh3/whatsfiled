# SEC Filings Reference Guide

A comprehensive guide to SEC filings, their purposes, and filing requirements.

---

## Insider Transaction Forms (Section 16)

### Form 3 - Initial Statement of Beneficial Ownership

**What it is:**
The initial disclosure filed when a person becomes an "insider" of a public company.

**Who must file:**
- Directors
- Officers (CEO, CFO, COO, etc.)
- Beneficial owners of more than 10% of a class of equity securities

**What it contains:**
- Reporting person's name and relationship to issuer
- All equity securities beneficially owned at the time of becoming an insider
- Nature of ownership (direct or indirect)

**Filing deadline:**
Within **10 days** of becoming an insider (officer, director, or 10% owner).

**Signal value:**
Low - provides baseline context but no trading activity.

---

### Form 4 - Statement of Changes in Beneficial Ownership

**What it is:**
The primary disclosure form for insider transactions. Reports any change in beneficial ownership of company securities.

**Who must file:**
- Directors
- Officers
- Beneficial owners of more than 10% of a class of equity securities

**What it contains:**
- Transaction date
- Transaction type (purchase, sale, gift, option exercise, etc.)
- Number of securities
- Price per share
- Securities owned after the transaction
- Whether ownership is direct or indirect
- Transaction codes (P = Purchase, S = Sale, A = Award, M = Option Exercise, etc.)

**Filing deadline:**
Within **2 business days** of the transaction.

**Signal value:**
High - the most important form for tracking insider trading activity.

---

### Form 4/A - Amendment to Form 4

**What it is:**
A correction or amendment to a previously filed Form 4.

**Why it's filed:**
- Incorrect price reported
- Wrong number of shares
- Missing transactions
- Clerical or data entry errors

**Important:**
Form 4/A **supersedes** the original Form 4. When processing data, you must upsert (update or insert) rather than double-count transactions.

**Filing deadline:**
Filed as soon as the error is discovered. No specific deadline.

---

### Form 5 - Annual Statement of Beneficial Ownership

**What it is:**
An annual report of transactions that were not required to be reported on Form 4, or transactions that should have been reported but were missed.

**Who must file:**
Same as Form 3 and Form 4 - directors, officers, and 10% beneficial owners.

**What it contains:**
- Transactions exempt from Form 4 reporting
- Late transactions that should have been on Form 4
- Small acquisitions under certain thresholds

**Filing deadline:**
Within **45 days** after the end of the issuer's fiscal year.

**Signal value:**
Low - often contains stale information. Useful for completeness but not timely signals.

---

## Corporate Disclosure Forms

### Form 10-K - Annual Report

**What it is:**
Comprehensive annual report providing a complete overview of a company's business and financial condition.

**Who must file:**
All public companies registered with the SEC.

**What it contains:**
- Business description
- Risk factors
- Selected financial data (5 years)
- Management's Discussion and Analysis (MD&A)
- Audited financial statements
- Executive compensation
- Related party transactions

**Filing deadline:**
- **Large accelerated filers** (public float >= $700M): 60 days after fiscal year end
- **Accelerated filers** (public float $75M - $700M): 75 days after fiscal year end
- **Non-accelerated filers** (public float < $75M): 90 days after fiscal year end

---

### Form 10-Q - Quarterly Report

**What it is:**
Quarterly update on a company's financial condition.

**Who must file:**
All public companies (except for Q4, which is covered by 10-K).

**What it contains:**
- Unaudited financial statements
- MD&A for the quarter
- Updates on legal proceedings
- Risk factor updates
- Controls and procedures updates

**Filing deadline:**
- **Large accelerated filers**: 40 days after quarter end
- **Accelerated filers**: 40 days after quarter end
- **Non-accelerated filers**: 45 days after quarter end

---

### Form 8-K - Current Report

**What it is:**
Report of significant events that shareholders should know about between regular quarterly and annual reports.

**Who must file:**
All public companies when a triggering event occurs.

**Triggering events include:**
- Entry into or termination of material agreements
- Bankruptcy or receivership
- Acquisition or disposition of assets
- Changes in control
- Departure of directors or principal officers
- Changes in fiscal year
- Amendments to articles of incorporation or bylaws
- Changes in accounting firm
- Financial statements and exhibits
- Regulation FD disclosures

**Filing deadline:**
Within **4 business days** of the triggering event.

---

## Ownership & Proxy Forms

### Schedule 13D - Beneficial Ownership Report

**What it is:**
Disclosure required when a person or group acquires more than 5% of a company's voting securities with an intent to influence control.

**Who must file:**
Any person or group acquiring beneficial ownership of more than 5% of a class of equity securities.

**What it contains:**
- Identity and background of the filer
- Source and amount of funds used for acquisition
- Purpose of the transaction
- Number of shares owned
- Any contracts or arrangements regarding the securities

**Filing deadline:**
Within **10 days** of crossing the 5% threshold.

**Amendments (13D/A):**
Must be filed "promptly" (generally within 2 business days) upon any material change.

---

### Schedule 13G - Beneficial Ownership Report (Short Form)

**What it is:**
Simplified version of Schedule 13D for passive investors with no intent to influence control.

**Who qualifies:**
- Qualified institutional investors (QIIs) - mutual funds, banks, etc.
- Passive investors (less than 20% ownership, no intent to change control)
- Exempt investors

**Filing deadline:**
- **QIIs**: Within 45 days of calendar year end (if over 5% at year end)
- **Passive investors**: Within 10 days of crossing 5%

**Amendments:**
- QIIs: Within 45 days of calendar year end, or within 10 days of crossing 10%
- Passive investors: Promptly upon crossing 10%, or within 45 days of year end for other changes

---

### DEF 14A - Definitive Proxy Statement

**What it is:**
Official proxy statement sent to shareholders before an annual meeting.

**Who must file:**
All companies holding shareholder meetings.

**What it contains:**
- Matters to be voted on
- Executive compensation details
- Director nominations
- Board committee information
- Related party transactions
- Shareholder proposals

**Filing deadline:**
Must be filed with SEC at least **10 days** before mailing to shareholders.

---

## Registration & Offering Forms

### Form S-1 - Registration Statement

**What it is:**
Registration statement for companies conducting an initial public offering (IPO) or registering securities for the first time.

**What it contains:**
- Prospectus
- Business description
- Financial statements
- Use of proceeds
- Risk factors
- Management information

**Filing deadline:**
Must be filed before securities can be offered to the public.

---

### Form S-3 - Short-Form Registration

**What it is:**
Simplified registration for companies already reporting to the SEC for at least 12 months.

**Requirements:**
- At least 12 months of SEC reporting history
- Timely filed all required reports
- Minimum public float requirements (for primary offerings)

---

### Form S-4 - Registration for Business Combinations

**What it is:**
Registration of securities issued in mergers, acquisitions, or exchange offers.

**When used:**
- Mergers
- Acquisitions
- Stock-for-stock exchanges
- Reclassifications

---

## Investment Company Forms

### Form 13F - Quarterly Holdings Report

**What it is:**
Quarterly disclosure of equity holdings by institutional investment managers.

**Who must file:**
Institutional investment managers with over $100 million in qualifying assets under management.

**What it contains:**
- Name and class of securities
- CUSIP number
- Number of shares
- Market value
- Investment discretion type
- Voting authority

**Filing deadline:**
Within **45 days** after the end of each calendar quarter.

---

### Form N-PORT - Monthly Portfolio Holdings

**What it is:**
Monthly portfolio holdings report for registered investment companies.

**Who must file:**
Mutual funds and ETFs.

**Filing deadline:**
Within **60 days** after month end (only Q3 month-end reports are public).

---

## Quick Reference: Filing Deadlines

| Form | Deadline |
|------|----------|
| Form 3 | 10 days of becoming insider |
| Form 4 | 2 business days of transaction |
| Form 5 | 45 days after fiscal year end |
| Form 8-K | 4 business days of event |
| Form 10-Q | 40-45 days after quarter end |
| Form 10-K | 60-90 days after fiscal year end |
| Schedule 13D | 10 days of crossing 5% |
| Schedule 13G | 45 days after year end (QIIs) |
| Form 13F | 45 days after quarter end |
| DEF 14A | 10 days before mailing |

---

## Filer Categories

| Category | Public Float | 10-K Deadline | 10-Q Deadline |
|----------|-------------|---------------|---------------|
| Large Accelerated | >= $700M | 60 days | 40 days |
| Accelerated | $75M - $700M | 75 days | 40 days |
| Non-Accelerated | < $75M | 90 days | 45 days |
| Smaller Reporting | < $250M or < $100M revenue | 90 days | 45 days |

---

## Transaction Codes (Form 4)

| Code | Description |
|------|-------------|
| P | Open market or private purchase |
| S | Open market or private sale |
| A | Grant or award |
| D | Sale or transfer to issuer |
| F | Payment of exercise price or tax with securities |
| I | Discretionary transaction |
| M | Exercise or conversion of derivative |
| C | Conversion of derivative security |
| E | Expiration of short derivative position |
| G | Gift |
| L | Small acquisition |
| W | Acquisition or disposition by will or inheritance |
| Z | Deposit into or withdrawal from voting trust |
| J | Other acquisition or disposition |
| K | Equity swap or similar instrument |
| U | Disposition due to tender of shares |

---

## Resources

- SEC EDGAR: https://www.sec.gov/cgi-bin/browse-edgar
- SEC Filing Search: https://www.sec.gov/search-filings
- SEC Forms List: https://www.sec.gov/forms
