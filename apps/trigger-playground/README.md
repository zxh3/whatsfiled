# Trigger.dev Playground

A minimal learning environment for Trigger.dev. Each task file is a standalone lesson.

## Setup

### 1. Create a Trigger.dev account

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev)
2. Sign up / Sign in
3. Create a new project
4. Copy your **Project ID** (looks like `proj_xxxxx`)

### 2. Update config

Edit `trigger.config.ts` and replace the project ID:

```ts
project: "proj_xxxxx", // Your actual project ID
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Start dev server

```bash
pnpm --filter @whatsfiled/trigger-playground dev
```

This will:

- Prompt you to login (first time only)
- Connect to Trigger.dev cloud
- Watch for task changes

## Lessons

Work through these in order:

| File              | Concept                            |
| ----------------- | ---------------------------------- |
| `hello-world.ts`  | Basic task structure               |
| `with-payload.ts` | Passing data to tasks              |
| `with-retry.ts`   | Automatic retries & error handling |
| `parent-child.ts` | Tasks triggering other tasks       |
| `scheduled.ts`    | Cron/scheduled tasks               |
| `with-wait.ts`    | Long-running workflows with waits  |

## Running Tasks

### From Dashboard

1. Go to your project at [cloud.trigger.dev](https://cloud.trigger.dev)
2. Navigate to **Tasks** tab
3. Click on a task
4. Use the **Test** tab to run with custom payload

### From Code

```typescript
import { tasks } from "@trigger.dev/sdk/v3";

// Fire and forget
await tasks.trigger("hello-world", {});

// Wait for result
const handle = await tasks.triggerAndWait("greet-user", {
  name: "Alice",
});
```

## Key Concepts

### Tasks

Functions that run reliably in the cloud with automatic retries, logging, and monitoring.

### Payloads

The input data you pass to tasks. Defined with TypeScript types.

### Retries

Failed tasks automatically retry with exponential backoff. Customize per-task.

### Waits

Tasks can pause for minutes/hours/days without using compute time. State is preserved.

### Schedules

Run tasks on cron schedules (daily, hourly, etc).

## Tips

- Check the Trigger.dev dashboard for logs and run history
- Use `console.log` freely - all logs appear in the dashboard
- Task code changes are hot-reloaded in dev mode
- Start simple, add complexity gradually

## Trigger.dev vs Temporal

Both are workflow orchestration systems for durable, long-running tasks. Here's how they compare:

| Aspect | Trigger.dev | Temporal |
|--------|-------------|----------|
| **Complexity** | Simple, beginner-friendly | Steep learning curve |
| **Hosting** | Managed cloud (default) or self-host | Self-host required (or Temporal Cloud $$$) |
| **Language** | TypeScript/JavaScript only | Go, Java, Python, TypeScript, PHP, .NET |
| **Architecture** | Serverless functions | Workers polling a server |
| **State Management** | Checkpoint-based (waits freeze state) | Event sourcing (replays entire history) |
| **Determinism** | Not required | Strictly required (no random, no Date.now) |
| **Pricing** | Pay per task run | Pay for worker compute time |

### When to use Trigger.dev

- You're building with TypeScript/Node.js
- You want to get started quickly without infrastructure
- Your workflows are relatively straightforward
- You prefer serverless and managed services
- You're a small team or solo developer

### When to use Temporal

- You need multi-language support
- You have complex workflows with many branches/signals
- You need fine-grained control over replay behavior
- You're already running Kubernetes infrastructure
- Enterprise requirements (on-prem, compliance, etc.)

### Key Conceptual Difference

**Temporal** uses "event sourcing" - your workflow code re-executes from the beginning on every step, but activities that already completed return cached results. This requires deterministic code (no `Math.random()`, no `Date.now()`).

**Trigger.dev** uses "checkpointing" - when you call `wait.for()`, the entire runtime state is serialized and frozen. When it resumes, execution continues from exactly where it left off. No replay, no determinism constraints.

```typescript
// Trigger.dev - this just works
const id = crypto.randomUUID(); // Fine!
await wait.for({ hours: 1 });
console.log(id); // Same ID after resume

// Temporal - this would break
const id = crypto.randomUUID(); // BAD: different on replay
await sleep("1h");
console.log(id); // Different ID! Workflow corrupted
```

### How Trigger.dev Checkpointing Works

When you call `await wait.for({ hours: 1 })`, Trigger.dev:

1. **Serializes the entire V8 JavaScript runtime state** - call stack, variables, closures, everything
2. **Saves that snapshot** to their infrastructure
3. **Shuts down the container** (no compute charges during the wait)
4. **After 1 hour**, spins up a new container
5. **Restores the snapshot** - V8 runtime rehydrated to exactly where it was
6. **Execution continues** from the next line

The code doesn't re-run. The runtime literally resumes from a frozen point, like unpausing a video.

### Limitations of Checkpointing

#### 1. Non-serializable state is lost

```typescript
const stream = fs.createReadStream("bigfile.txt"); // Open file handle
await wait.for({ minutes: 5 });
stream.read(); // BROKEN - file handle doesn't survive snapshot
```

Things that can't be serialized: open file handles, network sockets, database connections, running timers. **Workaround:** Re-establish connections after waits.

#### 2. Memory/snapshot size limits

Everything in memory gets serialized. Large objects = large snapshots = slow and expensive.

```typescript
const hugeArray = await fetchMillionsOfRecords(); // 500MB in memory
await wait.for({ hours: 1 }); // Serializing 500MB is slow/expensive
```

**Workaround:** Stream data, paginate, or store in database instead of memory.

#### 3. Code deployment during a wait

If you deploy new code while a task is waiting:

```typescript
// v1 deployed
const x = calculate(); // returns 10 in v1
await wait.for({ days: 7 });
// v2 deployed - calculate() now returns 20
doSomething(x); // x is still 10 (snapshot), but doSomething() uses new code
```

Snapshot restores old variable values, but function calls after resume use new code. This can cause subtle bugs.

#### 4. JavaScript/TypeScript only

V8 snapshots are JS-specific. Temporal supports Go, Java, Python, etc.

#### 5. Less visibility into history

Temporal's event sourcing gives a complete audit log of every step. Trigger.dev's checkpoints are more opaque - you see "started" and "completed" but intermediate state is a binary blob.

### TL;DR

- **Trigger.dev**: "Serverless cron jobs and background tasks with a nice dashboard"
- **Temporal**: "Kubernetes-native workflow engine for complex distributed systems"

Start with Trigger.dev for learning and small-to-medium projects. Consider Temporal when you outgrow it or have specific enterprise needs.
