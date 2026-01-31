"use client";

import { Spinner } from "@whatsfiled/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@whatsfiled/ui/components/tabs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 50;
const LOAD_MORE_THRESHOLD = "200px"; // Start loading when within 200px of bottom

type Transaction = {
  id: string;
  transactionDate: string | null;
  transactionCode: string | null;
  shares: number | null;
  pricePerShare: number | null;
  acquiredDisposed: "A" | "D" | null;
  sharesOwnedAfter: number | null;
  securityTitle: string;
  company: {
    id: string;
    name: string;
    cik: string;
    ticker: string | null;
  };
  insider: {
    id: string;
    name: string;
    cik: string | null;
    title: string;
  };
  filing: {
    accessionNumber: string;
    filedAt: Date;
  };
};

export function ActivityFeed() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<"common" | "options">("common");
  const [offset, setOffset] = useState(0);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
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

  // Generic feed query (when not signed in or no watchlist)
  const genericQuery = trpc.filings.getRecentTransactions.useQuery(
    { filter, limit: PAGE_SIZE, offset },
    { enabled: !useWatchlistFeed, staleTime: 30000 },
  );

  // Watchlist feed query (when signed in with watchlist)
  const watchlistQuery = trpc.watchlist.getWatchlistFeed.useQuery(
    { filter, limit: PAGE_SIZE, offset },
    { enabled: useWatchlistFeed, staleTime: 30000 },
  );

  // Select the active query based on user state
  const activeQuery = useWatchlistFeed ? watchlistQuery : genericQuery;
  const { data, isLoading, isError, error, isFetching } = activeQuery;

  const hasMore = data?.pagination.hasMore ?? false;
  const currentSource = useWatchlistFeed ? "watchlist" : "generic";

  // Accumulate transactions when new data arrives
  useEffect(() => {
    if (data?.transactions) {
      // Reset if source changed (signed in/out or watchlist emptied)
      if (currentSource !== prevSource.current) {
        setAllTransactions(data.transactions);
        prevOffset.current = offset;
        prevSource.current = currentSource;
        return;
      }

      if (offset === 0) {
        // Reset on filter change or initial load
        setAllTransactions(data.transactions);
      } else if (offset > prevOffset.current) {
        // Append on load more, dedupe by ID to handle edge cases
        setAllTransactions((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTransactions = data.transactions.filter(
            (t) => !existingIds.has(t.id),
          );
          return [...prev, ...newTransactions];
        });
      }
      prevOffset.current = offset;
    }
  }, [data, offset, currentSource]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter as "common" | "options");
    setOffset(0);
    setAllTransactions([]);
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
        <p className="font-medium text-red-500">Failed to load transactions</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={handleFilterChange}>
            <TabsList>
              <TabsTrigger value="common">Market Trades</TabsTrigger>
              <TabsTrigger value="options">Awards & Exercises</TabsTrigger>
            </TabsList>
          </Tabs>
          <Link
            href="/coverage"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View data coverage →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {useWatchlistFeed ? (
            <>
              Showing activity from your{" "}
              <span className="font-medium">
                {watchlistData?.length} watched{" "}
                {watchlistData?.length === 1 ? "company" : "companies"}
              </span>
              .{" "}
              {filter === "common"
                ? "Open market purchases and sales."
                : "Option exercises, RSU vests, awards, and tax withholding."}
            </>
          ) : filter === "common" ? (
            "Open market purchases and sales — discretionary trades that may signal insider sentiment."
          ) : (
            "Stock received from option exercises, RSU vests, awards, and tax withholding — routine compensation events."
          )}
        </p>
      </div>

      {/* Empty watchlist prompt */}
      {session && !watchlistLoading && !hasWatchlist && !isLoading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Watch companies to personalize your feed. Visit any company page and
            click the star icon to add it to your watchlist.
          </p>
        </div>
      )}

      <TransactionTable
        transactions={allTransactions}
        isLoading={isLoading && allTransactions.length === 0}
        showCompany
        filterable
      />

      {/* Sentinel element for infinite scroll */}
      <div ref={loaderRef} className="h-12 flex items-center justify-center">
        {isFetching && allTransactions.length > 0 ? (
          <Spinner size="sm" />
        ) : allTransactions.length > 0 && data && !hasMore ? (
          <span className="text-xs text-muted-foreground">
            Showing all {data.pagination.totalCount.toLocaleString()}{" "}
            transactions
          </span>
        ) : null}
      </div>
    </div>
  );
}
