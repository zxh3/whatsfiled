"use client";

import { Spinner } from "@whatsfiled/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@whatsfiled/ui/components/tabs";
import { cn } from "@whatsfiled/ui/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 50;
const LOAD_MORE_THRESHOLD = "200px";

type DiscoverItem = {
  filingId: string;
  accessionNumber: string;
  filedAt: Date;
  company: {
    id: string;
    cik: string;
    name: string;
    ticker: string | null;
  };
  insider: {
    id: string;
    name: string;
    cik: string | null;
    title: string;
  };
  metrics: {
    transactionType: "buy" | "sell" | "mixed" | "none";
    netShares: number;
    tradeValue: number;
    buyValue: number;
    sellValue: number;
    avgPricePerShare: number;
    ownedAfter: number;
    deltaOwnPct: number | null;
    txCount: number;
  };
  score: number;
  reasons: string[];
};

function formatDate(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0];
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatSigned(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getRowColor(item: DiscoverItem): string {
  if (item.metrics.transactionType === "buy") return "text-green-400";
  if (item.metrics.transactionType === "sell") return "text-red-400";
  if (item.metrics.netShares > 0) return "text-green-400";
  if (item.metrics.netShares < 0) return "text-red-400";
  return "text-muted-foreground";
}

function TypeBadge({ type }: { type: "buy" | "sell" | "mixed" | "none" }) {
  if (type === "buy") {
    return (
      <span className="inline-flex rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
        Buy
      </span>
    );
  }
  if (type === "sell") {
    return (
      <span className="inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        Sale
      </span>
    );
  }
  if (type === "mixed") {
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

export function DiscoverFeed({ companyIds }: { companyIds?: string[] }) {
  const [window, setWindow] = useState<"1d" | "7d" | "30d">("7d");
  const [direction, setDirection] = useState<"all" | "buy" | "sell">("all");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [stableHasMore, setStableHasMore] = useState(false);
  const prevOffset = useRef(0);
  const loaderRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, isFetching, error } =
    trpc.discover.getFeed.useQuery(
      {
        window,
        direction,
        limit: PAGE_SIZE,
        offset,
        companyIds,
      },
      { staleTime: 30000 },
    );

  const hasMore = data?.pagination.hasMore ?? stableHasMore;

  useEffect(() => {
    if (!data) return;
    setStableHasMore(data.pagination.hasMore);

    if (offset === 0) {
      setItems(data.items);
    } else if (offset > prevOffset.current) {
      setItems((prev) => {
        const existingIds = new Set(
          prev.map((item) => `${item.filingId}-${item.score}`),
        );
        const append = data.items.filter(
          (item) => !existingIds.has(`${item.filingId}-${item.score}`),
        );
        return [...prev, ...append];
      });
    }
    prevOffset.current = offset;
  }, [data, offset]);

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !isFetching) {
          handleLoadMore();
        }
      },
      { rootMargin: LOAD_MORE_THRESHOLD },
    );

    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasMore, isFetching, handleLoadMore]);

  const resetAndSetWindow = (value: string) => {
    setWindow(value as "1d" | "7d" | "30d");
    setOffset(0);
    setItems([]);
    setStableHasMore(false);
    prevOffset.current = 0;
  };

  const resetAndSetDirection = (value: string) => {
    setDirection(value as "all" | "buy" | "sell");
    setOffset(0);
    setItems([]);
    setStableHasMore(false);
    prevOffset.current = 0;
  };

  const title = useMemo(() => {
    if (window === "1d") return "Today";
    if (window === "7d") return "Last 7 days";
    return "Last 30 days";
  }, [window]);

  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="font-medium text-red-500">Failed to load discover feed</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs value={window} onValueChange={resetAndSetWindow}>
              <TabsList>
                <TabsTrigger value="1d">1d</TabsTrigger>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={direction} onValueChange={resetAndSetDirection}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="buy">Net Buy</TabsTrigger>
                <TabsTrigger value="sell">Net Sale</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ranked signals for {title.toLowerCase()}, scored by trade size, ΔOwn,
          role, clustering, and recency.
        </p>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No discover signals found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-[9%] px-2 py-1 font-medium">Date</th>
                <th className="w-[7%] px-2 py-1 font-medium">Company</th>
                <th className="w-[18%] px-2 py-1 font-medium">Insider</th>
                <th className="w-[9%] px-2 py-1 font-medium">Type</th>
                <th className="w-[9%] px-2 py-1 font-medium text-right">
                  Price
                </th>
                <th className="w-[10%] px-2 py-1 font-medium text-right">
                  Qty
                </th>
                <th className="w-[9%] px-2 py-1 font-medium text-right">
                  Owned
                </th>
                <th className="w-[7%] px-2 py-1 font-medium text-right">
                  ΔOwn
                </th>
                <th className="w-[9%] px-2 py-1 font-medium text-right">
                  Value
                </th>
                <th className="w-[6%] px-2 py-1 font-medium text-right">
                  Score
                </th>
                <th className="w-[17%] px-2 py-1 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const color = getRowColor(item);
                return (
                  <tr
                    key={`${item.filingId}-${item.score}`}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                      <Link
                        href={`/filing/${item.accessionNumber}`}
                        prefetch={false}
                        className="hover:text-foreground hover:underline"
                      >
                        {formatDate(item.filedAt)}
                      </Link>
                    </td>
                    <td className="overflow-hidden px-2 py-1">
                      <Link
                        href={`/company/${item.company.cik}`}
                        prefetch={false}
                        className="block truncate font-medium hover:underline"
                      >
                        {item.company.ticker || item.company.name}
                      </Link>
                    </td>
                    <td className="overflow-hidden px-2 py-1">
                      <span className="block truncate">
                        {item.insider.name}
                        {item.insider.title ? ` · ${item.insider.title}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <TypeBadge type={item.metrics.transactionType} />
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-1 text-right font-mono",
                        color,
                      )}
                    >
                      {formatCurrency(item.metrics.avgPricePerShare)}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-1 text-right font-mono",
                        color,
                      )}
                    >
                      {formatSigned(item.metrics.netShares)}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-1 text-right font-mono",
                        color,
                      )}
                    >
                      {formatNumber(item.metrics.ownedAfter)}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-1 text-right font-mono",
                        color,
                      )}
                    >
                      {formatPercent(item.metrics.deltaOwnPct)}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-1 text-right font-mono",
                        color,
                      )}
                    >
                      {formatCompactCurrency(item.metrics.tradeValue)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right font-mono text-foreground">
                      {item.score.toFixed(1)}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        {item.reasons.slice(0, 3).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div ref={loaderRef} className="h-12 flex items-center justify-center">
        {isFetching && items.length > 0 ? (
          <Spinner size="sm" />
        ) : items.length > 0 && data && !hasMore ? (
          <span className="text-xs text-muted-foreground">
            Showing all {data.pagination.totalCount.toLocaleString()} signals
          </span>
        ) : null}
      </div>
    </div>
  );
}
