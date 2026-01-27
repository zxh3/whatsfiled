"use client";

import { trpc } from "@/lib/trpc";

export default function Page() {
  const health = trpc.health.useQuery();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold">WhatsFiled</h1>

      <div className="rounded-lg border p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Server Status</h2>

        {health.isLoading && (
          <p className="text-muted-foreground">Connecting to server...</p>
        )}

        {health.isError && (
          <div className="text-red-500">
            <p className="font-medium">Connection failed</p>
            <p className="text-sm">{health.error.message}</p>
          </div>
        )}

        {health.isSuccess && (
          <div className="space-y-2">
            <p>
              Status:{" "}
              <span className="font-mono text-green-600">
                {health.data.status}
              </span>
            </p>
            <p>
              Server time:{" "}
              <span className="font-mono text-muted-foreground">
                {health.data.timestamp}
              </span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
