#!/usr/bin/env bash
set -euo pipefail

ENV_TARGET="production"
SKIP_TYPECHECK=0
DRY_RUN=0
PACKAGE_DIR="packages/trigger"

usage() {
  cat <<USAGE
Usage: deploy_trigger.sh [options]

Options:
  --env <production|local>   Environment file to load (default: production)
  --skip-typecheck           Skip pnpm typecheck step
  --dry-run                  Print planned actions without running deploy
  --package <path>           Trigger package path (default: packages/trigger)
  -h, --help                 Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_TARGET="${2:-}"
      shift 2
      ;;
    --skip-typecheck)
      SKIP_TYPECHECK=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --package)
      PACKAGE_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$ENV_TARGET" != "production" && "$ENV_TARGET" != "local" ]]; then
  echo "Invalid --env value: $ENV_TARGET" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not found in PATH" >&2
  exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "rg (ripgrep) is required but not found in PATH" >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PKG_PATH="$REPO_ROOT/$PACKAGE_DIR"

if [[ "$(basename "$REPO_ROOT")" != "whatsfiled" ]]; then
  echo "This skill is scoped to the whatsfiled repository. Computed root: $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -d "$PKG_PATH" ]]; then
  echo "Package path does not exist: $PKG_PATH" >&2
  exit 1
fi

if [[ ! -f "$PKG_PATH/package.json" ]]; then
  echo "Missing package.json in: $PKG_PATH" >&2
  exit 1
fi

if [[ ! -f "$PKG_PATH/trigger.config.ts" ]]; then
  echo "Missing trigger.config.ts in: $PKG_PATH" >&2
  exit 1
fi

if [[ "$ENV_TARGET" == "production" ]]; then
  ENV_FILE="$PKG_PATH/.env.production.local"
else
  ENV_FILE="$PKG_PATH/.env.local"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

for var in TRIGGER_SECRET_KEY DATABASE_URL SEC_USER_AGENT; do
  if ! rg -q "^${var}=" "$ENV_FILE"; then
    echo "Missing required variable ${var} in $ENV_FILE" >&2
    exit 1
  fi
done

PROJECT_ID="$(rg -o 'project:\s*"[^"]+"' "$PKG_PATH/trigger.config.ts" | sed -E 's/.*"([^"]+)"/\1/' | head -n1 || true)"

echo "Repo root: $REPO_ROOT"
echo "Package:   $PKG_PATH"
echo "Env file:  $ENV_FILE"
if [[ -n "$PROJECT_ID" ]]; then
  echo "Project:   $PROJECT_ID"
  echo "Runs URL:  https://cloud.trigger.dev/projects/v3/$PROJECT_ID/runs"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Would run typecheck: $([[ "$SKIP_TYPECHECK" -eq 1 ]] && echo no || echo yes)"
  echo "[dry-run] Would run: pnpm run deploy (from $PKG_PATH)"
  exit 0
fi

if [[ "$SKIP_TYPECHECK" -eq 0 ]]; then
  echo "Running typecheck..."
  (cd "$REPO_ROOT" && pnpm --filter @whatsfiled/trigger typecheck)
else
  echo "Skipping typecheck by request"
fi

echo "Deploying Trigger tasks..."
(
  cd "$PKG_PATH"
  # Load KEY=VALUE pairs safely without executing arbitrary shell in env files.
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    export "$key=$value"
  done < "$ENV_FILE"
  pnpm run deploy
)

echo "Deploy command completed"
if [[ -n "$PROJECT_ID" ]]; then
  echo "Check runs: https://cloud.trigger.dev/projects/v3/$PROJECT_ID/runs"
fi
