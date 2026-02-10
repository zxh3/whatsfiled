import Link from "next/link";
import { ActivityFeed } from "@/components/filings/activity-feed";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6 space-y-4">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                New
              </p>
              <h2 className="text-base font-semibold">
                Top Insider Buys Today
              </h2>
              <p className="text-sm text-muted-foreground">
                Daily open-market Form 4 purchases ranked by estimated value.
              </p>
            </div>
            <Link
              href="/insider-buys/today"
              className="text-sm font-medium underline underline-offset-4"
            >
              View daily list
            </Link>
          </div>
        </section>
        <ActivityFeed />
      </div>
    </main>
  );
}
