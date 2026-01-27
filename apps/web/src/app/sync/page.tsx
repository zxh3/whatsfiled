"use client";

import { trpc } from "@/lib/trpc";
import { Progress } from "@whatsfiled/ui/components/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@whatsfiled/ui/components/tooltip";
import { CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTimestamp(value?: Date | null): string {
  if (!value) return "—";
  return value.toLocaleTimeString();
}

function formatRelativeMinutes(target?: Date | null): string {
  if (!target) return "—";
  const diffMs = target.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  if (minutes <= 0) return "Now";
  return `${minutes}m`;
}

function HelpIcon() {
  return (
    <CircleHelp className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground ml-1" />
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help inline-flex">
          <HelpIcon />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function StatCard({
  label,
  value,
  tooltip,
  color,
}: {
  label: string;
  value: number | string;
  tooltip?: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-sm text-muted-foreground flex items-center">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className={`text-2xl font-mono font-bold ${color || "text-foreground"}`}>
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  tooltip,
}: {
  title: string;
  tooltip?: string;
}) {
  return (
    <h2 className="text-lg font-semibold mb-4 flex items-center">
      {title}
      {tooltip && <InfoTooltip content={tooltip} />}
    </h2>
  );
}

function LegendItem({
  color,
  label,
  tooltip,
}: {
  color: string;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1 cursor-help">
          <span className={`w-2 h-2 ${color} rounded-full`} />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function AdminPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const searchParams = useSearchParams();
  const showSkipped = searchParams.get("showSkipped") === "1";

  const statsQuery = trpc.pipeline.getStats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const coverageQuery = trpc.pipeline.getIndexCoverage.useQuery(
    { year: 2026, formType: "4" },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  useEffect(() => {
    if (statsQuery.dataUpdatedAt) {
      setLastUpdated(new Date(statsQuery.dataUpdatedAt));
    }
  }, [statsQuery.dataUpdatedAt]);

  const stats = statsQuery.data;
  const coverage = coverageQuery.data;

  const queueTotal = stats
    ? stats.queue.pending +
      stats.queue.processing +
      stats.queue.completed +
      stats.queue.failed +
      (showSkipped ? stats.queue.skipped : 0)
    : 0;

  const completedCount = stats
    ? stats.queue.completed + (showSkipped ? stats.queue.skipped : 0)
    : 0;

  const completedPercent = queueTotal > 0
    ? (completedCount / queueTotal) * 100
    : 0;

  const queuePercent = (count: number) =>
    queueTotal > 0 ? (count / queueTotal) * 100 : 0;

  return (
    <TooltipProvider delayDuration={300}>
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Sync Status</h1>
              <p className="text-sm text-muted-foreground mt-1">
                SEC EDGAR data ingestion progress
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh
              </label>
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6 space-y-8">
          {/* Loading state */}
          {statsQuery.isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading pipeline stats...
            </div>
          )}

          {/* Error state */}
          {statsQuery.isError && (
            <div className="text-center py-8 text-red-500">
              Error loading stats: {statsQuery.error.message}
            </div>
          )}

          {stats && (
            <>
              {/* Overall Progress */}
              <section>
                <SectionHeader
                  title="Filing Queue"
                  tooltip="Individual SEC filings (Form 4) waiting to be fetched, parsed, and stored in the database. Each filing is one insider trading report."
                />

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-mono">
                      {formatNumber(completedCount)} / {formatNumber(queueTotal)}
                      <span className="text-muted-foreground ml-2">
                        ({completedPercent.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
                    {/* Completed - green */}
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${queuePercent(stats.queue.completed)}%` }}
                    />
                    {/* Skipped - gray */}
                    {showSkipped && (
                      <div
                        className="h-full bg-gray-400 transition-all duration-500"
                        style={{ width: `${queuePercent(stats.queue.skipped)}%` }}
                      />
                    )}
                    {/* Processing - blue */}
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${queuePercent(stats.queue.processing)}%` }}
                    />
                    {/* Failed - red */}
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${queuePercent(stats.queue.failed)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                    <LegendItem
                      color="bg-green-500"
                      label="Completed"
                      tooltip="Successfully fetched, parsed, and stored in the database"
                    />
                    {showSkipped && (
                      <LegendItem
                        color="bg-gray-400"
                        label="Skipped"
                        tooltip="Already exists in database from a previous run (duplicate prevention)"
                      />
                    )}
                    <LegendItem
                      color="bg-blue-500"
                      label="Processing"
                      tooltip="Currently being fetched from SEC and parsed"
                    />
                    <LegendItem
                      color="bg-red-500"
                      label="Failed"
                      tooltip="Failed to process after 3 retry attempts"
                    />
                  </div>
                </div>

                {/* Stats grid */}
                <div className={`grid grid-cols-2 ${showSkipped ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-4`}>
                  <StatCard
                    label="Pending"
                    value={stats.queue.pending}
                    tooltip="Filings waiting in queue to be processed. Will be picked up by the next processing batch."
                    color="text-yellow-600"
                  />
                  <StatCard
                    label="Processing"
                    value={stats.queue.processing}
                    tooltip="Currently being fetched from SEC EDGAR and parsed. Locked to prevent duplicate processing."
                    color="text-blue-600"
                  />
                  <StatCard
                    label="Completed"
                    value={stats.queue.completed}
                    tooltip="Successfully fetched, parsed, and stored. Data is now available in the activity feed."
                    color="text-green-600"
                  />
                  <StatCard
                    label="Failed"
                    value={stats.queue.failed}
                    tooltip="Failed to process after 3 attempts. Usually due to malformed XML or network errors. Can be manually retried."
                    color="text-red-600"
                  />
                  {showSkipped && (
                    <StatCard
                      label="Skipped"
                      value={stats.queue.skipped}
                      tooltip="Already exists in database (same accession number). Prevents duplicate data when re-running backfill."
                      color="text-gray-500"
                    />
                  )}
                </div>
              </section>

              {/* Queue Health */}
              <section>
                <SectionHeader
                  title="Queue Health"
                  tooltip="Signals that show whether processing is active and healthy."
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="Processed (15m)"
                    value={stats.queueHealth.processedLast15m}
                    tooltip="Filings completed or skipped in the last 15 minutes."
                    color="text-green-600"
                  />
                  <StatCard
                    label="Last processed"
                    value={formatTimestamp(stats.queueHealth.lastProcessedAt)}
                    tooltip="Most recent completed or skipped filing."
                  />
                  <StatCard
                    label="Stale locks"
                    value={stats.queueHealth.staleLocks}
                    tooltip="Processing rows whose locks have expired."
                    color={stats.queueHealth.staleLocks > 0 ? "text-red-600" : "text-muted-foreground"}
                  />
                  <StatCard
                    label="Next lock expiry"
                    value={formatRelativeMinutes(stats.queueHealth.nextLockExpiryAt)}
                    tooltip="Time until the oldest processing lock expires."
                  />
                </div>
              </section>

              {/* Active Workers */}
              <section>
                <SectionHeader
                  title="Active Workers"
                  tooltip="Backfill or cron workers currently processing filings."
                />
                <div className="bg-card border border-border rounded-lg p-4 text-sm">
                  {stats.workers.length === 0 ? (
                    <p className="text-muted-foreground">No worker heartbeats yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.workers.map((worker) => (
                        <div
                          key={worker.workerKey}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                                  worker.isActive ? "bg-green-500" : "bg-muted-foreground/60"
                                }`}
                              />
                              <span className="font-medium text-foreground">
                                {worker.workerType} {worker.stage ? `· ${worker.stage}` : ""}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {worker.host || "unknown host"} · pid {worker.pid ?? "?"}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-right">
                            <div>
                              Last heartbeat{" "}
                              <span className={worker.isActive ? "text-green-600" : ""}>
                                {formatTimestamp(worker.lastHeartbeatAt)}
                              </span>
                            </div>
                            <div>
                              Started {formatTimestamp(worker.startedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Index Files */}
              <section>
                <SectionHeader
                  title="Daily Index Files"
                  tooltip="SEC publishes a daily index listing all filings for that day. We download these to discover which Form 4 filings to process."
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="Pending"
                    value={stats.index.pending}
                    tooltip="Daily index files discovered but not yet downloaded and parsed."
                    color="text-yellow-600"
                  />
                  <StatCard
                    label="Processing"
                    value={stats.index.processing}
                    tooltip="Currently being downloaded from SEC and parsed to extract filing entries."
                    color="text-blue-600"
                  />
                  <StatCard
                    label="Completed"
                    value={stats.index.completed}
                    tooltip="Successfully parsed. All Form 4 filings from this date have been added to the filing queue."
                    color="text-green-600"
                  />
                  <StatCard
                    label="Failed"
                    value={stats.index.failed}
                    tooltip="Failed to download or parse. Usually due to network errors or SEC server issues."
                    color="text-red-600"
                  />
                </div>
              </section>
            </>
          )}

          {/* Coverage */}
          {coverage && (
            <section>
              <SectionHeader
                title={`2026 Coverage (${coverage.completedDays} / ${coverage.totalDays} days fully processed)`}
                tooltip="Shows each business day and the actual filing processing progress. A day is 'fully processed' when all filings for that date have been fetched, parsed, and stored."
              />
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left w-48">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">Filing Progress</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>
                              {showSkipped
                                ? "Actual progress of fetching, parsing, and storing filings for this date. Green = completed, Gray = skipped (duplicates), Blue = processing, Yellow = pending."
                                : "Actual progress of fetching, parsing, and storing filings for this date. Green = completed, Blue = processing, Yellow = pending."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">Done</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {showSkipped
                                ? "Filings successfully processed (completed + skipped duplicates)"
                                : "Filings successfully processed (completed only)"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">Total</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Total filings discovered for this date</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.coverage.slice(-20).reverse().map((day) => {
                      const p = day.filingProgress;
                      const total = showSkipped ? p.total : Math.max(p.total - p.skipped, 0);
                      const done = showSkipped ? p.done : p.completed;
                      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                      const hasData = total > 0;
                      const isComplete = hasData && done === total;

                      return (
                        <tr key={day.date} className="border-t border-border">
                          <td className="px-4 py-2 font-mono">{day.date}</td>
                          <td className="px-4 py-2">
                            {hasData ? (
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={percent}
                                  className="flex-1"
                                  indicatorClassName="bg-green-500"
                                />
                                <span
                                  className={`text-xs font-mono w-10 text-right ${
                                    isComplete ? "text-green-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {percent}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {day.indexStatus === "pending" ? "Index pending" : "No filings"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {hasData ? (
                              <span className={isComplete ? "text-green-600" : ""}>
                                {done.toLocaleString()}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {hasData ? total.toLocaleString() : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="text-center text-xs text-muted-foreground py-4">
            <a href="/" className="hover:underline">
              &larr; Back to Activity Feed
            </a>
          </footer>
        </div>
      </main>
    </TooltipProvider>
  );
}
