import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";

export interface FilingCardProps {
  filing: {
    id: string;
    accessionNumber: string;
    formType: string;
    filedAt: Date;
    periodOfReport: string | null;
    isAmendment: boolean;
    documentUrl: string | null;
    company: {
      id: string;
      name: string;
      cik: string;
      ticker: string | null;
    };
    owners: Array<{
      id: string;
      name: string;
      cik: string | null;
      title: string;
    }>;
    summary: {
      transactionType: "buy" | "sell" | "mixed" | "none";
      totalAcquired: number;
      totalDisposed: number;
      totalAcquiredValue: number;
      totalDisposedValue: number;
      avgPrice: number;
      sharesOwnedAfter: number;
      ownershipChangePercent: number | null;
    };
    transactions: Array<{
      transactionDate: Date | string | null;
      transactionCode: string | null;
      acquiredDisposed: "A" | "D" | null;
      shares: number | null;
      pricePerShare: number | null;
    }> | null;
  };
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatCurrency(num: number): string {
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(1)}K`;
  }
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(num: number | null): string {
  if (num === null) return "—";
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

export function FilingCard({ filing }: FilingCardProps) {
  const { company, owners, summary } = filing;
  const primaryOwner = owners[0];

  const isBuy = summary.transactionType === "buy";
  const isSell = summary.transactionType === "sell";
  const isMixed = summary.transactionType === "mixed";

  const shares = isBuy
    ? summary.totalAcquired
    : isSell
      ? summary.totalDisposed
      : Math.max(summary.totalAcquired, summary.totalDisposed);

  const value = isBuy
    ? summary.totalAcquiredValue
    : isSell
      ? summary.totalDisposedValue
      : Math.max(summary.totalAcquiredValue, summary.totalDisposedValue);

  const mixedTransactions =
    summary.transactionType === "mixed" ? filing.transactions : null;
  const isNotable = value >= 1_000_000 || shares >= 100_000;

  return (
    <div className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Company and Insider Info */}
        <div className="min-w-0 flex-1">
          {/* Company */}
          <div className="flex items-center gap-2">
            <Link
              href={`/company/${company.cik}`}
              className="font-semibold text-foreground hover:underline"
            >
              {company.ticker ? (
                <span className="font-mono">{company.ticker}</span>
              ) : (
                company.name
              )}
            </Link>
            {company.ticker && (
              <span className="text-sm text-muted-foreground truncate">
                {company.name}
              </span>
            )}
            {isNotable && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Notable
              </span>
            )}
          </div>

          {/* Insider */}
          {primaryOwner && (
            <div className="mt-1 text-sm text-muted-foreground">
              {primaryOwner.cik ? (
                <Link
                  href={`/insider/${primaryOwner.cik}`}
                  className="font-medium text-foreground/80 hover:underline"
                >
                  {primaryOwner.name}
                </Link>
              ) : (
                <span className="font-medium text-foreground/80">
                  {primaryOwner.name}
                </span>
              )}
              {primaryOwner.title && (
                <span className="ml-1.5 text-muted-foreground">
                  · {primaryOwner.title}
                </span>
              )}
            </div>
          )}

          {/* Transaction Details */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {/* Buy/Sell Badge */}
            {summary.transactionType !== "none" && (
              <span
                className={
                  isMixed
                    ? "relative inline-flex items-center group"
                    : undefined
                }
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                    isBuy
                      ? "bg-green-100 text-green-800"
                      : isSell
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {isBuy ? "Buy" : isSell ? "Sell" : "Mixed"}
                  {isMixed &&
                    mixedTransactions &&
                    mixedTransactions.length > 0 && (
                      <span className="sr-only">
                        Hover for transaction details
                      </span>
                    )}
                </span>

                {isMixed &&
                  mixedTransactions &&
                  mixedTransactions.length > 0 && (
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-56 rounded-md border border-border bg-background p-2 text-xs text-foreground shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="block text-[11px] font-medium text-muted-foreground">
                        Transactions
                      </span>
                      <div className="mt-1 max-h-40 overflow-auto space-y-1">
                        {mixedTransactions.map((txn, idx) => {
                          const date = txn.transactionDate
                            ? format(new Date(txn.transactionDate), "MMM d")
                            : "—";
                          const side =
                            txn.acquiredDisposed === "A"
                              ? "Buy"
                              : txn.acquiredDisposed === "D"
                                ? "Sell"
                                : "—";
                          const sharesText =
                            txn.shares !== null
                              ? formatNumber(txn.shares)
                              : "—";
                          const priceText =
                            txn.pricePerShare !== null
                              ? `$${txn.pricePerShare.toFixed(2)}`
                              : "—";
                          const codeText = txn.transactionCode
                            ? `· ${txn.transactionCode}`
                            : "";
                          return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: transactions lack unique IDs
                            <span key={idx} className="block">
                              {date} · {side}
                              {codeText} · {sharesText} @ {priceText}
                            </span>
                          );
                        })}
                      </div>
                    </span>
                  )}
              </span>
            )}

            {/* Shares */}
            {shares > 0 && (
              <span className="text-foreground">
                <span className="font-mono font-medium">
                  {formatNumber(shares)}
                </span>{" "}
                <span className="text-muted-foreground">shares</span>
              </span>
            )}

            {/* Price */}
            {summary.avgPrice > 0 && (
              <span className="text-muted-foreground">
                @{" "}
                <span className="font-mono">
                  ${summary.avgPrice.toFixed(2)}
                </span>
              </span>
            )}

            {/* Value */}
            {value > 0 && (
              <span className="text-foreground font-medium">
                {formatCurrency(value)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Ownership Change and Time */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* Ownership Change */}
          {summary.ownershipChangePercent !== null && (
            <span
              className={`font-mono text-sm font-medium ${
                summary.ownershipChangePercent >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatPercent(summary.ownershipChangePercent)}
            </span>
          )}

          {/* Date (SEC Eastern Time) */}
          <span className="text-xs text-muted-foreground">
            {formatInTimeZone(
              new Date(filing.filedAt),
              "America/New_York",
              "MMM d, yyyy • h:mm a zzz",
            )}
          </span>

          <Link
            href={`/filing/${filing.accessionNumber}`}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Filing details
          </Link>

          {/* SEC Filing Link */}
          {filing.documentUrl && (
            <a
              href={filing.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              SEC Filing
            </a>
          )}

          {/* Amendment Badge */}
          {filing.isAmendment && (
            <span className="text-xs text-muted-foreground">Amended</span>
          )}
        </div>
      </div>
    </div>
  );
}
