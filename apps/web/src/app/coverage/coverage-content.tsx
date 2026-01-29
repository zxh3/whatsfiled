"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function ProgressBar({
  percent,
  isBackfilling,
  blocks = 20,
}: {
  percent: number;
  isBackfilling: boolean;
  blocks?: number;
}) {
  const filled = Math.round((percent / 100) * blocks);
  const empty = blocks - filled;

  return (
    <span className="font-mono text-xs">
      <span className="text-emerald-600 dark:text-emerald-400">
        {"█".repeat(filled)}
      </span>
      <span className="text-muted-foreground/30">{"░".repeat(empty)}</span>
      {isBackfilling && (
        <span className="ml-1 text-amber-600 dark:text-amber-400 animate-pulse">
          ●
        </span>
      )}
    </span>
  );
}

function StatusBadge({
  percentComplete,
  isBackfilling,
  completedDays,
}: {
  percentComplete: number;
  isBackfilling: boolean;
  completedDays: number;
}) {
  if (percentComplete >= 100) {
    return (
      <span className="text-emerald-600 dark:text-emerald-400">Complete</span>
    );
  }
  if (isBackfilling) {
    return (
      <span className="text-amber-600 dark:text-amber-400">Backfilling...</span>
    );
  }
  if (completedDays === 0) {
    return <span className="text-muted-foreground">Planned</span>;
  }
  return <span className="text-muted-foreground">Partial</span>;
}

export function CoverageContent() {
  const { data, isLoading, error } = trpc.coverage.getStats.useQuery();

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Data Coverage</h1>
          <p className="text-sm text-muted-foreground">
            WhatsFiled tracks SEC Form 4 insider trading filings.
          </p>
        </div>

        {isLoading && (
          <div className="rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Loading coverage data...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
            <p className="text-sm text-red-800 dark:text-red-200">
              Failed to load coverage data.
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatNumber(data.totalFilings)} filings
              </span>
              {data.earliestDate && data.latestDate && (
                <span>
                  {" · "}
                  {formatDate(data.earliestDate)} – {formatDate(data.latestDate)}
                </span>
              )}
            </div>

            {/* Mobile: Card layout */}
            <div className="space-y-3 md:hidden">
              {data.years.map((year) => (
                <div
                  key={year.year}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{year.year}</span>
                    <StatusBadge
                      percentComplete={year.percentComplete}
                      isBackfilling={year.isBackfilling}
                      completedDays={year.completedDays}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      percent={year.percentComplete}
                      isBackfilling={year.isBackfilling}
                      blocks={12}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {year.percentComplete}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {year.completedDays}/{year.totalBusinessDays} trading days
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Year
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Progress
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Coverage
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Days
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.years.map((year) => (
                    <tr
                      key={year.year}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{year.year}</td>
                      <td className="px-4 py-3">
                        <ProgressBar
                          percent={year.percentComplete}
                          isBackfilling={year.isBackfilling}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {year.percentComplete}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {year.completedDays}/{year.totalBusinessDays}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          percentComplete={year.percentComplete}
                          isBackfilling={year.isBackfilling}
                          completedDays={year.completedDays}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              SEC markets are open ~252 trading days per year (excludes weekends
              and federal holidays).
            </p>
          </>
        )}

        <div className="pt-2">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to filings
          </Link>
        </div>
      </div>
    </main>
  );
}
