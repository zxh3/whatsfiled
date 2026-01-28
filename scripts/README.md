# Scripts

Utility scripts for the WhatsFiled project.

## db-sync.sh

Sync data between local PostgreSQL and Supabase (production) databases.

### Usage

```bash
pnpm db:sync <direction> [options]
```

### Directions

| Direction | Description |
|-----------|-------------|
| `to-remote` | Sync local DB → Supabase (production) |
| `to-local` | Sync Supabase (production) → local DB |

### Options

| Option | Description |
|--------|-------------|
| `--replace` | Wipe target DB first, then restore (dangerous) |
| `-y, --yes` | Skip confirmation prompt |
| `-h, --help` | Show help |

### Examples

```bash
# Add missing rows to Supabase (safe - won't overwrite existing data)
pnpm db:sync to-remote

# Add missing rows to local
pnpm db:sync to-local

# Full replace (wipes target first)
pnpm db:sync to-local --replace

# Skip confirmation
pnpm db:sync to-remote -y
```

### Modes

**Upsert (default)**: Only inserts rows that don't already exist. Existing rows are untouched. Uses `pg_dump --on-conflict-do-nothing`.

**Replace (`--replace`)**: Truncates all tables in the target DB first, then restores all data from source. Use with caution on production.

### Requirements

- `pg_dump` and `psql` must be installed (comes with PostgreSQL)
- Environment files must exist:
  - `apps/web/.env.local` (local DATABASE_URL)
  - `apps/web/.env.production.local` (Supabase DATABASE_URL)
