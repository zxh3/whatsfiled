---
name: trigger-deploy
description: Deploy Trigger.dev tasks for the WhatsFiled monorepo from packages/trigger with repo-specific preflight checks, environment validation, and post-deploy verification. Use when asked to deploy, redeploy, release, or troubleshoot Trigger.dev deployment in this repository.
---

# Trigger Deploy

Deploy `@whatsfiled/trigger` for this repository using the established command and env conventions.

## Workflow

1. Confirm repository root and `packages/trigger` target.
2. Run preflight checks.
3. Select env (`production` by default, or `local` when requested).
4. Run typecheck unless explicitly skipped.
5. Deploy and report runs URL.

Use `scripts/deploy_trigger.sh` for deterministic execution.
The script loads `.env` files as raw `KEY=VALUE` pairs (safe for values with spaces) and runs `pnpm run deploy` from `packages/trigger`.

## Preflight

Verify all of the following before deployment:

- `packages/trigger/trigger.config.ts` exists and includes the intended Trigger project id.
- `packages/trigger/package.json` contains the `deploy` script.
- Target env file contains required keys:
  - `TRIGGER_SECRET_KEY`
  - `DATABASE_URL`
  - `SEC_USER_AGENT`
- Recommended: `pnpm --filter @whatsfiled/trigger typecheck`.

Default env file is `packages/trigger/.env.production.local`.

## Commands

Run from anywhere:

```bash
# Safe default: production env + typecheck
/Users/xiaohuazhang/dev/whatsfiled/.agents/skills/trigger-deploy/scripts/deploy_trigger.sh

# Use local Trigger env
/Users/xiaohuazhang/dev/whatsfiled/.agents/skills/trigger-deploy/scripts/deploy_trigger.sh --env local

# Skip typecheck only when explicitly requested
/Users/xiaohuazhang/dev/whatsfiled/.agents/skills/trigger-deploy/scripts/deploy_trigger.sh --skip-typecheck

# Preview actions only
/Users/xiaohuazhang/dev/whatsfiled/.agents/skills/trigger-deploy/scripts/deploy_trigger.sh --dry-run
```

## Report After Deploy

Include:

- Env file used.
- Typecheck result (passed or skipped).
- Deploy command executed.
- Success or failure.
- Dashboard URL:
  - `https://cloud.trigger.dev/projects/v3/<project-id>/runs`

## References

Load `references/trigger-deploy.md` for package-specific details and pitfalls.
