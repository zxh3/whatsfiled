"use client";

import { ActivityFeed } from "@/components/filings";

export default function Page() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">WhatsFiled</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Recent insider trading activity
              </p>
            </div>
            <a
              href="/sync"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sync Status
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        <ActivityFeed />
      </div>
    </main>
  );
}
