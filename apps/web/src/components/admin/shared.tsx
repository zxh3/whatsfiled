"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@whatsfiled/ui/components/tooltip";
import { CircleHelp } from "lucide-react";

export function HelpIcon() {
  return (
    <CircleHelp className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
  );
}

export function InfoTooltip({ content }: { content: string }) {
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

export function formatRelativeTime(date: Date | string | null): string {
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

export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function StatCard({
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
      <div
        className={`text-2xl font-mono font-bold ${color || "text-foreground"}`}
      >
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
    </div>
  );
}

export function SectionHeader({
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

export function LegendItem({
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
