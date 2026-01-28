import { ActivityFeed } from "@/components/filings/activity-feed";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6 space-y-4">
        {/* Data notice banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <strong>Note:</strong> Historical data backfill is in progress. Currently only 2026 data is available. We'll update once all historical data is fully loaded.
        </div>

        <ActivityFeed />
      </div>
    </main>
  );
}
