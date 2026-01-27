# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsFiled is a full-stack application for aggregating and parsing SEC EDGAR filings, focusing on insider trading forms (Form 4, Form 4/A). Built with Next.js 16 + React 19 frontend and tRPC + Express + PostgreSQL backend.

## Monorepo Structure

```
whatsfiled/
├── apps/
│   ├── web/                      # Next.js 16 frontend (port 3001)
│   │   ├── src/app/              # App Router pages
│   │   ├── src/components/       # React components
│   │   └── src/lib/trpc.ts       # tRPC client setup
│   └── backend/                  # Express + tRPC server (port 3000)
│       └── src/
│           ├── index.ts          # Express server entry
│           ├── env.ts            # Zod-validated env vars
│           ├── cron/             # node-cron scheduled jobs
│           ├── db/               # Drizzle ORM schema + connection
│           └── trpc/             # tRPC routers and context
├── packages/
│   ├── edgar-client/             # SEC EDGAR API client library
│   │   ├── src/edgar-client.ts   # Main EdgarClient class
│   │   ├── src/types/            # TypeScript types (Form4, etc.)
│   │   └── src/internal/         # Parsers, normalizers, shared utils
│   ├── ui/                       # Shared Shadcn UI components
│   └── typescript-config/        # Shared TypeScript configs
├── archived/                     # Old code (Convex backend)
├── docker-compose.yml            # PostgreSQL for local dev
└── biome.json                    # Linting/formatting config
```

## Commands

```bash
# Development
pnpm dev                    # Start all dev servers (frontend + backend)
pnpm build                  # Production build
pnpm typecheck              # TypeScript checking
pnpm lint                   # Biome linter
pnpm format                 # Biome auto-format
pnpm test                   # Run tests

# Docker (PostgreSQL)
pnpm docker:up              # Start database
pnpm docker:down            # Stop database
pnpm docker:reset           # Reset database (wipes data)

# Database
pnpm db:push                # Push schema to database
pnpm db:studio              # Open Drizzle Studio

# Individual packages
pnpm --filter @whatsfiled/web dev
pnpm --filter @whatsfiled/backend dev
pnpm --filter @whatsfiled/edgar-client test

# Backend Scripts (see apps/backend/CLAUDE.md for details)
pnpm --filter @whatsfiled/backend tsx src/scripts/backfill.ts --help     # SEC filing backfill
pnpm --filter @whatsfiled/backend tsx src/scripts/check-data.ts          # Database summary
pnpm --filter @whatsfiled/backend tsx src/scripts/cleanup-stuck.ts       # Reset stuck jobs
```

## Key Patterns

### Environment Variables
Backend uses zod validation in `apps/backend/src/env.ts`. Reads `.env` then `.env.local` (override).

```typescript
import { env } from "./env.js";
// env.DATABASE_URL, env.PORT, env.NODE_ENV - all type-safe
```

### tRPC Setup
- Backend: `apps/backend/src/trpc/routers/index.ts` defines procedures
- Frontend: `apps/web/src/lib/trpc.ts` creates typed client
- Uses superjson transformer for Date/etc serialization

### EdgarClient Usage
```typescript
import { EdgarClient } from "@whatsfiled/edgar-client";

const client = new EdgarClient({ userAgent: "App contact@example.com" });
const content = await client.fetchFiling("edgar/data/123/000123-24-001.txt");
const doc = client.parseForm4(content);
```

### Form 4 Parsing
- Extracts XML from SEC document wrappers (`<XML>` tags)
- Supports schema versions: X0306, X0407, X0508
- Normalizes across versions for consistent output
- Located in `packages/edgar-client/src/internal/form4/`

## Database

PostgreSQL with Drizzle ORM. Schema in `apps/backend/src/db/schema.ts`.

```bash
# Local setup
pnpm docker:up
cp apps/backend/.env.example apps/backend/.env
pnpm db:push
```

## Ports

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432

## Testing

### Unit Tests
- edgar-client: Vitest with fixtures in `packages/edgar-client/test/`
- Run: `pnpm --filter @whatsfiled/edgar-client test`

### E2E Testing (Local)
When asked to test E2E locally, use the **chrome-devtools MCP server** to interact with the browser.

> **Note**: The MCP server is typically already running (started by the developer). Just use the tools directly—don't try to start or kill the server.

1. Ensure dev servers are running (`pnpm dev`)
2. Use MCP tools to test:
   - `mcp__chrome-devtools__navigate_page` - Navigate to http://localhost:3001
   - `mcp__chrome-devtools__take_snapshot` - Get page content/structure
   - `mcp__chrome-devtools__take_screenshot` - Capture visual state
   - `mcp__chrome-devtools__click` / `mcp__chrome-devtools__fill` - Interact with elements
   - `mcp__chrome-devtools__list_console_messages` - Check for errors
   - `mcp__chrome-devtools__list_network_requests` - Verify API calls

Example E2E test flow:
```
1. navigate_page to http://localhost:3001
2. wait_for expected text/element
3. take_snapshot to verify page structure
4. list_console_messages to check for errors
5. take_screenshot to capture final state
```

## Path Aliases

- `@/*` → `./src/*` (in web app)
- `@whatsfiled/ui/*` → UI package components
