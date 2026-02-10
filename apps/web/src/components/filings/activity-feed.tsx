"use client";

import { Spinner } from "@whatsfiled/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@whatsfiled/ui/components/tabs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscoverFeed } from "@/components/discover/discover-feed";
import { FilingSummaryTable } from "@/components/filings/filing-summary-table";
import { WatchlistCompanyFilter } from "@/components/watchlist/watchlist-company-filter";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 50;
const LOAD_MORE_THRESHOLD = "200px"; // Start loading when within 200px of bottom
const FEED_COMPANY_FILTER_STORAGE_KEY = "whatsfiled:feed:company-filter-ciks";

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

export function ActivityFeed() {
  const { data: session } = useSession();
  const [view, setView] = useState<"feed" | "discover">("feed");
  const [filter, setFilter] = useState<"common" | "options">("common");
  const [directionFilter, setDirectionFilter] = useState<
    "all" | "buy" | "sell"
  >("all");
  const [discoverWindow, setDiscoverWindow] = useState<"1d" | "7d" | "30d">(
    "7d",
  );
  const [discoverDirection, setDiscoverDirection] = useState<
    "all" | "buy" | "sell"
  >("all");
  const [offset, setOffset] = useState(0);
  const [allFilings, setAllFilings] = useState<FilingSummary[]>([]);
  const [stableHasMore, setStableHasMore] = useState(false);
  const prevOffset = useRef(0);
  const prevSource = useRef<"generic" | "watchlist">("generic");
  const loaderRef = useRef<HTMLDivElement>(null);

  // Check if user has a watchlist (only when signed in)
  const { data: watchlistData, isLoading: watchlistLoading } =
    trpc.watchlist.list.useQuery(undefined, {
      enabled: !!session,
    });

  const hasWatchlist = (watchlistData?.length ?? 0) > 0;
  const useWatchlistFeed = !!session && hasWatchlist;
  const watchedCompanies = useMemo(
    () =>
      useWatchlistFeed
        ? (watchlistData?.map((item) => item.company) ?? [])
        : [],
    [useWatchlistFeed, watchlistData],
  );
  const watchedCompanyCiks = useMemo(
    () => watchedCompanies.map((company) => company.cik),
    [watchedCompanies],
  );
  const watchedCompanyIdByCik = useMemo(
    () => new Map(watchedCompanies.map((company) => [company.cik, company.id])),
    [watchedCompanies],
  );
  const [selectedCompanyCiks, setSelectedCompanyCiks] = useState<
    string[] | null
  >(null);

  useEffect(() => {
    if (!useWatchlistFeed) {
      setSelectedCompanyCiks(null);
      return;
    }

    const raw = window.localStorage.getItem(FEED_COMPANY_FILTER_STORAGE_KEY);
    if (!raw) {
      setSelectedCompanyCiks(watchedCompanyCiks);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setSelectedCompanyCiks(watchedCompanyCiks);
      return;
    }

    if (!Array.isArray(parsed)) {
      setSelectedCompanyCiks(watchedCompanyCiks);
      return;
    }

    const parsedCiks = parsed.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (parsedCiks.length === 0) {
      setSelectedCompanyCiks([]);
      return;
    }

    const allowed = new Set(watchedCompanyCiks);
    const filtered = Array.from(
      new Set(
        parsedCiks
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0 && allowed.has(entry)),
      ),
    );

    if (filtered.length === 0) {
      setSelectedCompanyCiks(watchedCompanyCiks);
      return;
    }

    const ordered = watchedCompanyCiks.filter((cik) => filtered.includes(cik));
    setSelectedCompanyCiks(ordered);
  }, [useWatchlistFeed, watchedCompanyCiks]);

  const effectiveSelectedCiks = useMemo(() => {
    if (!useWatchlistFeed) return [];
    return selectedCompanyCiks ?? watchedCompanyCiks;
  }, [useWatchlistFeed, selectedCompanyCiks, watchedCompanyCiks]);

  const selectedCompanyIds = useMemo(() => {
    if (!useWatchlistFeed) return undefined;
    return effectiveSelectedCiks
      .map((cik) => watchedCompanyIdByCik.get(cik))
      .filter((id): id is string => !!id);
  }, [effectiveSelectedCiks, useWatchlistFeed, watchedCompanyIdByCik]);
  const selectedCompanyIdsKey = useMemo(
    () => (selectedCompanyIds ? selectedCompanyIds.join(",") : ""),
    [selectedCompanyIds],
  );

  useEffect(() => {
    if (!useWatchlistFeed || selectedCompanyCiks === null) return;
    window.localStorage.setItem(
      FEED_COMPANY_FILTER_STORAGE_KEY,
      JSON.stringify(selectedCompanyCiks),
    );
  }, [selectedCompanyCiks, useWatchlistFeed]);

  useEffect(() => {
    // Reset pagination whenever the selected company set changes.
    void selectedCompanyIdsKey;
    setOffset(0);
    setAllFilings([]);
    setStableHasMore(false);
    prevOffset.current = 0;
  }, [selectedCompanyIdsKey]);

  const { data, isLoading, isError, error, isFetching } =
    trpc.filings.getRecentFeedFilings.useQuery(
      {
        filter,
        limit: PAGE_SIZE,
        offset,
        companyIds: selectedCompanyIds,
      },
      { staleTime: 30000 },
    );

  const hasMore = data?.pagination.hasMore ?? stableHasMore;
  const currentSource = useWatchlistFeed ? "watchlist" : "generic";
  const filteredFilings = useMemo(() => {
    if (directionFilter === "buy") {
      return allFilings.filter((filing) => filing.summary.netShares > 0);
    }
    if (directionFilter === "sell") {
      return allFilings.filter((filing) => filing.summary.netShares < 0);
    }
    return allFilings;
  }, [allFilings, directionFilter]);

  // Accumulate filings when new data arrives
  useEffect(() => {
    if (data?.filings) {
      setStableHasMore(data.pagination.hasMore);
      // Reset if source changed (signed in/out or watchlist emptied)
      if (currentSource !== prevSource.current) {
        setAllFilings(data.filings);
        prevOffset.current = offset;
        prevSource.current = currentSource;
        return;
      }

      if (offset === 0) {
        // Reset on filter change or initial load
        setAllFilings(data.filings);
      } else if (offset > prevOffset.current) {
        // Append on load more, dedupe by ID to handle edge cases
        setAllFilings((prev) => {
          const existingIds = new Set(prev.map((f) => f.id));
          const newFilings = data.filings.filter((f) => !existingIds.has(f.id));
          return [...prev, ...newFilings];
        });
      }
      prevOffset.current = offset;
    }
  }, [data, offset, currentSource]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter as "common" | "options");
    setOffset(0);
    setAllFilings([]);
    setStableHasMore(false);
    prevOffset.current = 0;
  };

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  // Infinite scroll: load more when sentinel comes into view
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

  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="font-medium text-red-500">Failed to load filings</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as "feed" | "discover")}
            >
              <TabsList>
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="discover">Discover</TabsTrigger>
              </TabsList>
            </Tabs>

            {view === "feed" && (
              <Tabs value={filter} onValueChange={handleFilterChange}>
                <TabsList>
                  <TabsTrigger value="common">Market Trades</TabsTrigger>
                  <TabsTrigger value="options">Awards & Exercises</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {view === "feed" && (
              <Tabs
                value={directionFilter}
                onValueChange={(value) =>
                  setDirectionFilter(value as "all" | "buy" | "sell")
                }
              >
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="buy">Net Buy</TabsTrigger>
                  <TabsTrigger value="sell">Net Sale</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {view === "discover" && (
              <Tabs
                value={discoverWindow}
                onValueChange={(value) =>
                  setDiscoverWindow(value as "1d" | "7d" | "30d")
                }
              >
                <TabsList>
                  <TabsTrigger value="1d">1d</TabsTrigger>
                  <TabsTrigger value="7d">7d</TabsTrigger>
                  <TabsTrigger value="30d">30d</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {view === "discover" && (
              <Tabs
                value={discoverDirection}
                onValueChange={(value) =>
                  setDiscoverDirection(value as "all" | "buy" | "sell")
                }
              >
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="buy">Net Buy</TabsTrigger>
                  <TabsTrigger value="sell">Net Sale</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {view === "feed" &&
              useWatchlistFeed &&
              watchedCompanies.length > 0 && (
                <WatchlistCompanyFilter
                  companies={watchedCompanies}
                  selectedCiks={effectiveSelectedCiks}
                  onChange={setSelectedCompanyCiks}
                />
              )}
          </div>
          <Link
            href="/coverage"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View data coverage →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {view === "discover" ? (
            "Ranked discover signals from the full market."
          ) : useWatchlistFeed ? (
            <>
              Showing activity from your{" "}
              <span className="font-medium">
                {watchlistData?.length} watched{" "}
                {watchlistData?.length === 1 ? "company" : "companies"}
              </span>
              .{" "}
              {filter === "common"
                ? "One row per filing with open market purchase/sale summary."
                : "One row per filing with awards/exercises summary."}
              {directionFilter === "buy"
                ? " Showing only net positive share changes."
                : directionFilter === "sell"
                  ? " Showing only net negative share changes."
                  : ""}
            </>
          ) : filter === "common" ? (
            `One row per filing summarizing open market purchases and sales.${
              directionFilter === "buy"
                ? " Showing only net positive share changes."
                : directionFilter === "sell"
                  ? " Showing only net negative share changes."
                  : ""
            }`
          ) : (
            `One row per filing summarizing option exercises, RSU vests, awards, and tax withholding.${
              directionFilter === "buy"
                ? " Showing only net positive share changes."
                : directionFilter === "sell"
                  ? " Showing only net negative share changes."
                  : ""
            }`
          )}
        </p>
      </div>

      {view === "discover" ? (
        <DiscoverFeed window={discoverWindow} direction={discoverDirection} />
      ) : (
        <>
          {/* Empty watchlist prompt */}
          {session && !watchlistLoading && !hasWatchlist && !isLoading && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Watch companies to personalize your feed. Visit any company page
                and click the star icon to add it to your watchlist.
              </p>
            </div>
          )}

          <FilingSummaryTable
            filings={filteredFilings}
            isLoading={isLoading && allFilings.length === 0}
          />

          {/* Sentinel element for infinite scroll */}
          <div
            ref={loaderRef}
            className="h-12 flex items-center justify-center"
          >
            {allFilings.length > 0 && hasMore ? (
              <Spinner size="sm" />
            ) : allFilings.length > 0 && data && !hasMore ? (
              <span className="text-xs text-muted-foreground">
                Showing all {data.pagination.totalCount.toLocaleString()}{" "}
                filings
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
