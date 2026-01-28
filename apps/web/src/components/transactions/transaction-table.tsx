import { cn } from "@whatsfiled/ui/lib/utils";
import Link from "next/link";
import { TransactionBadge } from "./transaction-badge";

interface Transaction {
  id: string;
  transactionDate: string | null;
  transactionCode: string | null;
  shares: number | null;
  pricePerShare: number | null;
  acquiredDisposed: "A" | "D" | null;
  sharesOwnedAfter: number | null;
  securityTitle: string;
  company?: {
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
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  showCompany?: boolean;
  className?: string;
}

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatCompactNumber(value: number | null): string {
  if (value === null) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactCurrency(value: number | null): string {
  if (value === null) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

function formatShortDate(date: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPercentChange(
  shares: number | null,
  sharesOwnedAfter: number | null,
  acquiredDisposed: "A" | "D" | null,
): string {
  if (shares === null || sharesOwnedAfter === null || !acquiredDisposed)
    return "-";

  // Calculate shares owned before the transaction
  const sharesOwnedBefore =
    acquiredDisposed === "A"
      ? sharesOwnedAfter - shares
      : sharesOwnedAfter + shares;

  if (sharesOwnedBefore === 0) {
    // New position
    return acquiredDisposed === "A" ? "New" : "-100%";
  }

  const pctChange = (shares / sharesOwnedBefore) * 100;

  if (pctChange >= 100) {
    return `${acquiredDisposed === "A" ? "+" : "-"}${Math.round(pctChange)}%`;
  }
  return `${acquiredDisposed === "A" ? "+" : "-"}${pctChange.toFixed(1)}%`;
}

// Mobile card component
function TransactionCard({
  txn,
  showCompany,
}: {
  txn: Transaction;
  showCompany?: boolean;
}) {
  const value =
    txn.shares && txn.pricePerShare ? txn.shares * txn.pricePerShare : null;

  const colorClass =
    txn.acquiredDisposed === "A"
      ? "text-green-600 dark:text-green-400"
      : txn.acquiredDisposed === "D"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <Link
      href={`/filing/${txn.filing.accessionNumber}`}
      prefetch={false}
      className="block rounded-lg border border-border p-3 hover:bg-muted/30 active:bg-muted/50"
    >
      {/* Header: Company/Insider | Badge | Date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showCompany && txn.company ? (
            <span className="font-semibold text-foreground truncate">
              {txn.company.ticker || txn.company.name}
            </span>
          ) : (
            <span className="font-semibold text-foreground truncate">
              {txn.insider.name}
            </span>
          )}
          <TransactionBadge code={txn.transactionCode} />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatShortDate(txn.transactionDate)}
        </span>
      </div>

      {/* Subheader: Insider name & role (when showing company) or just role */}
      <div className="mt-1 text-xs text-muted-foreground truncate">
        {showCompany ? (
          <>
            {txn.insider.name} · {txn.insider.title}
          </>
        ) : (
          txn.insider.title
        )}
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-border/50" />

      {/* Main row: Shares @ Price | % Change */}
      <div className="flex items-center justify-between text-sm">
        <div className="font-mono">
          <span className={colorClass}>
            {txn.acquiredDisposed === "A" ? "+" : txn.acquiredDisposed === "D" ? "-" : ""}
            {formatCompactNumber(txn.shares)}
          </span>
          {txn.pricePerShare && (
            <span className="text-muted-foreground">
              {" "}@ {formatCurrency(txn.pricePerShare)}
            </span>
          )}
        </div>
        <span className={cn("font-mono font-medium", colorClass)}>
          {formatPercentChange(txn.shares, txn.sharesOwnedAfter, txn.acquiredDisposed)}
        </span>
      </div>

      {/* Footer: Value | Owned */}
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className={colorClass}>{formatCompactCurrency(value)}</span> value
        </span>
        <span>{formatCompactNumber(txn.sharesOwnedAfter)} owned</span>
      </div>
    </Link>
  );
}

// Mobile loading skeleton
function MobileLoadingSkeleton() {
  return (
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
        <div key={i} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="my-2 border-t border-border/50" />
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Desktop loading skeleton
function DesktopLoadingSkeleton({ showCompany }: { showCompany?: boolean }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-[9%] whitespace-nowrap px-2 py-1 font-medium">Date</th>
            {showCompany && (
              <th className="w-[6%] whitespace-nowrap px-2 py-1 font-medium">Company</th>
            )}
            <th className={cn("whitespace-nowrap px-2 py-1 font-medium", showCompany ? "w-[15%]" : "w-[18%]")}>
              Insider
            </th>
            <th className={cn("whitespace-nowrap px-2 py-1 font-medium", showCompany ? "w-[13%]" : "w-[16%]")}>
              Role
            </th>
            <th className="w-[7%] whitespace-nowrap px-2 py-1 font-medium">Type</th>
            <th className="w-[9%] whitespace-nowrap px-2 py-1 font-medium text-right">Price</th>
            <th className="w-[10%] whitespace-nowrap px-2 py-1 font-medium text-right">Owned</th>
            <th className="w-[10%] whitespace-nowrap px-2 py-1 font-medium text-right">Shares</th>
            <th className="w-[8%] whitespace-nowrap px-2 py-1 font-medium text-right">Chg</th>
            <th className="w-[9%] whitespace-nowrap px-2 py-1 font-medium text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
            <tr key={i} className="border-b border-border/50">
              <td className="px-2 py-1">
                <div className="h-4 w-full max-w-16 animate-pulse rounded bg-muted" />
              </td>
              {showCompany && (
                <td className="px-2 py-1">
                  <div className="h-4 w-full max-w-12 animate-pulse rounded bg-muted" />
                </td>
              )}
              <td className="px-2 py-1">
                <div className="h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-2 py-1">
                <div className="h-4 w-full max-w-24 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-2 py-1">
                <div className="h-5 w-full max-w-14 animate-pulse rounded-full bg-muted" />
              </td>
              <td className="px-2 py-1 text-right">
                <div className="ml-auto h-4 w-full max-w-14 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-2 py-1 text-right">
                <div className="ml-auto h-4 w-full max-w-14 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-2 py-1 text-right">
                <div className="ml-auto h-4 w-full max-w-14 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-2 py-1 text-right">
                <div className="ml-auto h-4 w-full max-w-10 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-2 py-1 text-right">
                <div className="ml-auto h-4 w-full max-w-12 animate-pulse rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Desktop table component
function DesktopTable({
  transactions,
  showCompany,
}: {
  transactions: Transaction[];
  showCompany?: boolean;
}) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-[9%] whitespace-nowrap px-2 py-1 font-medium">Date</th>
            {showCompany && (
              <th className="w-[6%] whitespace-nowrap px-2 py-1 font-medium">Company</th>
            )}
            <th className={cn("whitespace-nowrap px-2 py-1 font-medium", showCompany ? "w-[15%]" : "w-[18%]")}>
              Insider
            </th>
            <th className={cn("whitespace-nowrap px-2 py-1 font-medium", showCompany ? "w-[13%]" : "w-[16%]")}>
              Role
            </th>
            <th className="w-[7%] whitespace-nowrap px-2 py-1 font-medium">Type</th>
            <th className="w-[9%] whitespace-nowrap px-2 py-1 font-medium text-right">Price</th>
            <th className="w-[10%] whitespace-nowrap px-2 py-1 font-medium text-right">Owned</th>
            <th className="w-[10%] whitespace-nowrap px-2 py-1 font-medium text-right">Shares</th>
            <th className="w-[8%] whitespace-nowrap px-2 py-1 font-medium text-right">Chg</th>
            <th className="w-[9%] whitespace-nowrap px-2 py-1 font-medium text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const value =
              txn.shares && txn.pricePerShare ? txn.shares * txn.pricePerShare : null;

            return (
              <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="whitespace-nowrap px-2 py-1">
                  <Link
                    href={`/filing/${txn.filing.accessionNumber}`}
                    prefetch={false}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {formatDate(txn.transactionDate)}
                  </Link>
                </td>
                {showCompany && txn.company && (
                  <td className="overflow-hidden px-2 py-1" title={txn.company.ticker || txn.company.name}>
                    <Link
                      href={`/company/${txn.company.cik}`}
                      prefetch={false}
                      className="block truncate font-medium text-foreground hover:underline"
                    >
                      {txn.company.ticker || txn.company.name}
                    </Link>
                  </td>
                )}
                <td className="overflow-hidden px-2 py-1" title={txn.insider.name}>
                  {txn.insider.cik ? (
                    <Link
                      href={`/insider/${txn.insider.cik}`}
                      prefetch={false}
                      className="block truncate font-medium text-foreground hover:underline"
                    >
                      {txn.insider.name}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium text-foreground">
                      {txn.insider.name}
                    </span>
                  )}
                </td>
                <td className="overflow-hidden px-2 py-1 text-muted-foreground" title={txn.insider.title}>
                  <span className="block truncate">{txn.insider.title}</span>
                </td>
                <td className="px-2 py-1">
                  <TransactionBadge code={txn.transactionCode} />
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right font-mono text-muted-foreground">
                  {formatCurrency(txn.pricePerShare)}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right font-mono text-muted-foreground">
                  {formatNumber(txn.sharesOwnedAfter)}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right font-mono">
                  <span
                    className={
                      txn.acquiredDisposed === "A"
                        ? "text-green-600 dark:text-green-400"
                        : txn.acquiredDisposed === "D"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }
                  >
                    {txn.acquiredDisposed === "A" ? "+" : txn.acquiredDisposed === "D" ? "-" : ""}
                    {formatNumber(txn.shares)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right font-mono">
                  <span
                    className={
                      txn.acquiredDisposed === "A"
                        ? "text-green-600 dark:text-green-400"
                        : txn.acquiredDisposed === "D"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    }
                  >
                    {formatPercentChange(txn.shares, txn.sharesOwnedAfter, txn.acquiredDisposed)}
                  </span>
                </td>
                <td
                  className="whitespace-nowrap px-2 py-1 text-right font-mono"
                  title={value ? formatCurrency(value) : undefined}
                >
                  <span
                    className={
                      txn.acquiredDisposed === "A"
                        ? "text-green-600 dark:text-green-400"
                        : txn.acquiredDisposed === "D"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }
                  >
                    {formatCompactCurrency(value)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TransactionTable({
  transactions,
  isLoading,
  showCompany,
  className,
}: TransactionTableProps) {
  if (isLoading) {
    return (
      <div className={className}>
        <MobileLoadingSkeleton />
        <DesktopLoadingSkeleton showCompany={showCompany} />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={cn("py-12 text-center text-muted-foreground", className)}>
        No transactions found.
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Mobile: Card layout */}
      <div className="space-y-2 md:hidden">
        {transactions.map((txn) => (
          <TransactionCard key={txn.id} txn={txn} showCompany={showCompany} />
        ))}
      </div>

      {/* Desktop: Table layout */}
      <DesktopTable transactions={transactions} showCompany={showCompany} />
    </div>
  );
}

export { TransactionTable };
export type { Transaction, TransactionTableProps };
