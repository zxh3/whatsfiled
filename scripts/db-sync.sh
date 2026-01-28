#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_LOCAL="$PROJECT_ROOT/apps/web/.env.local"
ENV_PROD="$PROJECT_ROOT/apps/web/.env.production.local"
DUMP_FILE="$PROJECT_ROOT/scripts/.db-dump.sql"

# Parse command line arguments
DIRECTION=""
SKIP_CONFIRM=false
MODE="upsert"  # Default: upsert (safe)

while [[ $# -gt 0 ]]; do
  case $1 in
    local-to-remote|to-remote)
      DIRECTION="local-to-remote"
      shift
      ;;
    remote-to-local|to-local)
      DIRECTION="remote-to-local"
      shift
      ;;
    --replace)
      MODE="replace"
      shift
      ;;
    -y|--yes)
      SKIP_CONFIRM=true
      shift
      ;;
    -h|--help)
      echo "Usage: pnpm db:sync <direction> [options]"
      echo ""
      echo "Directions:"
      echo "  local-to-remote, to-remote   Sync local DB to Supabase (production)"
      echo "  remote-to-local, to-local    Sync Supabase (production) to local DB"
      echo ""
      echo "Options:"
      echo "  --replace    Replace all data (DANGER: wipes target DB first)"
      echo "  -y, --yes    Skip confirmation prompt"
      echo ""
      echo "By default, sync uses UPSERT mode: only inserts rows that don't exist."
      echo ""
      echo "Examples:"
      echo "  pnpm db:sync to-remote       # Add missing rows to Supabase"
      echo "  pnpm db:sync to-local        # Add missing rows to local"
      echo "  pnpm db:sync to-local --replace   # Full replace (wipes local first)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

if [[ -z "$DIRECTION" ]]; then
  echo -e "${RED}Error: Please specify a direction${NC}"
  echo ""
  echo "Usage: pnpm db:sync <direction>"
  echo "  pnpm db:sync to-remote    # Local -> Supabase (upsert)"
  echo "  pnpm db:sync to-local     # Supabase -> Local (upsert)"
  exit 1
fi

# Load DATABASE_URL from env file
load_db_url() {
  local env_file=$1
  if [[ ! -f "$env_file" ]]; then
    echo -e "${RED}Error: $env_file not found${NC}"
    exit 1
  fi
  grep -E "^DATABASE_URL=" "$env_file" | cut -d '=' -f2- | tr -d '"' | tr -d "'"
}

LOCAL_DB=$(load_db_url "$ENV_LOCAL")
REMOTE_DB=$(load_db_url "$ENV_PROD")

if [[ -z "$LOCAL_DB" ]]; then
  echo -e "${RED}Error: DATABASE_URL not found in $ENV_LOCAL${NC}"
  exit 1
fi

if [[ -z "$REMOTE_DB" ]]; then
  echo -e "${RED}Error: DATABASE_URL not found in $ENV_PROD${NC}"
  exit 1
fi

# Extract host from URL for display (hide password)
get_display_url() {
  echo "$1" | sed -E 's|://[^:]+:[^@]+@|://***:***@|'
}

if [[ "$DIRECTION" == "local-to-remote" ]]; then
  SOURCE_DB="$LOCAL_DB"
  TARGET_DB="$REMOTE_DB"
  SOURCE_NAME="Local"
  TARGET_NAME="Supabase (PRODUCTION)"
else
  SOURCE_DB="$REMOTE_DB"
  TARGET_DB="$LOCAL_DB"
  SOURCE_NAME="Supabase (production)"
  TARGET_NAME="Local"
fi

echo ""
echo -e "${YELLOW}=== Database Sync ===${NC}"
echo ""
echo -e "Direction: ${GREEN}$SOURCE_NAME${NC} -> ${RED}$TARGET_NAME${NC}"
echo -e "Mode: ${GREEN}$MODE${NC}"
echo ""
echo "Source: $(get_display_url "$SOURCE_DB")"
echo "Target: $(get_display_url "$TARGET_DB")"
echo ""

if [[ "$DIRECTION" == "local-to-remote" && "$MODE" == "replace" ]]; then
  echo -e "${RED}⚠️  WARNING: This will WIPE and REPLACE data in PRODUCTION!${NC}"
elif [[ "$DIRECTION" == "local-to-remote" ]]; then
  echo -e "${YELLOW}ℹ️  Upsert mode: Only new rows will be added to production.${NC}"
fi

if [[ "$SKIP_CONFIRM" != true ]]; then
  echo ""
  read -p "Are you sure you want to continue? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ""

if [[ "$MODE" == "replace" ]]; then
  # Full replace mode - dump and restore everything
  echo -e "${GREEN}Step 1/2: Dumping data from $SOURCE_NAME...${NC}"
  pg_dump "$SOURCE_DB" \
    --data-only \
    --disable-triggers \
    --no-owner \
    --no-acl \
    > "$DUMP_FILE"

  echo -e "${GREEN}Step 2/2: Replacing data in $TARGET_NAME...${NC}"
  psql "$TARGET_DB" -q <<EOF
SET session_replication_role = 'replica';
TRUNCATE TABLE derivative_transactions, transactions, filings, issuers, reporters CASCADE;
SET session_replication_role = 'origin';
EOF
  psql "$TARGET_DB" -q < "$DUMP_FILE"
else
  # Upsert mode - use INSERT ... ON CONFLICT DO NOTHING
  echo -e "${GREEN}Step 1/2: Dumping data from $SOURCE_NAME...${NC}"
  pg_dump "$SOURCE_DB" \
    --data-only \
    --inserts \
    --on-conflict-do-nothing \
    --no-owner \
    --no-acl \
    > "$DUMP_FILE"

  echo -e "${GREEN}Step 2/2: Inserting new rows into $TARGET_NAME...${NC}"
  psql "$TARGET_DB" -q < "$DUMP_FILE"
fi

# Cleanup
rm -f "$DUMP_FILE"

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
