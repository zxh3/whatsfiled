# Web App Guidelines

Frontend application built with React 19, TanStack Router, and Vite.

## Adding New Pages

This app uses **TanStack Router** with file-based routing. Routes are auto-generated from files in `src/routes/`.

> **Reference**: [TanStack Router File-Based Routing Docs](https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing)

### Route File Structure

TanStack Router supports both **flat routes** (dot notation) and **directory routes**. You can mix them based on what makes sense.

#### Flat Routes (Dot Notation)
Use `.` in filenames to denote nesting. Good for deeply nested routes without many siblings.

```
routes/settings.profile.tsx    → /settings/profile
routes/settings.security.tsx   → /settings/security
```

#### Directory Routes
Use folders for route hierarchy. Good for groups of related routes.

```
routes/resources/sec-filings.tsx  → /resources/sec-filings
routes/resources/faq.tsx          → /resources/faq
```

#### This Project's Convention

We prefer **directory routes** for nested paths to keep the routes folder organized:

```
src/routes/
├── __root.tsx              # Root layout
├── index.tsx               # / (home)
├── search.tsx              # /search
├── sync.tsx                # /sync
├── company.$cik.tsx        # /company/:cik (dynamic param)
├── insider.$cik.tsx        # /insider/:cik
├── filing.$accessionNumber.tsx
└── resources/
    └── sec-filings.tsx     # /resources/sec-filings
```

### Special File Naming Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| `$param` | Dynamic route segment | `company.$cik.tsx` → `/company/:cik` |
| `_name` | Pathless/layout route | `_layout.tsx` (wraps children, no URL segment) |
| `index.tsx` | Index route for directory | `routes/index.tsx` → `/` |
| `route.tsx` | Layout route in directory | `routes/app/route.tsx` (wraps `app/*` children) |
| `(group)` | Organizational grouping | `routes/(auth)/login.tsx` (no URL impact) |

### Creating a New Page

1. **Create the route file** in the appropriate location:

```tsx
// src/routes/resources/my-page.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/resources/my-page")({
  component: MyPage,
});

function MyPage() {
  return (
    <main className="min-h-screen">
      {/* Your content */}
    </main>
  );
}
```

2. **The route path in `createFileRoute()` must match the URL path**, not the file path.

3. **Route tree auto-generates** - The `routeTree.gen.ts` file is created automatically. Never edit it manually.

### Route Examples

| File Path | URL Path | Notes |
|-----------|----------|-------|
| `routes/index.tsx` | `/` | Home page |
| `routes/about.tsx` | `/about` | Simple page |
| `routes/company.$cik.tsx` | `/company/:cik` | Dynamic param |
| `routes/resources/guide.tsx` | `/resources/guide` | Nested via folder |
| `routes/blog.posts.tsx` | `/blog/posts` | Nested via dot notation |

### Layout Routes

To wrap multiple routes with a shared layout:

```tsx
// routes/dashboard/route.tsx - Layout for all /dashboard/* routes
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <Outlet /> {/* Child routes render here */}
    </div>
  );
}
```

### Page Layout Pattern

```tsx
import { SiteHeader } from "@/components/layout/site-header";

function MyPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Content */}
      </div>
    </main>
  );
}
```

### Search Params Validation

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  page: z.coerce.number().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const { page, q } = Route.useSearch();
  // ...
}
```

### Data Fetching with tRPC

```tsx
import { trpc } from "@/lib/trpc";

function MyPage() {
  const { data, isLoading, error } = trpc.myRouter.myProcedure.useQuery({
    param: "value",
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Use data */}</div>;
}
```

## Styling

- **Tailwind CSS** for styling
- **Design tokens**: `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`
- **Max width container**: `mx-auto max-w-4xl px-4`
- **Spacing**: Use `space-y-6` or `gap-4` for consistent spacing

## Components

Shared UI components are in `packages/ui/src/components/`:

```tsx
import { Badge } from "@whatsfiled/ui/components/badge";
import { Button } from "@whatsfiled/ui/components/button";
import { Card } from "@whatsfiled/ui/components/card";
```

## Important Notes

1. **Don't edit `routeTree.gen.ts`** - It's auto-generated by TanStack Router
2. **Biome ignores `routeTree.gen.ts`** - Configured in `biome.json` to prevent formatting loops
3. **Use `@/` alias** for imports from `src/`
4. **Use `@whatsfiled/ui/`** for shared UI components
5. **Restart dev server** if routes aren't updating - occasionally needed after adding new route files
