import { Link } from "@tanstack/react-router";
import { cn } from "@whatsfiled/ui/lib/utils";
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

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TransactionTable({
  transactions,
  isLoading,
  showCompany,
  className,
}: TransactionTableProps) {
  if (isLoading) {
    return (
      <div className={cn("overflow-x-auto", className)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Date</th>
              {showCompany && (
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Company
                </th>
              )}
              <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                Insider
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                Shares
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                Price
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                Value
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                Owned
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                Filing
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </td>
                {showCompany && (
                  <td className="px-3 py-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted" />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="ml-auto h-4 w-18 animate-pulse rounded bg-muted" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2 font-medium">Date</th>
            {showCompany && (
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                Company
              </th>
            )}
            <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Insider</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
              Shares
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
              Price
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
              Value
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
              Owned
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Filing</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const value =
              txn.shares && txn.pricePerShare
                ? txn.shares * txn.pricePerShare
                : null;

            return (
              <tr
                key={txn.id}
                className="border-b border-border/50 hover:bg-muted/30"
              >
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatDate(txn.transactionDate)}
                </td>
                {showCompany && txn.company && (
                  <td className="px-3 py-2">
                    <Link
                      to="/company/$cik"
                      params={{ cik: txn.company.cik }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {txn.company.ticker || txn.company.name}
                    </Link>
                  </td>
                )}
                <td className="px-3 py-2">
                  <TransactionBadge code={txn.transactionCode} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    {txn.insider.cik ? (
                      <Link
                        to="/insider/$cik"
                        params={{ cik: txn.insider.cik }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {txn.insider.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        {txn.insider.name}
                      </span>
                    )}
                    {txn.insider.title && (
                      <span className="text-xs text-muted-foreground">
                        {txn.insider.title}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                  <span
                    className={
                      txn.acquiredDisposed === "A"
                        ? "text-green-600 dark:text-green-400"
                        : txn.acquiredDisposed === "D"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }
                  >
                    {txn.acquiredDisposed === "A"
                      ? "+"
                      : txn.acquiredDisposed === "D"
                        ? "-"
                        : ""}
                    {formatNumber(txn.shares)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground">
                  {formatCurrency(txn.pricePerShare)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground">
                  {formatCurrency(value)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground">
                  {formatNumber(txn.sharesOwnedAfter)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link
                    to="/filing/$accessionNumber"
                    params={{ accessionNumber: txn.filing.accessionNumber }}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {formatDate(txn.filing.filedAt)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { TransactionTable };
export type { Transaction, TransactionTableProps };
