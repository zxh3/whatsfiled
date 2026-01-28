"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { Checkbox } from "@whatsfiled/ui/components/checkbox";
import { Label } from "@whatsfiled/ui/components/label";
import { Progress } from "@whatsfiled/ui/components/progress";
import { Spinner } from "@whatsfiled/ui/components/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@whatsfiled/ui/components/tooltip";
import { RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatNumber, LegendItem, SectionHeader, StatCard } from "./shared";

export function SyncProgressTab() {
  const searchParams = useSearchParams();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const yearParam = searchParams.get("year");
  const showSkippedParam = searchParams.get("showSkipped");

  const showSkipped = showSkippedParam === "1";
  const selectedYear = yearParam ? Number(yearParam) : 2026;

  const statsQuery = trpc.pipeline.getStats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const coverageQuery = trpc.pipeline.getIndexCoverage.useQuery(
    { year: selectedYear, formType: "4" },
    { refetchInterval: autoRefresh ? 30000 : false },
  );

  const retryMutation = trpc.pipeline.retryFailedFilings.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
    },
  });

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

  const completedPercent =
    queueTotal > 0 ? (completedCount / queueTotal) * 100 : 0;

  const queuePercent = (count: number) =>
    queueTotal > 0 ? (count / queueTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            SEC EDGAR data ingestion progress
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(checked === true)}
            />
            Auto-refresh
          </Label>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => statsQuery.refetch()}
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${statsQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {statsQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {statsQuery.isError && (
        <div className="text-center py-8 text-red-500">
          Error loading stats: {statsQuery.error.message}
        </div>
      )}

      {stats && (
        <div className="space-y-8">
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
                  style={{
                    width: `${queuePercent(stats.queue.completed)}%`,
                  }}
                />
                {/* Skipped - gray */}
                {showSkipped && (
                  <div
                    className="h-full bg-gray-400 transition-all duration-500"
                    style={{
                      width: `${queuePercent(stats.queue.skipped)}%`,
                    }}
                  />
                )}
                {/* Failed - red */}
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{
                    width: `${queuePercent(stats.queue.failed)}%`,
                  }}
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
                  color="bg-red-500"
                  label="Failed"
                  tooltip="Failed to process after 3 retry attempts"
                />
              </div>
            </div>

            {/* Stats grid */}
            <div
              className={`grid grid-cols-2 ${showSkipped ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}
            >
              <StatCard
                label="Pending"
                value={stats.queue.pending}
                tooltip="Filings waiting in queue to be processed. Will be picked up by the next processing batch."
                color="text-yellow-600"
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

          {/* Coverage */}
          {coverage && (
            <section>
              <SectionHeader
                title={`${selectedYear} Coverage (${coverage.completedDays} / ${coverage.totalDays} days fully processed)`}
                tooltip="Shows each business day and the actual filing processing progress. A day is 'fully processed' when all filings for that date have been fetched, parsed, and stored."
              />
              <div className="mb-4 flex items-center gap-3 text-sm">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Year
                </span>
                <div className="flex gap-2">
                  {[2026, 2025, 2024, 2023].map((y) => (
                    <Link
                      key={y}
                      href={`/admin?year=${y}${showSkipped ? "&showSkipped=1" : ""}`}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        y === selectedYear
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {y}
                    </Link>
                  ))}
                </div>
              </div>
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
                    {coverage.coverage
                      .slice()
                      .reverse()
                      .map((day) => {
                        const p = day.filingProgress;
                        const total = showSkipped
                          ? p.total
                          : Math.max(p.total - p.skipped, 0);
                        const done = showSkipped ? p.done : p.completed;
                        const percent =
                          total > 0 ? Math.round((done / total) * 100) : 0;
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
                                      isComplete
                                        ? "text-green-600"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {percent}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {day.indexStatus === "pending"
                                    ? "Index pending"
                                    : "No filings"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {hasData ? (
                                <span
                                  className={isComplete ? "text-green-600" : ""}
                                >
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
        </div>
      )}
    </div>
  );
}
