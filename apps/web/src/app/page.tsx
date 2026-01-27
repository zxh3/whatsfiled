"use client";

import { ActivityFeed } from "@/components/filings";
import { SiteHeader } from "@/components/layout/site-header";

export default function Page() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ActivityFeed />
      </div>
    </main>
  );
}
