"use client";

import { PaginationNav } from "@whatsfiled/ui/components/pagination";
import { Tabs, TabsList, TabsTrigger } from "@whatsfiled/ui/components/tabs";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { WatchButton } from "@/components/watchlist/watch-button";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 25;

export function CompanyPageClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cik = params.cik as string;
  const filter =
    (searchParams.get("filter") as "common" | "options") || "common";
  const page = Number(searchParams.get("page")) || 1;

  const { data, isLoading, isError } = trpc.companies.getTransactions.useQuery(
    { cik, filter, page, pageSize: PAGE_SIZE },
    { enabled: Boolean(cik) },
  );

  const handleFilterChange = (newFilter: string) => {
    const params = new URLSearchParams();
    params.set("filter", newFilter);
    params.set("page", "1");
    router.replace(`/company/${cik}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("page", String(newPage));
    router.replace(`/company/${cik}?${params.toString()}`);
  };

  if (!cik || isLoading) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="space-y-6">
            <header>
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-7 w-64 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-4 w-32 animate-pulse rounded bg-muted" />
            </header>
            <div className="h-9 w-80 animate-pulse rounded-full bg-muted" />
            <TransactionTable transactions={[]} isLoading />
          </div>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="font-medium text-red-500">Company not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-3 py-6 space-y-4 sm:px-4 sm:py-8 sm:space-y-6">
        <header>
          <div className="text-xs text-muted-foreground">Company</div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {data.company.name}
              {data.company.ticker && (
                <span className="ml-2 font-mono text-sm text-muted-foreground">
                  {data.company.ticker}
                </span>
              )}
            </h1>
            <WatchButton companyId={data.company.id} />
          </div>
          <p className="text-sm text-muted-foreground">
            CIK {data.company.cik}
          </p>
        </header>

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
          transactions={data.transactions}
          isLoading={isLoading}
        />

        {data.pagination.totalPages > 1 && (
          <PaginationNav
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {data.pagination.totalCount > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, data.pagination.totalCount)} of{" "}
            {data.pagination.totalCount.toLocaleString()} transactions
          </p>
        )}
      </div>
    </main>
  );
}
