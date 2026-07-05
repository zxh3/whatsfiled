import { AlertTriangle } from "lucide-react";
import { ActivityFeed } from "@/components/filings/activity-feed";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6 space-y-4">
        {/* Maintenance notice */}
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-semibold">Service notice:</span> WhatsFiled
            will no longer be maintained after July 5th, 2026. Filing data may
            become stale or unavailable after this date. Thank you for using the
            site.
          </p>
        </div>

        <ActivityFeed />
      </div>
    </main>
  );
}
