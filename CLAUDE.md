# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whatsfiled is a full-stack application for aggregating and parsing SEC EDGAR filings, with a focus on insider trading forms (Form 4, Form 4/A). It uses Next.js 16 with React 19 for the frontend and tRPC with PostgreSQL/Drizzle for the backend.

This is a **Turborepo monorepo** with the following structure:

```
whatsfiled/
├── apps/
│   ├── web/                      # Next.js 16 frontend
│   └── backend/                  # tRPC standalone server
│       └── src/
│           ├── db/               # Drizzle schema and connection
│           └── trpc/             # tRPC routers and context
├── packages/
│   ├── edgar-client/             # SEC EDGAR API client library
│   ├── ui/                       # Shared Shadcn UI components
│   └── typescript-config/        # Shared TypeScript configs
├── archived/                     # Old code (e.g., Convex backend)
├── turbo.json                    # Turborepo configuration
└── package.json                  # Workspace root
```

## Commands

```bash
# Development
pnpm dev          # Start all dev servers via Turbo
pnpm build        # Production build
pnpm typecheck    # TypeScript type checking
pnpm lint         # Run Biome linter
pnpm format       # Format with Biome (auto-fix)

# Individual workspaces
pnpm --filter @whatsfiled/web dev       # Run only Next.js dev
pnpm --filter @whatsfiled/backend dev   # Run only tRPC server

# Database (backend)
pnpm --filter @whatsfiled/backend db:generate   # Generate migrations
pnpm --filter @whatsfiled/backend db:migrate    # Run migrations
pnpm --filter @whatsfiled/backend db:push       # Push schema (dev)
pnpm --filter @whatsfiled/backend db:studio     # Open Drizzle Studio
```

## Architecture

### Monorepo Structure

- **apps/web/**: Next.js 16 frontend (App Router)
  - `src/app/` - Pages and layouts
  - `src/components/` - App-specific components
  - Dependencies: `@whatsfiled/ui`

- **apps/backend/**: tRPC standalone server
  - `src/index.ts` - HTTP server entry point
  - `src/db/schema.ts` - Drizzle database schema
  - `src/db/index.ts` - Database connection
  - `src/trpc/init.ts` - tRPC initialization
  - `src/trpc/context.ts` - Request context
  - `src/trpc/routers/` - tRPC routers

- **packages/edgar-client/**: SEC EDGAR API client library
  - Standalone package for fetching and parsing SEC EDGAR filings
  - Class-based API via `EdgarClient` for easy usage
  - Supports daily index fetching, Form 4 parsing, and more

- **packages/ui/**: Shared Shadcn UI components
  - `src/components/` - Shadcn components (button, card, input, etc.)
  - `src/lib/utils.ts` - Tailwind utility functions

- **packages/typescript-config/**: Shared tsconfig bases
  - `base.json` - Common settings
  - `nextjs.json` - Next.js specific

### Form 4 Parsing

Located in `packages/edgar-client/`:
- Class-based API via `EdgarClient` class
- Extracts XML from SEC document wrappers (between `<XML>` tags)
- Uses fast-xml-parser for parsing
- Normalizes across multiple schema versions (X0306, X0407, X0508)
- Validates required fields (CIK, owners, period, signatures)

```typescript
import { EdgarClient } from "@whatsfiled/edgar-client";

const client = new EdgarClient({
  userAgent: "MyApp contact@example.com",
});
const content = await client.fetchFiling("edgar/data/123/000123-24-001.txt");
const doc = client.parseForm4(content);
```

## TypeScript Configuration

- Shared configs in `packages/typescript-config/`
- Path aliases:
  - `@/*` maps to `./src/*` (in web app)
  - `@whatsfiled/ui/*` maps to UI package
- Strict mode enabled
- Biome handles linting with Next.js and React recommended rules

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgres://user:password@localhost:5432/whatsfiled
PORT=3001
```
