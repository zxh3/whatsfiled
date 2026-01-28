"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@whatsfiled/ui/components/tooltip";
import { CircleHelp, ExternalLink, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";

const CURRENT_YEAR = new Date().getFullYear();

const TRIGGER_PROJECT_ID = "proj_tqvevnijvybdwlvcqfee";

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(
  start: Date | string | null,
  end: Date | string | null,
): string {
  if (!start || !end) return "-";
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  const remainingSec = diffSec % 60;
  if (diffMin < 60) return `${diffMin}m ${remainingSec}s`;
  const diffHour = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;
  return `${diffHour}h ${remainingMin}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "text-green-600";
    case "FAILED":
    case "CRASHED":
    case "SYSTEM_FAILURE":
      return "text-red-600";
    case "EXECUTING":
    case "REATTEMPTING":
      return "text-blue-600";
    case "QUEUED":
    case "PENDING":
      return "text-yellow-600";
    case "CANCELED":
      return "text-gray-500";
    default:
      return "text-muted-foreground";
  }
}

function getStatusDot(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-500";
    case "FAILED":
    case "CRASHED":
    case "SYSTEM_FAILURE":
      return "bg-red-500";
    case "EXECUTING":
    case "REATTEMPTING":
      return "bg-blue-500 animate-pulse";
    case "QUEUED":
    case "PENDING":
      return "bg-yellow-500";
    case "CANCELED":
      return "bg-gray-400";
    default:
      return "bg-muted-foreground";
  }
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

export default function AdminPipelinePage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Form state for backfill
  const [backfillYear, setBackfillYear] = useState(CURRENT_YEAR);
  const [backfillLimit, setBackfillLimit] = useState<string>("");

  // Form state for process indexes
  const [indexLimit, setIndexLimit] = useState<string>("");
  const [triggerFilings, setTriggerFilings] = useState(true);

  // Form state for process filings
  const [filingLimit, setFilingLimit] = useState<string>("");

  // Status message
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const runsQuery = trpc.pipeline.getTriggerRunsByTask.useQuery(
    { runsPerTask: 10 },
    { refetchInterval: autoRefresh ? 5000 : false },
  );

  const backfillMutation = trpc.pipeline.triggerBackfill.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Backfill started! Run ID: ${data.runId?.slice(0, 20)}...`,
        });
        runsQuery.refetch();
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Unknown error",
        });
      }
    },
    onError: (error) => {
      setStatusMessage({ type: "error", text: error.message });
    },
  });

  const processIndexesMutation =
    trpc.pipeline.triggerProcessIndexes.useMutation({
      onSuccess: (data) => {
        if (data.success) {
          setStatusMessage({
            type: "success",
            text: `Index processing started! Run ID: ${data.runId?.slice(0, 20)}...`,
          });
          runsQuery.refetch();
        } else {
          setStatusMessage({
            type: "error",
            text: data.error || "Unknown error",
          });
        }
      },
      onError: (error) => {
        setStatusMessage({ type: "error", text: error.message });
      },
    });

  const processFilingsMutation =
    trpc.pipeline.triggerProcessFilings.useMutation({
      onSuccess: (data) => {
        if (data.success) {
          setStatusMessage({
            type: "success",
            text: `Filing processing started! Run ID: ${data.runId?.slice(0, 20)}...`,
          });
          runsQuery.refetch();
        } else {
          setStatusMessage({
            type: "error",
            text: data.error || "Unknown error",
          });
        }
      },
      onError: (error) => {
        setStatusMessage({ type: "error", text: error.message });
      },
    });

  const data = runsQuery.data;

  const handleBackfill = () => {
    setStatusMessage(null);
    backfillMutation.mutate({
      year: backfillYear,
      limitIndexFiles: backfillLimit
        ? Number.parseInt(backfillLimit, 10)
        : undefined,
    });
  };

  const handleProcessIndexes = () => {
    setStatusMessage(null);
    processIndexesMutation.mutate({
      limit: indexLimit ? Number.parseInt(indexLimit, 10) : undefined,
      triggerFilingProcessing: triggerFilings,
    });
  };

  const handleProcessFilings = () => {
    setStatusMessage(null);
    processFilingsMutation.mutate({
      limit: filingLimit ? Number.parseInt(filingLimit, 10) : undefined,
    });
  };

  const isAnyMutationPending =
    backfillMutation.isPending ||
    processIndexesMutation.isPending ||
    processFilingsMutation.isPending;

  return (
    <TooltipProvider delayDuration={300}>
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Pipeline Admin</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Trigger.dev task execution monitoring
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={`https://cloud.trigger.dev/projects/v3/${TRIGGER_PROJECT_ID}/runs`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Open Trigger.dev
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh
              </label>
              <button
                type="button"
                onClick={() => runsQuery.refetch()}
                className="p-1.5 rounded hover:bg-muted"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${runsQuery.isFetching ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Loading state */}
          {runsQuery.isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading Trigger.dev runs...
            </div>
          )}

          {/* Error state */}
          {data?.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-500">
              {data.error}
            </div>
          )}

          {/* Status message */}
          {statusMessage && (
            <div
              className={`rounded-lg p-3 text-sm ${
                statusMessage.type === "success"
                  ? "bg-green-500/10 border border-green-500/30 text-green-600"
                  : "bg-red-500/10 border border-red-500/30 text-red-500"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Trigger Actions */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Play className="w-4 h-4" />
                Trigger Tasks
              </h2>
            </div>
            <div className="p-4 space-y-6">
              {/* Backfill */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Backfill Year</h3>
                  <InfoTooltip content="Discover all index files for a year and process all filings. This is the full pipeline - discovery → index processing → filing processing." />
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={backfillYear}
                    onChange={(e) => setBackfillYear(Number(e.target.value))}
                    className="rounded border border-border bg-background px-3 py-1.5 text-sm"
                    disabled={isAnyMutationPending}
                  >
                    {[
                      CURRENT_YEAR,
                      CURRENT_YEAR - 1,
                      CURRENT_YEAR - 2,
                      CURRENT_YEAR - 3,
                    ].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Limit index files (optional)"
                    value={backfillLimit}
                    onChange={(e) => setBackfillLimit(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-1.5 text-sm w-48"
                    min="1"
                    max="500"
                    disabled={isAnyMutationPending}
                  />
                  <button
                    type="button"
                    onClick={handleBackfill}
                    disabled={isAnyMutationPending}
                    className="rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
                  >
                    {backfillMutation.isPending
                      ? "Starting..."
                      : "Start Backfill"}
                  </button>
                </div>
              </div>

              <hr className="border-border" />

              {/* Process Pending Indexes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">
                    Process Pending Indexes
                  </h3>
                  <InfoTooltip content="Process index files that are in 'pending' status. This parses each index file and creates filing queue entries." />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="Limit (optional)"
                    value={indexLimit}
                    onChange={(e) => setIndexLimit(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-1.5 text-sm w-32"
                    min="1"
                    max="100"
                    disabled={isAnyMutationPending}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={triggerFilings}
                      onChange={(e) => setTriggerFilings(e.target.checked)}
                      className="rounded"
                      disabled={isAnyMutationPending}
                    />
                    Also process filings
                  </label>
                  <button
                    type="button"
                    onClick={handleProcessIndexes}
                    disabled={isAnyMutationPending}
                    className="rounded bg-muted px-4 py-1.5 text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
                  >
                    {processIndexesMutation.isPending
                      ? "Starting..."
                      : "Process Indexes"}
                  </button>
                </div>
              </div>

              <hr className="border-border" />

              {/* Process Pending Filings */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">
                    Process Pending Filings
                  </h3>
                  <InfoTooltip content="Process filings that are in 'pending' status. This fetches each filing from SEC, parses it, and stores the data." />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="Limit (optional)"
                    value={filingLimit}
                    onChange={(e) => setFilingLimit(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-1.5 text-sm w-32"
                    min="1"
                    max="1000"
                    disabled={isAnyMutationPending}
                  />
                  <button
                    type="button"
                    onClick={handleProcessFilings}
                    disabled={isAnyMutationPending}
                    className="rounded bg-muted px-4 py-1.5 text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
                  >
                    {processFilingsMutation.isPending
                      ? "Starting..."
                      : "Process Filings"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Tasks */}
          {data?.tasks && data.tasks.length > 0 && (
            <div className="space-y-6">
              {data.tasks.map((task) => (
                <section
                  key={task.taskId}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  {/* Task header */}
                  <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="font-mono font-semibold">{task.taskId}</h2>
                      <InfoTooltip
                        content={`Last 10 runs of the ${task.taskId} task`}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-600">
                        {task.stats.completed} completed
                      </span>
                      {task.stats.failed > 0 && (
                        <span className="text-red-600">
                          {task.stats.failed} failed
                        </span>
                      )}
                      {task.stats.running > 0 && (
                        <span className="text-blue-600">
                          {task.stats.running} running
                        </span>
                      )}
                      {task.stats.queued > 0 && (
                        <span className="text-yellow-600">
                          {task.stats.queued} queued
                        </span>
                      )}
                      <a
                        href={`https://cloud.trigger.dev/projects/v3/${TRIGGER_PROJECT_ID}/runs?tasks=${task.taskId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        View all
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Runs table */}
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left w-24">Status</th>
                        <th className="px-4 py-2 text-left">Run ID</th>
                        <th className="px-4 py-2 text-right">Started</th>
                        <th className="px-4 py-2 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {task.runs.map((run) => (
                        <tr
                          key={run.id}
                          className="border-t border-border/50 hover:bg-muted/20"
                        >
                          <td className="px-4 py-2">
                            <span className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${getStatusDot(run.status)}`}
                              />
                              <span
                                className={`text-xs font-medium ${getStatusColor(run.status)}`}
                              >
                                {run.status}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <a
                              href={`https://cloud.trigger.dev/projects/v3/${TRIGGER_PROJECT_ID}/runs/${run.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs hover:underline text-muted-foreground hover:text-foreground"
                            >
                              {run.id.slice(0, 20)}...
                            </a>
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                            {formatRelativeTime(run.startedAt ?? run.createdAt)}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-muted-foreground font-mono">
                            {formatDuration(run.startedAt, run.finishedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}

          {/* Empty state */}
          {data?.tasks && data.tasks.length === 0 && !data.error && (
            <div className="text-center py-8 text-muted-foreground">
              No recent runs found.
            </div>
          )}

          {/* Footer */}
          <footer className="text-center text-xs text-muted-foreground py-4">
            <Link href="/sync" className="hover:underline">
              &larr; Back to Sync Status
            </Link>
          </footer>
        </div>
      </main>
    </TooltipProvider>
  );
}
