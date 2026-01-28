# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsFiled is a full-stack application for aggregating and parsing SEC EDGAR filings, focusing on insider trading forms (Form 4, Form 4/A). Built with Next.js 16 App Router + React 19 frontend, tRPC API routes, and PostgreSQL database.

## Monorepo Structure

```
whatsfiled/
├── apps/
│   └── web/                      # Next.js 16 App Router (port 3000)
│       ├── src/app/              # App Router pages & API routes
│       │   └── api/trpc/         # tRPC API handler
│       ├── src/components/       # React components
│       ├── src/hooks/            # Custom React hooks
│       └── src/lib/trpc.ts       # tRPC client setup
├── packages/
│   ├── db/                       # Database layer (Drizzle ORM)
│   │   ├── src/schema.ts         # Database schema
│   │   ├── src/client.ts         # PostgreSQL connection
│   │   └── drizzle.config.ts     # Drizzle Kit config
│   ├── trpc/                     # tRPC routers and context
│   │   ├── src/routers/          # API route handlers
│   │   ├── src/context.ts        # Request context with db
│   │   └── src/init.ts           # tRPC initialization
│   ├── edgar-client/             # SEC EDGAR API client library
│   │   ├── src/edgar-client.ts   # Main EdgarClient class
│   │   ├── src/types/            # TypeScript types (Form4, etc.)
│   │   └── src/internal/         # Parsers, normalizers, shared utils
│   ├── ui/                       # Shared Shadcn UI components
│   └── typescript-config/        # Shared TypeScript configs
├── archived/                     # Old code (Express backend, old web app)
├── docker-compose.yml            # PostgreSQL for local dev
└── biome.json                    # Linting/formatting config
```

## Commands

```bash
# Development
pnpm dev                    # Start dev server with local PostgreSQL
pnpm dev:prod               # Start dev server with Supabase (production DB)
pnpm build                  # Production build
pnpm typecheck              # TypeScript checking
pnpm lint                   # Biome linter
pnpm format                 # Biome auto-format
pnpm test                   # Run tests

# Docker (Local PostgreSQL)
pnpm docker:up              # Start local database
pnpm docker:down            # Stop local database
pnpm docker:reset           # Reset local database (wipes data)

# Database
pnpm db:push                # Push schema to database
pnpm db:studio              # Open Drizzle Studio

# Individual packages
pnpm --filter @whatsfiled/web dev
pnpm --filter @whatsfiled/edgar-client test
```

## Git Conventions

Use Conventional Commits for all commit messages:

```
<type>(optional scope): <description>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
```

## Key Patterns

### Environment Variables

Environment files in `apps/web/`:

| File | Database | Used by |
|------|----------|---------|
| `.env.local` | Local PostgreSQL | `pnpm dev` |
| `.env.production.local` | Supabase | `pnpm dev:prod`, production builds |

Required variable: `DATABASE_URL` - PostgreSQL connection string

```bash
# apps/web/.env.local (local development)
DATABASE_URL=postgresql://user:password@localhost:5432/whatsfiled

# apps/web/.env.production.local (production/Supabase)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

### tRPC Setup

- Routers: `packages/trpc/src/routers/` defines procedures
- API Handler: `apps/web/src/app/api/trpc/[trpc]/route.ts`
- Client: `apps/web/src/lib/trpc.ts` creates typed React hooks
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

### Form 4 Data Model & Display

SEC Form 4 has two tables that we store in separate database tables:

| SEC Form 4               | Database Table            | Description                              |
| ------------------------ | ------------------------- | ---------------------------------------- |
| Table I (Non-Derivative) | `transactions`            | Direct changes to common stock ownership |
| Table II (Derivative)    | `derivative_transactions` | Changes to options, RSUs, warrants held  |

**Transaction Codes:**

- `P` = Open market purchase (buying stock)
- `S` = Open market sale (selling stock)
- `M` = Exercise/conversion of derivative (e.g., RSU vest, option exercise)
- `A` = Award/grant of stock
- `F` = Tax withholding (shares sold to cover taxes)
- `G` = Gift
- `C` = Conversion of derivative security

**Company Page Display:**

The company page (`/company/:cik`) shows only Table I transactions (common stock changes) with two tabs:

- **Market Trades** (codes P, S): Discretionary open-market purchases and sales. High signal for insider sentiment.
- **Awards & Exercises** (codes M, A, F, G, C): Compensation-related events like RSU vests, option exercises, tax withholding. Routine, low signal.

We intentionally exclude Table II (derivative_transactions) from the company page because:

1. When an RSU vests or option is exercised, it appears in BOTH tables (Table II shows derivative disposed, Table I shows stock received)
2. Showing both creates confusing duplicate rows
3. Users primarily care about common stock ownership changes
4. The "Owned" column should consistently mean common shares owned

**Filing Detail Page:**

The filing page (`/filing/:accessionNumber`) shows both Table I and Table II with full detail, matching the SEC filing structure. Footnotes are displayed as tooltips.

## Database

PostgreSQL with Drizzle ORM. Schema in `packages/db/src/schema.ts`.

**Local development** uses Docker PostgreSQL. **Production** uses Supabase.

```bash
# Local development setup
pnpm docker:up                    # Start local PostgreSQL
pnpm db:push                      # Push schema
pnpm dev                          # Run app with local DB

# Production database (Supabase)
pnpm dev:prod                     # Run app with Supabase
```

## Ports

- Frontend: http://localhost:3000
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
   - `mcp__chrome-devtools__navigate_page` - Navigate to http://localhost:3000
   - `mcp__chrome-devtools__take_snapshot` - Get page content/structure
   - `mcp__chrome-devtools__take_screenshot` - Capture visual state
   - `mcp__chrome-devtools__click` / `mcp__chrome-devtools__fill` - Interact with elements
   - `mcp__chrome-devtools__list_console_messages` - Check for errors
   - `mcp__chrome-devtools__list_network_requests` - Verify API calls

Example E2E test flow:

```
1. navigate_page to http://localhost:3000
2. wait_for expected text/element
3. take_snapshot to verify page structure
4. list_console_messages to check for errors
5. take_screenshot to capture final state
```

## Path Aliases

- `@/*` → `./src/*` (in web app)
- `@whatsfiled/ui/*` → UI package components

## Shadcn UI Components

**Always use the shared UI package** (`packages/ui/src/components/`) for common UI components. Do NOT create custom/ad-hoc components in `apps/web/src/components/` when a shadcn component exists.

### Adding Missing Components

If a shadcn component you need is not in the UI package, install it using the shadcn CLI:

```bash
cd packages/ui
pnpm dlx shadcn@latest add <component>
```

Then export the component from `packages/ui/src/index.ts` if not already exported.

### Guidelines

1. **Check existing components first** - Look in `packages/ui/src/components/` before creating anything new
2. **Use shadcn CLI for standard components** - Button, Card, Dialog, etc. should come from shadcn
3. **Do NOT invent new components** unless explicitly asked - prefer composition of existing shadcn components
4. **Import from the UI package** - Use `import { Button } from "@whatsfiled/ui"` in the web app

Example components already set up:

- `button.tsx`, `card.tsx`, `table.tsx` - Standard shadcn components
- `progress.tsx` - Uses `@base-ui/react/progress`
- `tooltip.tsx` - Uses `@base-ui/react/tooltip`
