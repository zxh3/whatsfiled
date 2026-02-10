"use client";

import { cn } from "@whatsfiled/ui/lib/utils";
import Link from "next/link";

type FilingSummary = {
  id: string;
  accessionNumber: string;
  filedAt: Date;
  company: {
    id: string;
    name: string;
    cik: string;
    ticker: string | null;
  };
  primaryOwner: {
    id: string;
    name: string;
    cik: string | null;
    title: string;
  } | null;
  ownerCount: number;
  summary: {
    transactionType: "buy" | "sell" | "mixed" | "none";
    totalAcquired: number;
    totalDisposed: number;
    totalAcquiredValue: number;
    totalDisposedValue: number;
    avgPricePerShare: number;
    netShares: number;
    totalActivityValue: number;
    sharesOwnedAfter: number;
    ownershipChangePercent: number | null;
    transactionCount: number;
  };
};

interface FilingSummaryTableProps {
  filings: FilingSummary[];
  isLoading?: boolean;
  className?: string;
}

function formatDate(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0];
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatSignedShares(
  value: number,
  mode: "buy" | "sell" | "net",
): string {
  if (value === 0) return "0";

  if (mode === "buy") return `+${formatNumber(value)}`;
  if (mode === "sell") return `-${formatNumber(value)}`;
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${sign}${rounded}%`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function TypeBadge({
  transactionType,
}: {
  transactionType: "buy" | "sell" | "mixed" | "none";
}) {
  if (transactionType === "buy") {
    return (
      <span className="inline-flex rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
        Buy
      </span>
    );
  }

  if (transactionType === "sell") {
    return (
      <span className="inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        Sale
      </span>
    );
  }

  if (transactionType === "mixed") {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
        Mixed
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      None
    </span>
  );
}

function getRowNumberColorClass(filing: FilingSummary): string {
  if (filing.summary.transactionType === "buy") return "text-green-400";
  if (filing.summary.transactionType === "sell") return "text-red-400";
  if (filing.summary.netShares > 0) return "text-green-400";
  if (filing.summary.netShares < 0) return "text-red-400";
  return "text-muted-foreground";
}

function FilingCard({ filing }: { filing: FilingSummary }) {
  const ownerLabel = filing.primaryOwner
    ? filing.ownerCount > 1
      ? `${filing.primaryOwner.name} +${filing.ownerCount - 1}`
      : filing.primaryOwner.name
    : "Unknown";
  const ownerTitle = filing.primaryOwner?.title?.trim() || null;
  const rowNumberColorClass = getRowNumberColorClass(filing);

  return (
    <Link
      href={`/filing/${filing.accessionNumber}`}
      prefetch={false}
      className="block rounded-lg border border-border p-3 hover:bg-muted/30 active:bg-muted/50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-semibold">
            {filing.company.ticker || filing.company.name}
          </span>
          <TypeBadge transactionType={filing.summary.transactionType} />
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(filing.filedAt)}
        </span>
      </div>

      <div className="mt-1 truncate text-xs text-muted-foreground">
        {ownerLabel}
        {ownerTitle ? ` · ${ownerTitle}` : ""}
        {" · "}
        {filing.summary.transactionCount.toLocaleString()} transactions
      </div>

      <div className="my-2 border-t border-border/50" />

      <div className="flex items-center justify-between text-sm font-mono">
        <span className="text-xs font-sans text-muted-foreground">Qty</span>
        <span className={rowNumberColorClass}>
          {formatSignedShares(filing.summary.netShares, "net")}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className={rowNumberColorClass}>
          Price {formatCurrency(filing.summary.avgPricePerShare)}
        </span>
        <span className={rowNumberColorClass}>
          Owned {formatNumber(filing.summary.sharesOwnedAfter)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className={rowNumberColorClass}>
          ΔOwn {formatPercent(filing.summary.ownershipChangePercent)}
        </span>
        <span className={rowNumberColorClass}>
          Value {formatCompactCurrency(filing.summary.totalActivityValue)}
        </span>
      </div>
    </Link>
  );
}

function FilingSummaryTable({
  filings,
  isLoading,
  className,
}: FilingSummaryTableProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static loading skeleton
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (filings.length === 0) {
    return (
      <div className={cn("py-12 text-center text-muted-foreground", className)}>
        No filings found.
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2 md:hidden">
        {filings.map((filing) => (
          <FilingCard key={filing.id} filing={filing} />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-[10%] px-2 py-1 font-medium">Date</th>
              <th className="w-[8%] px-2 py-1 font-medium">Company</th>
              <th className="w-[14%] px-2 py-1 font-medium">Insider</th>
              <th className="w-[14%] px-2 py-1 font-medium">Title</th>
              <th className="w-[9%] px-2 py-1 font-medium">Type</th>
              <th className="w-[9%] px-2 py-1 font-medium text-right">Price</th>
              <th className="w-[11%] px-2 py-1 font-medium text-right">Qty</th>
              <th className="w-[9%] px-2 py-1 font-medium text-right">Owned</th>
              <th className="w-[8%] px-2 py-1 font-medium text-right">ΔOwn</th>
              <th className="w-[9%] px-2 py-1 font-medium text-right">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {filings.map((filing) => {
              const ownerLabel = filing.primaryOwner
                ? filing.ownerCount > 1
                  ? `${filing.primaryOwner.name} +${filing.ownerCount - 1}`
                  : filing.primaryOwner.name
                : "Unknown";
              const ownerTitle = filing.primaryOwner?.title?.trim() || null;
              const rowNumberColorClass = getRowNumberColorClass(filing);

              return (
                <tr
                  key={filing.id}
                  className="border-b border-border/50 hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                    <Link
                      href={`/filing/${filing.accessionNumber}`}
                      prefetch={false}
                      className="hover:text-foreground hover:underline"
                    >
                      {formatDate(filing.filedAt)}
                    </Link>
                  </td>
                  <td className="overflow-hidden px-2 py-1">
                    <Link
                      href={`/company/${filing.company.cik}`}
                      prefetch={false}
                      className="block truncate font-medium hover:underline"
                    >
                      {filing.company.ticker || filing.company.name}
                    </Link>
                  </td>
                  <td className="overflow-hidden px-2 py-1">
                    <span className="block truncate">{ownerLabel}</span>
                  </td>
                  <td className="overflow-hidden px-2 py-1 text-muted-foreground">
                    <span className="block truncate">{ownerTitle || "-"}</span>
                  </td>
                  <td className="px-2 py-1">
                    <TypeBadge
                      transactionType={filing.summary.transactionType}
                    />
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1 text-right font-mono",
                      rowNumberColorClass,
                    )}
                  >
                    {formatCurrency(filing.summary.avgPricePerShare)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1 text-right font-mono",
                      rowNumberColorClass,
                    )}
                  >
                    {formatSignedShares(filing.summary.netShares, "net")}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1 text-right font-mono",
                      rowNumberColorClass,
                    )}
                  >
                    {formatNumber(filing.summary.sharesOwnedAfter)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1 text-right font-mono",
                      rowNumberColorClass,
                    )}
                  >
                    {formatPercent(filing.summary.ownershipChangePercent)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1 text-right font-mono",
                      rowNumberColorClass,
                    )}
                  >
                    {formatCompactCurrency(filing.summary.totalActivityValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { FilingSummaryTable };
export type { FilingSummary, FilingSummaryTableProps };
