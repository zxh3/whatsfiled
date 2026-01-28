import { createFileRoute } from "@tanstack/react-router";
import { ActivityFeed } from "@/components/filings";
import { SiteHeader } from "@/components/layout/site-header";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ActivityFeed />
      </div>
    </main>
  );
}
