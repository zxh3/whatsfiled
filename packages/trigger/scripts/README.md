# Trigger Scripts

Scripts for managing the SEC filing pipeline.

## Local Backfill Script

Process SEC filings directly without Trigger.dev. Useful for:

- Large backfills that would hit Trigger.dev queue limits (500 tasks)
- Running against production DB from local machine
- Faster processing without task overhead

### Usage

**Always test on local DB first, then run on production.**

#### 1. Test on Local DB

```bash
# Start local PostgreSQL
pnpm docker:up

# Push schema if needed
pnpm db:push

# Run backfill against local DB
cd packages/trigger
DATABASE_URL="postgresql://user:password@localhost:5432/whatsfiled" \
  pnpm backfill-local --start 2025-01-01 --end 2025-01-07
```

#### 2. Run on Production (Supabase)

```bash
cd packages/trigger
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
  pnpm backfill-local --start 2025-01-01 --end 2025-01-31
```

### Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--start` | `-s` | Start date (YYYY-MM-DD) | required |
| `--end` | `-e` | End date (YYYY-MM-DD) | required |
| `--concurrency` | `-c` | Parallel DB operations | 3 |
| `--form-types` | `-f` | Form types to process | "4,4/A" |
| `--dry-run` | | Preview without processing | false |
| `--skip-discovery` | | Only process existing pending filings | false |
| `--help` | `-h` | Show help | |

### What It Does

The script runs three steps:

1. **Discovery** - Fetches index file list from SEC EDGAR for the date range, inserts records into `daily_index_files` table

2. **Index Processing** - Parses each index file, extracts filing entries, inserts into `filing_queue` table

3. **Filing Processing** - Fetches each filing from SEC, parses Form 4 XML, inserts into `filings`, `transactions`, `companies`, etc.

### Rate Limiting

SEC EDGAR allows 10 requests/second. This script currently enforces a strict **300ms minimum delay** between SEC requests, which caps throughput at about **3.3 req/s**.

All SEC HTTP requests are queued and processed sequentially to guarantee we never exceed the limit. The `--concurrency` flag only affects parallel database operations, not SEC requests.

### Examples

```bash
# Dry run to preview what would be processed
DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-07 --dry-run

# Backfill one week
DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-07

# Backfill one month
DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-31

# Backfill full year (will take a while)
DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-12-31

# Re-process failed/pending filings only (skip discovery)
DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-31 --skip-discovery

# Higher concurrency for faster DB writes
DATABASE_URL="..." pnpm backfill-local -s 2025-01-01 -e 2025-01-31 -c 5
```

### Troubleshooting

**"DATABASE_URL environment variable is required"**
- Pass the DATABASE_URL inline: `DATABASE_URL="..." pnpm backfill-local ...`

**Script seems slow**
- SEC rate limiting currently caps at about 3.3 req/s regardless of concurrency
- A typical day has ~200-400 Form 4 filings
- One month ≈ 5,000-8,000 filings ≈ 10-15 minutes

**Filings stuck in "pending" status**
- Use `--skip-discovery` to re-process existing pending filings
- Check `filing_queue.last_error` for failure reasons

## Sync Local DB to Production

Push filing data from local PostgreSQL to Supabase (excludes auth tables).

```bash
# Dump local data (exclude auth tables)
pg_dump --data-only \
  --exclude-table=users \
  --exclude-table=sessions \
  --exclude-table=accounts \
  --exclude-table=verifications \
  "postgresql://user:password@localhost:5432/whatsfiled" > data.sql

# Push to Supabase
PGPASSWORD="[password]" psql \
  "postgresql://postgres.[ref]@aws-0-us-west-1.pooler.supabase.com:6543/postgres" < data.sql
```

Or all-in-one:

```bash
pg_dump --data-only \
  --exclude-table=users \
  --exclude-table=sessions \
  --exclude-table=accounts \
  --exclude-table=verifications \
  "postgresql://user:password@localhost:5432/whatsfiled" | \
PGPASSWORD="[password]" psql \
  "postgresql://postgres.[ref]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
```

**Note:** This may fail on duplicate keys if data already exists in production. To handle conflicts, you can either:
- Truncate production tables first (destructive)
- Use `--on-conflict-do-nothing` with a custom import script

## CLI Script

The `cli.ts` script triggers Trigger.dev tasks remotely. See `pnpm cli --help` for usage.

```bash
# Show pipeline statistics
pnpm cli stats

# List recent Trigger.dev runs
pnpm cli runs

# Trigger discovery (via Trigger.dev)
pnpm cli discover --year 2025 --wait
```
