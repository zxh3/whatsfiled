# WhatsFiled

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

# Start development server
pnpm dev
```

Open http://localhost:3000 for the app.

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
