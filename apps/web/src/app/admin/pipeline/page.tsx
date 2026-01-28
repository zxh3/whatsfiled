"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@whatsfiled/ui/components/tooltip";
import { CircleHelp, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";

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

  const runsQuery = trpc.pipeline.getTriggerRunsByTask.useQuery(
    { runsPerTask: 10 },
    { refetchInterval: autoRefresh ? 5000 : false },
  );

  const data = runsQuery.data;

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
