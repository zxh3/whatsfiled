import { TransactionTable } from "@/components/transactions/transaction-table";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger } from "@whatsfiled/ui/components/tabs";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 50;

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
  const [filter, setFilter] = useState<"common" | "options">("common");
  const [offset, setOffset] = useState(0);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const prevOffset = useRef(0);

  const { data, isLoading, isError, error, isFetching } =
    trpc.filings.getRecentTransactions.useQuery(
      { filter, limit: PAGE_SIZE, offset },
      { staleTime: 30000 },
    );

  // Accumulate transactions when new data arrives
  useEffect(() => {
    if (data?.transactions) {
      if (offset === 0) {
        // Reset on filter change or initial load
        setAllTransactions(data.transactions);
      } else if (offset > prevOffset.current) {
        // Append on load more
        setAllTransactions((prev) => [...prev, ...data.transactions]);
      }
      prevOffset.current = offset;
    }
  }, [data, offset]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter as "common" | "options");
    setOffset(0);
    setAllTransactions([]);
    prevOffset.current = 0;
  };

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
  };

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
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="common">Market Trades</TabsTrigger>
            <TabsTrigger value="options">Awards & Exercises</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          {filter === "common"
            ? "Open market purchases and sales — discretionary trades that may signal insider sentiment."
            : "Stock received from option exercises, RSU vests, awards, and tax withholding — routine compensation events."}
        </p>
      </div>

      <TransactionTable
        transactions={allTransactions}
        isLoading={isLoading && allTransactions.length === 0}
        showCompany
      />

      {data && (
        <div className="py-4 text-center">
          {data.pagination.hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={isFetching}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {isFetching ? "Loading..." : "Load more"}
            </button>
          ) : allTransactions.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              Showing {allTransactions.length} of{" "}
              {data.pagination.totalCount.toLocaleString()} transactions
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
