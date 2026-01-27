# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whatsfiled is a full-stack application for aggregating and parsing SEC EDGAR filings, with a focus on insider trading forms (Form 4, Form 4/A). It uses Next.js 16 with React 19 for the frontend and Convex as the backend/database.

This is a **Turborepo monorepo** with the following structure:

```
whatsfiled/
├── apps/
│   ├── web/                      # Next.js 16 frontend
│   └── backend/                  # Convex backend
│       └── convex/               # All Convex functions
├── packages/
│   ├── ui/                       # Shared Shadcn UI components
│   └── typescript-config/        # Shared TypeScript configs
├── scripts/                      # Development scripts
├── turbo.json                    # Turborepo configuration
└── package.json                  # Workspace root
```

## Commands

```bash
# Development
pnpm dev          # Start all dev servers via Turbo (Next.js + Convex)
pnpm build        # Production build
pnpm typecheck    # TypeScript type checking
pnpm lint         # Run Biome linter
pnpm format       # Format with Biome (auto-fix)

# Scripts
pnpm script:test-form4    # Run Form 4 parser test script

# Individual workspaces
pnpm --filter @whatsfiled/web dev       # Run only Next.js dev
pnpm --filter @whatsfiled/backend dev   # Run only Convex dev
```

For Convex development, run `cd apps/backend && pnpm convex dev` to sync schema and functions.

## Architecture

### Monorepo Structure

- **apps/web/**: Next.js 16 frontend (App Router)
  - `src/app/` - Pages and layouts
  - `src/components/` - App-specific components
  - Dependencies: `@whatsfiled/ui`, `@whatsfiled/backend`

- **apps/backend/**: Convex backend
  - `convex/schema.ts` - Database tables
  - `convex/secFilings.ts` - Core business logic
  - `convex/crons.ts` - Scheduled jobs
  - `convex/edgarParser/` - SEC EDGAR parsing logic
  - `convex/_generated/` - Auto-generated types (do not edit)

- **packages/ui/**: Shared Shadcn UI components
  - `src/components/` - 14 Shadcn components (button, card, input, etc.)
  - `src/lib/utils.ts` - Tailwind utility functions

- **packages/typescript-config/**: Shared tsconfig bases
  - `base.json` - Common settings
  - `nextjs.json` - Next.js specific
  - `convex.json` - Convex specific

### Data Pipeline

The system uses a three-stage pipeline processed by cron jobs:

1. **Raw Index Fetch** (00:00 UTC): Downloads SEC EDGAR daily index files
2. **Row Parsing** (01:00 UTC): Parses index files into individual filing rows
3. **Form Parsing**: Extracts and validates Form 4 XML documents

### Backend Patterns

- **Internal functions**: Prefixed with `_` (e.g., `_insertRawEdgarDailyIndexForm`) for internal-only use
- **State machine**: Records track state (`pending` → `processed` → `failed`)
- **Idempotency**: Insert operations check for existing records
- **Retry with backoff**: HTTP requests use exponential backoff (1s to 60s)
- **Batch operations**: Database writes chunked in groups of 100

### Form 4 Parsing

Located in `apps/backend/convex/edgarParser/form4/`:
- Extracts XML from SEC document wrappers (between `<XML>` tags)
- Uses fast-xml-parser for parsing
- Normalizes across multiple schema versions
- Validates required fields (CIK, owners, period, signatures)

## TypeScript Configuration

- Shared configs in `packages/typescript-config/`
- Path aliases:
  - `@/*` maps to `./src/*` (in web app)
  - `@whatsfiled/ui/*` maps to UI package
  - `@whatsfiled/backend/*` maps to backend package
- Strict mode enabled
- Biome handles linting with Next.js and React recommended rules

## Importing Between Packages

```typescript
// In apps/web components:
import { Button } from "@whatsfiled/ui/components/button";
import { cn } from "@whatsfiled/ui/lib/utils";
import { api } from "@whatsfiled/backend/convex/_generated/api";
```
