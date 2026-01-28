import { SiteHeader } from "@/components/layout/site-header";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { trpc } from "@/lib/trpc";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PaginationNav } from "@whatsfiled/ui/components/pagination";
import { Tabs, TabsList, TabsTrigger } from "@whatsfiled/ui/components/tabs";
import { z } from "zod";

const searchSchema = z.object({
  filter: z.enum(["common", "options"]).catch("common"),
  page: z.coerce.number().min(1).catch(1),
});

export const Route = createFileRoute("/company/$cik")({
  validateSearch: searchSchema,
  component: CompanyPage,
});

function CompanyPage() {
  const { cik } = Route.useParams();
  const { filter, page } = Route.useSearch();
  const navigate = useNavigate();

  const { data, isLoading, isError } = trpc.companies.getTransactions.useQuery(
    { cik, filter, page, pageSize: 25 },
    { enabled: Boolean(cik) },
  );

  const handleFilterChange = (newFilter: string) => {
    navigate({
      to: "/company/$cik",
      params: { cik },
      search: { filter: newFilter as "common" | "options", page: 1 },
      replace: true,
    });
  };

  const handlePageChange = (newPage: number) => {
    navigate({
      to: "/company/$cik",
      params: { cik },
      search: { filter, page: newPage },
      replace: true,
    });
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
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header>
          <div className="text-xs text-muted-foreground">Company</div>
          <h1 className="text-2xl font-semibold">
            {data.company.name}
            {data.company.ticker && (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                {data.company.ticker}
              </span>
            )}
          </h1>
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
            Showing {(page - 1) * 25 + 1}-
            {Math.min(page * 25, data.pagination.totalCount)} of{" "}
            {data.pagination.totalCount.toLocaleString()} transactions
          </p>
        )}
      </div>
    </main>
  );
}
