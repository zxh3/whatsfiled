# Company Page Redesign Proposal

## Overview

Redesign the company page (`/company/:cik`) to display insider trading data in a more compact, scannable table format inspired by [secform4.com](https://www.secform4.com/insider-trading/1744489.htm).

**Current state**: Card-based layout that aggregates transactions per filing, resulting in an overwhelming view for companies with many filings.

**Target state**: Compact table view showing individual transactions with filtering by transaction type.

---

## Problems with Current Design

1. **Card layout is spacious** - Each filing takes significant vertical space
2. **Aggregates hide details** - "Mixed" transactions obscure whether it's an option exercise + sale vs multiple purchases
3. **No filtering** - Users can't focus on specific transaction types (e.g., only market purchases/sales)
4. **Filing-centric view** - Shows one row per filing, but users care about individual transactions

---

## Proposed Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Company Header (name, ticker, CIK)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [All] [Market Trades] [Options & Awards]     <- Filter tabs    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Date     Type    Insider          Shares  Price  Value  ... ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Jan 22   Sell    Coleman Sonia L  2.5K    $114   $282K  ... ││
│  │ Jan 20   Exercise WOODFORD BRENT  3.1K    $113   $90K   ... ││
│  │ Jan 20   Tax     Coleman Sonia L  1.1K    $113   $125K  ... ││
│  │ ...                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  < 1  2  3  ...  9  10 >                      <- Pagination     │
│                                                                 │
│  Activity Chart (optional, below table)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Removed**: Insider Roster sidebar - redundant since insider names are shown in each transaction row and link to their individual pages.

### Transaction Table Columns

| Column | Description | Width |
|--------|-------------|-------|
| Date | Transaction date (not filing date) | narrow |
| Type | Badge: Buy, Sell, Exercise, Award, Gift, Tax, etc. | narrow |
| Insider | Name + title (linked) | flexible |
| Shares | Number formatted (e.g., "2.5K") | narrow |
| Price | Per share price | narrow |
| Value | Total transaction value | narrow |
| Owned | Shares owned after transaction | narrow |
| Filing | Link to filing details | narrow |

### Transaction Type Filters

**Tab/chip options:**

1. **All** - Show all transactions (default)
2. **Market Trades** - Open market buys/sells only
   - `P` = Purchase
   - `S` = Sale
3. **Options & Awards** - Derivative-related transactions
   - `M` = Exercise of derivative
   - `A` = Award/grant
   - `F` = Tax withholding (payment via securities)
   - `C` = Conversion
   - `G` = Gift

**SEC Transaction Code Reference:**

| Code | Description | Category |
|------|-------------|----------|
| P | Open market or private purchase | Market |
| S | Open market or private sale | Market |
| A | Grant, award, or other acquisition | Options/Awards |
| M | Exercise or conversion of derivative | Options/Awards |
| F | Payment of exercise price or tax liability | Options/Awards |
| C | Conversion of derivative security | Options/Awards |
| G | Gift | Other |
| D | Disposition to issuer | Other |
| J | Other (describe) | Other |
| K | Equity swap or similar | Other |
| W | Acquisition by will/inheritance | Other |

### Type Badge Colors

| Type | Color | Codes |
|------|-------|-------|
| Buy | Green (`bg-green-100 text-green-800`) | P |
| Sell | Red (`bg-red-100 text-red-800`) | S |
| Exercise | Blue (`bg-blue-100 text-blue-800`) | M |
| Award | Purple (`bg-purple-100 text-purple-800`) | A |
| Tax | Yellow (`bg-yellow-100 text-yellow-800`) | F |
| Gift | Gray (`bg-gray-100 text-gray-800`) | G |
| Other | Gray (`bg-gray-100 text-gray-800`) | C, D, J, K, W |

---

## Implementation Plan

### Phase 1: Backend Changes

**File: `apps/backend/src/trpc/routers/companies.ts`**

Add a new procedure or modify `getByCik` to return transaction-level data:

```typescript
// New procedure: getTransactionsByCik
getTransactionsByCik: publicProcedure
  .input(z.object({
    cik: z.string(),
    filter: z.enum(['all', 'market', 'options']).default('all'),
    limit: z.number().default(50),
    offset: z.number().default(0),
  }))
  .query(async ({ input }) => {
    // Returns individual transactions with:
    // - transaction details (date, code, shares, price, value)
    // - insider info (name, cik, title)
    // - filing info (accessionNumber, filedAt)
    // - company info (already known from CIK)
  })
```

**Query logic:**
- Join `transactions` -> `filings` -> `filing_owners` -> `insiders`
- Filter by company CIK
- Filter by transaction code based on `filter` param:
  - `market`: `transaction_code IN ('P', 'S')`
  - `options`: `transaction_code IN ('M', 'A', 'F', 'C', 'G')`
  - `all`: no filter
- Order by `transaction_date DESC, filed_at DESC`
- Paginate with limit/offset

### Phase 2: Frontend Components

**New file: `apps/web/src/components/filings/transaction-table.tsx`**

```typescript
interface TransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

interface Transaction {
  id: string;
  transactionDate: Date | null;
  transactionCode: string | null;
  shares: number | null;
  pricePerShare: number | null;
  totalValue: number | null;
  sharesOwnedAfter: number | null;
  acquiredDisposed: 'A' | 'D' | null;
  insider: {
    id: string;
    name: string;
    cik: string | null;
    title: string | null;
  };
  filing: {
    accessionNumber: string;
    filedAt: Date;
  };
}
```

**New file: `apps/web/src/components/filings/transaction-filter.tsx`**

```typescript
interface TransactionFilterProps {
  value: 'all' | 'market' | 'options';
  onChange: (value: 'all' | 'market' | 'options') => void;
  counts?: {
    all: number;
    market: number;
    options: number;
  };
}
```

### Phase 3: Page Integration

**File: `apps/web/src/routes/company.$cik.tsx`**

1. Add filter state via URL search params (for shareable links)
2. Replace `FilingCard` list with `TransactionTable`
3. Add `TransactionFilter` above the table
4. Remove insider roster sidebar (redundant - insiders shown in table rows)
5. Move activity chart below table or make collapsible

**Search params schema:**
```typescript
const searchSchema = z.object({
  filter: z.enum(['all', 'market', 'options']).default('all'),
  page: z.coerce.number().default(1),
});
```

---

## Data Flow

```
User clicks filter tab
        │
        ▼
URL updates with ?filter=market&page=1
        │
        ▼
Route.useSearch() returns new filter value
        │
        ▼
tRPC query refetches with new filter
        │
        ▼
Backend returns filtered transactions
        │
        ▼
TransactionTable re-renders with new data
```

---

## Migration Notes

### Backward Compatibility

- Keep `FilingCard` component (used elsewhere, e.g., activity feed, filing page)
- The new table is specific to the company page view

### Data Already Available

The `transactions` table already has all required fields:
- `transaction_date` - for the Date column
- `transaction_code` - for filtering and Type badge
- `shares` - for Shares column
- `price_per_share` - for Price column
- `shares_owned_after` - for Owned column
- `acquired_disposed` - to determine buy vs sell direction

We just need to join with `filings`, `filing_owners`, and `insiders`.

---

## Open Questions

1. **Pagination UX**: Simple "Load more" button vs page numbers vs infinite scroll?
   - Recommendation: Page numbers (like secform4) for predictable navigation

2. **Default page size**: 25, 50, or 100 transactions?
   - Recommendation: 50 (matches current filing limit)

3. **Activity chart**: Keep it, remove it, or make collapsible?
   - Recommendation: Remove for now (simplify), can add back later if needed

4. **Mobile responsiveness**: How should table adapt on small screens?
   - Recommendation: Horizontal scroll with sticky first column (Insider name)

---

## Estimated Effort

| Task | Scope |
|------|-------|
| Backend: new query procedure | Small |
| TransactionTable component | Medium |
| TransactionFilter component | Small |
| Company page integration | Medium |
| Testing & polish | Small |

---

## References

- [secform4.com/insider-trading/1744489.htm](https://www.secform4.com/insider-trading/1744489.htm) - Design inspiration
- [SEC Form 4 Transaction Codes](https://www.sec.gov/about/forms/form4data.pdf) - Official code definitions
