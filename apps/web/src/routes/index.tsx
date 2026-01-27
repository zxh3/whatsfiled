import { ActivityFeed } from "@/components/filings";
import { SiteHeader } from "@/components/layout/site-header";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
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
