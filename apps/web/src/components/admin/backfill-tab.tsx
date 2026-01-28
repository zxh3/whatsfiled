"use client";

import { Button } from "@whatsfiled/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whatsfiled/ui/components/card";
import { Checkbox } from "@whatsfiled/ui/components/checkbox";
import { Input } from "@whatsfiled/ui/components/input";
import { Label } from "@whatsfiled/ui/components/label";
import {
  Calendar,
  ExternalLink,
  FileText,
  FolderSearch,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime, InfoTooltip } from "./shared";

const TRIGGER_PROJECT_ID = "proj_tqvevnijvybdwlvcqfee";

// Date preset helper
type DatePreset = "today" | "last7" | "last30" | "thisMonth";

function getDatePreset(preset: DatePreset): { start: string; end: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { start: formatDate(today), end: formatDate(today) };
    case "last7": {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      return { start: formatDate(d7), end: formatDate(today) };
    }
    case "last30": {
      const d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      return { start: formatDate(d30), end: formatDate(today) };
    }
    case "thisMonth": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(monthStart), end: formatDate(today) };
    }
  }
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

function DateRangeInputs({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  disabled,
  showPresets = false,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  disabled?: boolean;
  showPresets?: boolean;
}) {
  const handlePreset = (preset: DatePreset) => {
    const { start, end } = getDatePreset(preset);
    onStartChange(start);
    onEndChange(end);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            From
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartChange(e.target.value)}
            className="w-40"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            to
          </Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndChange(e.target.value)}
            className="w-40"
            disabled={disabled}
          />
        </div>
      </div>
      {showPresets && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick select:</span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset("today")}
              disabled={disabled}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset("last7")}
              disabled={disabled}
            >
              Last 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset("last30")}
              disabled={disabled}
            >
              Last 30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset("thisMonth")}
              disabled={disabled}
            >
              This month
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BackfillTab() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Form state for backfill - initialize with today's date
  const [backfillStartDate, setBackfillStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [backfillEndDate, setBackfillEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [backfillLimit, setBackfillLimit] = useState<string>("");

  // Form state for process indexes
  const [indexStartDate, setIndexStartDate] = useState<string>("");
  const [indexEndDate, setIndexEndDate] = useState<string>("");
  const [indexLimit, setIndexLimit] = useState<string>("100");
  const [triggerFilings, setTriggerFilings] = useState(true);

  // Form state for process filings
  const [filingStartDate, setFilingStartDate] = useState<string>("");
  const [filingEndDate, setFilingEndDate] = useState<string>("");
  const [filingLimit, setFilingLimit] = useState<string>("500");

  // Status message
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
    runId?: string | null;
  } | null>(null);

  const runsQuery = trpc.pipeline.getTriggerRunsByTask.useQuery(
    { runsPerTask: 10 },
    { refetchInterval: autoRefresh ? 5000 : false },
  );

  useEffect(() => {
    if (runsQuery.dataUpdatedAt) {
      setLastUpdated(new Date(runsQuery.dataUpdatedAt));
    }
  }, [runsQuery.dataUpdatedAt]);

  const backfillMutation = trpc.pipeline.triggerBackfill.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: "Backfill started!",
          runId: data.runId,
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
            text: "Index processing started!",
            runId: data.runId,
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
            text: "Filing processing started!",
            runId: data.runId,
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
    if (!backfillStartDate || !backfillEndDate) {
      setStatusMessage({
        type: "error",
        text: "Please select both start and end dates",
      });
      return;
    }
    setStatusMessage(null);
    backfillMutation.mutate({
      startDate: backfillStartDate,
      endDate: backfillEndDate,
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
      startDate: indexStartDate || undefined,
      endDate: indexEndDate || undefined,
    });
  };

  const handleProcessFilings = () => {
    setStatusMessage(null);
    processFilingsMutation.mutate({
      limit: filingLimit ? Number.parseInt(filingLimit, 10) : undefined,
      startDate: filingStartDate || undefined,
      endDate: filingEndDate || undefined,
    });
  };

  const isAnyMutationPending =
    backfillMutation.isPending ||
    processIndexesMutation.isPending ||
    processFilingsMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
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
            onClick={() => runsQuery.refetch()}
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${runsQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

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
          {statusMessage.runId && (
            <>
              {" "}
              <a
                href={`https://cloud.trigger.dev/projects/v3/${TRIGGER_PROJECT_ID}/runs/${statusMessage.runId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                View run in Trigger.dev
              </a>
            </>
          )}
        </div>
      )}

      {/* Trigger Actions - Card-based layout */}
      <div className="grid gap-6">
        {/* Backfill SEC Data */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Backfill SEC Data</CardTitle>
              <InfoTooltip content="Fetch SEC EDGAR index files for a date range and process all filings. This is the full pipeline: discovery -> index processing -> filing processing." />
            </div>
            <CardDescription>
              Discover index files from SEC EDGAR and process all filings for
              the selected dates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateRangeInputs
              startDate={backfillStartDate}
              endDate={backfillEndDate}
              onStartChange={setBackfillStartDate}
              onEndChange={setBackfillEndDate}
              disabled={isAnyMutationPending}
              showPresets
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                  Limit index files
                </Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={backfillLimit}
                  onChange={(e) => setBackfillLimit(e.target.value)}
                  className="w-28"
                  min={1}
                  max={500}
                  disabled={isAnyMutationPending}
                />
              </div>
              <Button
                onClick={handleBackfill}
                disabled={isAnyMutationPending}
                className="ml-auto"
              >
                <Play className="w-4 h-4 mr-2" />
                {backfillMutation.isPending ? "Starting..." : "Start Backfill"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Process Pending Indexes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FolderSearch className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Process Pending Indexes</CardTitle>
              <InfoTooltip content="Parse pending index files to discover individual filings. Optionally filter by index date." />
            </div>
            <CardDescription>
              Parse index files with status "pending" to create filing queue
              entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Date filter (optional):
                </span>
              </div>
              <DateRangeInputs
                startDate={indexStartDate}
                endDate={indexEndDate}
                onStartChange={setIndexStartDate}
                onEndChange={setIndexEndDate}
                disabled={isAnyMutationPending}
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                  Limit
                </Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={indexLimit}
                  onChange={(e) => setIndexLimit(e.target.value)}
                  className="w-24"
                  min={1}
                  max={100}
                  disabled={isAnyMutationPending}
                />
              </div>
              <Label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={triggerFilings}
                  onCheckedChange={(checked) =>
                    setTriggerFilings(checked === true)
                  }
                  disabled={isAnyMutationPending}
                />
                Also process discovered filings
              </Label>
              <Button
                variant="secondary"
                onClick={handleProcessIndexes}
                disabled={isAnyMutationPending}
                className="ml-auto"
              >
                {processIndexesMutation.isPending
                  ? "Starting..."
                  : "Process Indexes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Process Pending Filings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Process Pending Filings</CardTitle>
              <InfoTooltip content="Fetch and parse pending filings from SEC EDGAR. Optionally filter by filing date." />
            </div>
            <CardDescription>
              Fetch and parse filings with status "pending" from SEC EDGAR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Filing date filter (optional):
                </span>
              </div>
              <DateRangeInputs
                startDate={filingStartDate}
                endDate={filingEndDate}
                onStartChange={setFilingStartDate}
                onEndChange={setFilingEndDate}
                disabled={isAnyMutationPending}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                  Limit
                </Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={filingLimit}
                  onChange={(e) => setFilingLimit(e.target.value)}
                  className="w-24"
                  min={1}
                  max={1000}
                  disabled={isAnyMutationPending}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleProcessFilings}
                disabled={isAnyMutationPending}
                className="ml-auto"
              >
                {processFilingsMutation.isPending
                  ? "Starting..."
                  : "Process Filings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
