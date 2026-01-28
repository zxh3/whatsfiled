import { ActivityFeed } from "@/components/filings/activity-feed";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        <ActivityFeed />
      </div>
    </main>
  );
}
