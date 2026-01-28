# Backend CLAUDE.md

Backend-specific guidance for Claude Code.

## Scripts

Located in `src/scripts/`. Run with `pnpm --filter @whatsfiled/backend tsx src/scripts/<script>.ts`.

### backfill.ts - SEC EDGAR Backfill CLI

Main script for backfilling SEC filings from EDGAR. Runs a 3-stage pipeline:

1. **Discovery** - Finds daily index files for a year
2. **Index** - Processes index files, queues filings
3. **Filing** - Fetches and parses queued filings

```bash
# Show help
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --help

# Dry run discovery for a year
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2026 --dry-run

# Run full pipeline with limit
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --year 2026 --limit 10

# Run specific stage only
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage discovery --year 2026
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage index --limit 20
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage filing --limit 50

# Show pipeline statistics
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --stage stats
```

**Options:**
- `-y, --year <year>` - Year to backfill (required for discovery)
- `-s, --stage <stage>` - Stage: `discovery`, `index`, `filing`, `stats`, `all` (default: `all`)
- `-l, --limit <n>` - Limit items to process
- `--dry-run` - Don't modify the database
- `-h, --help` - Show help

### cleanup-stuck.ts - Reset Stuck Processing Entries

Resets filings stuck in "processing" status back to "pending". Useful when a previous run was interrupted.

```bash
pnpm --filter @whatsfiled/backend tsx src/scripts/cleanup-stuck.ts
```

### check-data.ts - Database Contents Summary

Shows counts and sample data from all tables.

```bash
pnpm --filter @whatsfiled/backend tsx src/scripts/check-data.ts
```

Output includes:
- Row counts for companies, insiders, filings, transactions
- Sample filings with accession numbers

## Pipeline Architecture

The filing pipeline in `src/pipeline/` handles:

- **Daily index discovery** - Lists available index files from EDGAR
- **Index processing** - Parses index files, queues Form 4/4A filings
- **Filing processing** - Fetches, parses, and stores filing data
- **Lock management** - Prevents duplicate processing with time-based locks
