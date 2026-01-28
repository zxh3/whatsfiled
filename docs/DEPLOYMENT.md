# Deployment Guide

Deploy WhatsFiled using Vercel + Trigger.dev + Neon.

## Architecture

```
                     whatsfiled.com
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Vercel                                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Next.js App                                       │  │
│  │  ├── Pages (React)                                 │  │
│  │  ├── API Routes (tRPC)                             │  │
│  │  └── Vercel Analytics                              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Neon (Managed PostgreSQL)                               │
│  └── whatsfiled database                                 │
└──────────────────────────────────────────────────────────┘
                           ▲
                           │
┌──────────────────────────────────────────────────────────┐
│  Trigger.dev                                             │
│  ├── SEC Filing Sync (scheduled)                         │
│  └── Backfill Jobs (on-demand)                           │
└──────────────────────────────────────────────────────────┘
```

## Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Neon | Free (0.5GB) / Launch ($19) | $0-19 |
| Trigger.dev | Free (50k runs) | $0 |
| Domain | — | ~$1 |
| **Total** | | **~$20-40/month** |

Free tiers work fine for starting out.

---

## Prerequisites

- GitHub account (repo connected to Vercel)
- Vercel account
- Neon account
- Trigger.dev account

---

## Step 1: Set Up Neon Database

1. Go to [neon.tech](https://neon.tech) and create a project
2. Create a database called `whatsfiled`
3. Copy the connection string:
   ```
   postgresql://user:pass@ep-xyz.us-east-1.aws.neon.tech/whatsfiled?sslmode=require
   ```

### Run Migrations

From your local machine with the Neon connection string:

```bash
DATABASE_URL="postgresql://..." pnpm db:push
```

---

## Step 2: Deploy to Vercel

### Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` (after migration)
   - **Build Command**: `pnpm build`
   - **Install Command**: `pnpm install`

### Environment Variables

Add these in Vercel project settings:

```
DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/whatsfiled?sslmode=require
EDGAR_USER_AGENT=WhatsFiled contact@yourdomain.com
```

### Deploy

Push to `main` branch — Vercel auto-deploys.

---

## Step 3: Set Up Trigger.dev

### Create Project

1. Go to [trigger.dev](https://trigger.dev)
2. Create a new project
3. Get your API key and project ID

### Install SDK

```bash
pnpm add @trigger.dev/sdk @trigger.dev/nextjs
```

### Configure Jobs

Create `src/trigger/sync-filings.ts`:

```typescript
import { schedules } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { EdgarClient } from "@whatsfiled/edgar-client";

export const syncFilings = schedules.task({
  id: "sync-sec-filings",
  cron: "*/15 * * * *", // Every 15 minutes
  run: async () => {
    const client = new EdgarClient({
      userAgent: process.env.EDGAR_USER_AGENT!,
    });

    // Fetch and process recent filings
    // ... sync logic here

    return { synced: count };
  },
});
```

### Environment Variables

Add to Trigger.dev dashboard:

```
DATABASE_URL=postgresql://...
EDGAR_USER_AGENT=WhatsFiled contact@yourdomain.com
```

### Deploy Jobs

```bash
npx trigger.dev@latest deploy
```

---

## Step 4: Domain & Analytics

### Custom Domain

1. In Vercel, go to **Settings** → **Domains**
2. Add your domain (e.g., `whatsfiled.com`)
3. Update DNS records as instructed

### Enable Analytics

1. In Vercel, go to **Analytics** tab
2. Click **Enable**
3. Analytics are automatic — no code changes needed

---

## Migration from Current Stack

### What Changes

| Current | New |
|---------|-----|
| Vite + React | Next.js |
| TanStack Router | Next.js App Router |
| Express + tRPC | Next.js API Routes + tRPC |
| node-cron | Trigger.dev |
| Local PostgreSQL | Neon |

### Migration Steps

1. **Create Next.js app structure**
   - Move pages to `app/` directory
   - Convert TanStack routes to Next.js routes

2. **Move tRPC to API routes**
   - Create `app/api/trpc/[trpc]/route.ts`
   - Keep existing routers

3. **Extract sync jobs to Trigger.dev**
   - Move cron logic to Trigger.dev tasks
   - Remove node-cron from backend

4. **Update database connection**
   - Point to Neon
   - Use connection pooling for serverless

---

## Monitoring

### Vercel

- **Analytics**: Traffic, Web Vitals, audience
- **Logs**: Function logs in dashboard
- **Alerts**: Set up in project settings

### Trigger.dev

- **Runs**: See all job executions
- **Logs**: Detailed logs per run
- **Alerts**: Failed job notifications

### Neon

- **Metrics**: Connections, queries, storage
- **Query history**: Recent queries

---

## Updating

### App Updates

Push to `main` — Vercel auto-deploys.

```bash
git push origin main
```

### Database Migrations

```bash
DATABASE_URL="postgresql://..." pnpm db:push
```

### Trigger.dev Jobs

```bash
npx trigger.dev@latest deploy
```

---

## Troubleshooting

### Build Fails on Vercel

```bash
# Check build locally
pnpm build

# Check for env var issues
vercel env pull
```

### Database Connection Issues

Neon uses connection pooling. Ensure your connection string includes:
- `?sslmode=require` for SSL
- Use the pooled connection string for serverless

### Trigger.dev Jobs Not Running

1. Check job is deployed: `npx trigger.dev@latest whoami`
2. Check logs in Trigger.dev dashboard
3. Verify environment variables are set

---

## Rollback

### Vercel

1. Go to **Deployments**
2. Find previous working deployment
3. Click **...** → **Promote to Production**

### Database

Neon has point-in-time recovery:
1. Go to **Branches** in Neon dashboard
2. Create branch from past timestamp
3. Update connection string temporarily

---

## Security Checklist

- [ ] Environment variables set (not in code)
- [ ] Database connection uses SSL
- [ ] Vercel project is private (if needed)
- [ ] Trigger.dev API key is secure
- [ ] Rate limiting on API routes (if needed)
