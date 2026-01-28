# @whatsfiled/trigger

SEC EDGAR data pipeline powered by [Trigger.dev](https://trigger.dev). Discovers, fetches, parses, and stores SEC filings (Form 4, etc.) into the database.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Trigger.dev Cloud                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  dailySyncSchedule │ ◄─── Cron: 6 AM UTC daily                          │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐     Fetches index file list from SEC EDGAR           │
│  │ discoverIndexFiles │     Inserts new records into daily_index_files     │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           │ triggers N tasks (one per index file)                          │
│           ▼                                                                 │
│  ┌──────────────────┐     Parses index file, extracts filing entries       │
│  │ processIndexFile  │     Inserts into filing_queue                        │
│  └────────┬─────────┘     (SEC rate-limited queue, concurrency: 3)         │
│           │                                                                 │
│           │ triggers N tasks (one per filing)                              │
│           ▼                                                                 │
│  ┌──────────────────┐     Fetches filing from SEC EDGAR                    │
│  │  processFiling    │     Dispatches to processor based on form type       │
│  └────────┬─────────┘     (SEC rate-limited queue, concurrency: 3)         │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ Form4Processor    │     Parses Form 4 XML, maps to DB schema            │
│  │ (registry)        │     Creates: companies, insiders, filings,          │
│  └──────────────────┘              transactions, holdings, footnotes       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │    PostgreSQL     │
                            │    (Supabase)     │
                            └──────────────────┘
```

## Pipeline Stages

### 1. Discovery (`discoverIndexFilesTask`)

Fetches the list of daily index files from SEC EDGAR for a given year. Each index file contains a list of all filings submitted that day.

**Input:** Year, form types
**Output:** Index file records in `daily_index_files` table

### 2. Index Processing (`processIndexFileTask`)

Parses a daily index file and extracts filing metadata (company, CIK, file path). Creates queue entries for each filing.

**Input:** Index file ID
**Output:** Filing entries in `filing_queue` table

### 3. Filing Processing (`processFilingTask`)

Fetches the actual filing content from SEC EDGAR and dispatches to the appropriate processor based on form type.

**Input:** Queue entry ID
**Output:** Parsed filing data in database

### 4. Form Processors (Registry Pattern)

Form-specific processors handle parsing and database mapping:

| Processor | Form Types | Description |
|-----------|------------|-------------|
| `Form4Processor` | 4, 4/A | Insider trading reports |
| *(future)* | 3, 3/A | Initial beneficial ownership |
| *(future)* | 5, 5/A | Annual beneficial ownership |

## Setup

### 1. Create Trigger.dev Project

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev)
2. Create a new project
3. Copy your project ref and secret key

### 2. Configure Environment

Create `packages/trigger/.env.local`:

```bash
TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxx
SEC_USER_AGENT=YourApp contact@example.com
DATABASE_URL=postgresql://user:pass@localhost:5432/whatsfiled
```

### 3. Start Dev Server

```bash
# Terminal 1: Start Trigger.dev dev server
pnpm --filter @whatsfiled/trigger dev
```

## CLI Usage

```bash
# Show help
pnpm --filter @whatsfiled/trigger cli --help

# Show pipeline statistics
pnpm --filter @whatsfiled/trigger cli stats

# List recent runs
pnpm --filter @whatsfiled/trigger cli runs
```

### Stage-by-Stage Processing

```bash
# Step 1: Discover what's available (doesn't process)
pnpm --filter @whatsfiled/trigger cli discover --year 2025

# Step 2: Process pending index files → creates filing queue entries
pnpm --filter @whatsfiled/trigger cli process indexes --limit 10 --wait

# Step 3: Process pending filings → creates filing records
pnpm --filter @whatsfiled/trigger cli process filings --limit 100 --wait
```

### Full Pipeline

```bash
# Run all stages in sequence for current year
pnpm --filter @whatsfiled/trigger cli sync --wait

# Run with limits (for testing)
pnpm --filter @whatsfiled/trigger cli sync --year 2026 --limit 5 --wait
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `stats` | Show counts from `daily_index_files` and `filing_queue` tables |
| `runs` | List recent Trigger.dev runs with links |
| `discover` | Discover index files for a year (no processing) |
| `process indexes` | Process pending index files → creates filing queue |
| `process filings` | Process pending filings → creates filing records |
| `sync` | Full pipeline: discover + process all |

### Options

| Option | Description |
|--------|-------------|
| `-y, --year <year>` | Year for discovery/sync (default: current year) |
| `-l, --limit <n>` | Limit items to process |
| `-f, --form-types <types>` | Form types, comma-separated (default: "4,4/A") |
| `-w, --wait` | Wait for completion and show result |

## Database Tables

The pipeline populates these tables:

```
daily_index_files     Filing queue & tracking
filing_queue          ─────────────────────────►  companies
                                                  insiders
                                                  insider_roles
                                                  filings
                                                  filing_owners
                                                  transactions
                                                  holdings
                                                  derivative_transactions
                                                  derivative_holdings
                                                  footnotes
```

## Adding New Form Types

The pipeline uses a registry pattern for extensibility. To add support for a new form type:

### 1. Create Parser (if needed)

Add parser to `@whatsfiled/edgar-client`:

```
packages/edgar-client/src/internal/form3/
├── parser.ts
├── normalizer.ts
└── types.ts
```

### 2. Create Processor

```typescript
// packages/trigger/src/processors/form3.ts
import type { FilingProcessor, ProcessorContext, ProcessorResult } from "./types.js";

export class Form3Processor implements FilingProcessor {
  readonly formTypes = ["3", "3/A"] as const;

  async process(ctx: ProcessorContext, db: Database): Promise<ProcessorResult> {
    // 1. Parse the filing
    const doc = edgarClient.parseForm3(ctx.content, { fileName: ctx.fileName });

    // 2. Map to database
    const result = await mapForm3ToDb(db, doc, { ... });

    return { success: true, filingId: result.filingId };
  }
}
```

### 3. Register Processor

```typescript
// packages/trigger/src/tasks/index.ts
import { Form3Processor } from "../processors/form3.js";

registerProcessor(new Form3Processor(SEC_USER_AGENT));
```

### 4. Update Discovery

```typescript
// When triggering backfill, include new form types
await backfillTask.trigger({
  year: 2026,
  formTypes: ["3", "3/A", "4", "4/A"],
});
```

## Rate Limiting

SEC EDGAR allows ~10 requests/second. The pipeline uses:

- **Concurrency limit:** 3 concurrent tasks in `sec-rate-limited` queue
- **Built-in backoff:** Trigger.dev retry with exponential backoff
- **EdgarClient delays:** 300ms between requests within a task

## Monitoring

### Trigger.dev Dashboard

View runs, logs, and errors at:
```
https://cloud.trigger.dev/projects/v3/<project-id>/runs
```

### Database Stats

```bash
pnpm --filter @whatsfiled/trigger cli stats
```

Output:
```
=== Pipeline Statistics ===

Index Files:
  Pending:    0
  Processing: 0
  Completed:  250
  Failed:     0
  Total:      250

Filing Queue:
  Pending:    0
  Processing: 0
  Completed:  45000
  Failed:     12
  Skipped:    500
  Total:      45512
```

## Deployment

Deploy to Trigger.dev cloud:

```bash
pnpm --filter @whatsfiled/trigger deploy
```

Set environment variables in Trigger.dev dashboard:
- `DATABASE_URL`
- `SEC_USER_AGENT`
