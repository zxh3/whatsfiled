# WhatsFiled

> ⚠️ **Service notice:** WhatsFiled will no longer be maintained after **July 5th, 2026**. Filing data may become stale or unavailable after this date.

Insider stock trades, made clear. Search public companies. Follow insiders. Get alerts.

WhatsFiled aggregates and parses SEC EDGAR filings, with a focus on Form 4 (insider trading) disclosures.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, Shadcn UI
- **API**: tRPC (inside Next.js API routes)
- **Database**: PostgreSQL (Drizzle ORM), Supabase (production)
- **Pipeline**: Trigger.dev for SEC filing ingestion
- **Tooling**: Turborepo, pnpm, Biome, TypeScript

## Quick Start

```bash
# Clone and install
git clone https://github.com/zxh3/whatsfiled.git
cd whatsfiled
pnpm install

# Start PostgreSQL
pnpm docker:up

# Configure environment
cp apps/web/.env.example apps/web/.env.local

# Push database schema
pnpm db:push

# Start the web app against local PostgreSQL
pnpm --filter @whatsfiled/web dev:local
```

Open http://localhost:3000 for the app.

If you want the full workspace dev setup instead, run `pnpm dev`. That starts Turbo-managed `dev` tasks across the repo; for the web app, that uses `apps/web/.env.production.local`.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed project documentation including:

- Monorepo structure
- Development commands
- Environment variables
- Key patterns and conventions
- Testing guide
- Backfill instructions

## License

MIT
