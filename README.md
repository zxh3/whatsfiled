# WhatsFiled

Insider stock trades, made clear. Search public companies. Follow insiders. Get alerts.

WhatsFiled aggregates and parses SEC EDGAR filings, with a focus on Form 4 (insider trading) disclosures.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, Shadcn UI
- **Backend**: Express, tRPC, PostgreSQL, Drizzle ORM
- **Tooling**: Turborepo, pnpm, Biome, TypeScript

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
# Clone and install
git clone https://github.com/yourusername/whatsfiled.git
cd whatsfiled
pnpm install

# Start PostgreSQL
pnpm docker:up

# Configure environment
cp apps/backend/.env.example apps/backend/.env

# Push database schema
pnpm db:push

# Start development servers
pnpm dev
```

Open http://localhost:3000 for the frontend.

## Project Structure

```
whatsfiled/
├── apps/
│   ├── web/           # Next.js frontend
│   └── backend/       # tRPC + Express API server
├── packages/
│   ├── edgar-client/  # SEC EDGAR parsing library
│   ├── ui/            # Shared UI components
│   └── typescript-config/
└── docker-compose.yml
```

## Development

```bash
pnpm dev          # Start all services
pnpm build        # Production build
pnpm typecheck    # Type checking
pnpm lint         # Lint code
pnpm test         # Run tests
```

### Database Commands

```bash
pnpm docker:up     # Start PostgreSQL
pnpm docker:down   # Stop PostgreSQL
pnpm docker:reset  # Reset database
pnpm db:push       # Push schema changes
pnpm db:studio     # Open Drizzle Studio
```

## Environment Variables

### Backend (`apps/backend/.env`)

```env
DATABASE_URL=postgres://user:password@localhost:5432/whatsfiled
PORT=3000
NODE_ENV=development
```

## SEC EDGAR Client

The `@whatsfiled/edgar-client` package provides utilities for fetching and parsing SEC filings:

```typescript
import { EdgarClient } from "@whatsfiled/edgar-client";

const client = new EdgarClient({
  userAgent: "YourApp contact@example.com",
});

// Fetch and parse a Form 4 filing
const content = await client.fetchFiling("edgar/data/123/000123-24-001.txt");
const form4 = client.parseForm4(content);

console.log(form4.issuer.name);
console.log(form4.reportingOwners);
console.log(form4.nonDerivativeTransactions);
```

## License

MIT
