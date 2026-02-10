# Trigger Deployment Reference

## Scope

This skill is for the `whatsfiled` monorepo only.

- Repository root: `/Users/xiaohuazhang/dev/whatsfiled`
- Trigger package: `packages/trigger`
- Package name: `@whatsfiled/trigger`

## Deploy Command

- Preferred:
  - `/Users/xiaohuazhang/dev/whatsfiled/.agents/skills/trigger-deploy/scripts/deploy_trigger.sh`
- Underlying package script:
  - `npx trigger.dev@latest deploy`
- If running manually from `packages/trigger`, use:
  - `pnpm run deploy`

## Environment Files

- Production: `packages/trigger/.env.production.local`
- Local/dev: `packages/trigger/.env.local`

Required variables:

- `TRIGGER_SECRET_KEY`
- `DATABASE_URL`
- `SEC_USER_AGENT`

## Trigger Project

- Config file: `packages/trigger/trigger.config.ts`
- Project id is defined in `project: "..."`
- Dashboard URL template:
  - `https://cloud.trigger.dev/projects/v3/<project-id>/runs`

## Recommended Checks

Before deploy:

```bash
pnpm --filter @whatsfiled/trigger typecheck
```

After deploy:

```bash
pnpm --filter @whatsfiled/trigger cli runs
```

## Pitfalls

- Never print secrets from env files.
- Ensure production deploy uses production Trigger secret key.
- Confirm `trigger.config.ts` points to intended project id before deploy.
- Do not `source` env files directly if values may contain spaces (e.g. `SEC_USER_AGENT`); parse/export `KEY=VALUE` pairs safely.
- In package scope, `pnpm deploy` can invoke pnpm's deployment command instead of the package script; use `pnpm run deploy`.
