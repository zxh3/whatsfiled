# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whatsfiled is a full-stack application for aggregating and parsing SEC EDGAR filings, with a focus on insider trading forms (Form 4, Form 4/A). It uses Next.js 16 with React 19 for the frontend and Convex as the backend/database.

## Commands

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # Run Biome linter
npm run format       # Format with Biome (auto-fix)
npm run script:start # Run scripts via tsx (scripts/main.ts)
npm run script:dev   # Run scripts in watch mode
```

For Convex development, run `npx convex dev` in a separate terminal to sync schema and functions.

## Architecture

### Data Pipeline

The system uses a three-stage pipeline processed by cron jobs:

1. **Raw Index Fetch** (00:00 UTC): Downloads SEC EDGAR daily index files
2. **Row Parsing** (01:00 UTC): Parses index files into individual filing rows
3. **Form Parsing**: Extracts and validates Form 4 XML documents

### Key Directories

- `src/` - Next.js frontend (App Router)
  - `components/ui/` - Shadcn UI components
  - `components/convex-provider.tsx` - Convex client wrapper
- `convex/` - Backend functions and database
  - `schema.ts` - Database tables: `rawEdgarDailyIndexForms`, `rawEdgarDailyIndexFormRows`, `parsedForm4Docs`
  - `secFilings.ts` - Core business logic (mutations, queries, actions)
  - `crons.ts` - Scheduled jobs
  - `edgarParser/` - SEC EDGAR parsing logic
    - `form4/` - Form 4 specific parsing with XML schema normalization
  - `_generated/` - Auto-generated types (do not edit)

### Backend Patterns

- **Internal functions**: Prefixed with `_` (e.g., `_insertRawEdgarDailyIndexForm`) for internal-only use
- **State machine**: Records track state (`pending` → `processed` → `failed`)
- **Idempotency**: Insert operations check for existing records
- **Retry with backoff**: HTTP requests use exponential backoff (1s to 60s)
- **Batch operations**: Database writes chunked in groups of 100

### Form 4 Parsing

Located in `convex/edgarParser/form4/`:
- Extracts XML from SEC document wrappers (between `<XML>` tags)
- Uses fast-xml-parser for parsing
- Normalizes across multiple schema versions
- Validates required fields (CIK, owners, period, signatures)

## TypeScript Configuration

- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled
- Biome handles linting with Next.js and React recommended rules
