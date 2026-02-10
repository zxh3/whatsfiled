"use client";

import { Spinner } from "@whatsfiled/ui/components/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@whatsfiled/ui/components/tooltip";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";

const TRANSACTION_CODE_DESCRIPTIONS: Record<string, string> = {
  P: "Open market or private purchase",
  S: "Open market or private sale",
  A: "Grant or award",
  M: "Exercise or conversion of derivative",
  G: "Gift",
  F: "Payment of exercise price or tax with securities",
  D: "Sale or transfer to issuer",
  C: "Conversion of derivative security",
  W: "Acquisition or disposition by will or inheritance",
  J: "Other acquisition or disposition",
  K: "Equity swap or similar instrument",
  U: "Disposition due to tender of shares",
};

function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString();
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toISOString().split("T")[0];
}

function sumNumber(values: Array<number | string | null | undefined>): number {
  let sum = 0;
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const num = typeof value === "string" ? Number(value) : value;
    if (!Number.isNaN(num)) sum += num;
  }
  return sum;
}

function resolveValue(params: {
  totalValue?: number | string | null;
  shares?: number | string | null;
  price?: number | string | null;
}): number {
  const total = params.totalValue;
  if (total !== null && total !== undefined) {
    const num = typeof total === "string" ? Number(total) : total;
    if (!Number.isNaN(num)) return num;
  }
  const shares = params.shares;
  const price = params.price;
  const sharesNum =
    shares === null || shares === undefined ? null : Number(shares);
  const priceNum = price === null || price === undefined ? null : Number(price);
  if (
    sharesNum !== null &&
    priceNum !== null &&
    !Number.isNaN(sharesNum) &&
    !Number.isNaN(priceNum)
  ) {
    return sharesNum * priceNum;
  }
  return 0;
}

export function FilingPageClient() {
  const params = useParams();
  const accessionNumber = params.accessionNumber as string;

  const { data, isLoading, isError } =
    trpc.filings.getByAccessionNumber.useQuery(
      { accessionNumber },
      { enabled: Boolean(accessionNumber) },
    );

  if (!accessionNumber || isLoading) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="space-y-6">
            <header>
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-7 w-64 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-4 w-32 animate-pulse rounded bg-muted" />
            </header>
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-red-500 font-medium">Filing not found</p>
        </div>
      </main>
    );
  }

  const filing = data;
  const primaryOwner = filing.owners[0]?.insider;
  const company = filing.company;

  // Create footnote lookup for tooltips
  const footnoteMap = new Map(
    filing.footnotes.map((f) => [f.footnoteId, f.content]),
  );
  const nonDerivativeBuys = filing.transactions.filter(
    (txn) => txn.acquiredDisposed === "A",
  );
  const nonDerivativeSells = filing.transactions.filter(
    (txn) => txn.acquiredDisposed === "D",
  );
  const totalBuyShares = sumNumber(nonDerivativeBuys.map((t) => t.shares));
  const totalSellShares = sumNumber(nonDerivativeSells.map((t) => t.shares));
  const totalBuyValue = sumNumber(
    nonDerivativeBuys.map((t) =>
      resolveValue({
        totalValue: t.totalValue,
        shares: t.shares,
        price: t.pricePerShare,
      }),
    ),
  );
  const totalSellValue = sumNumber(
    nonDerivativeSells.map((t) =>
      resolveValue({
        totalValue: t.totalValue,
        shares: t.shares,
        price: t.pricePerShare,
      }),
    ),
  );
  const netShares = totalBuyShares - totalSellShares;

  const sharesOwnedAfter =
    filing.transactions
      .map((t) => (t.sharesOwnedAfter ? Number(t.sharesOwnedAfter) : null))
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a)[0] ??
    filing.holdings
      .map((h) => (h.sharesOwned ? Number(h.sharesOwned) : null))
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a)[0] ??
    null;

  const sharesOwnedBefore =
    sharesOwnedAfter !== null ? sharesOwnedAfter - netShares : null;

  return (
    <TooltipProvider delayDuration={100}>
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-3 py-6 space-y-6 sm:px-4 sm:py-8 sm:space-y-8">
          <header className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Form {filing.formType}
            </div>
            <h1 className="text-2xl font-semibold">
              <Link
                href={`/company/${company.cik}`}
                className="hover:underline"
              >
                {company.name}
              </Link>
            </h1>
            <div className="text-sm text-muted-foreground">
              {primaryOwner ? (
                <>
                  <span className="font-medium text-foreground/80">
                    {primaryOwner.name}
                  </span>
                  {filing.owners[0]?.officerTitle && (
                    <span className="ml-1.5">
                      · {filing.owners[0].officerTitle}
                    </span>
                  )}
                </>
              ) : (
                "Insider filing"
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Filed {new Date(filing.filedAt).toISOString().split("T")[0]}
            </div>
            {filing.documentUrl && (
              <a
                href={filing.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                SEC filing
              </a>
            )}
          </header>

          <section className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-lg border border-border p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                Total buy
              </div>
              <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold">
                {formatNumber(totalBuyShares)}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {formatCurrency(totalBuyValue)}
              </div>
            </div>
            <div className="rounded-lg border border-border p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                Total sell
              </div>
              <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold">
                {formatNumber(totalSellShares)}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {formatCurrency(totalSellValue)}
              </div>
            </div>
            <div className="rounded-lg border border-border p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                Net change
              </div>
              <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold">
                {netShares >= 0 ? "+" : "-"}
                {formatNumber(Math.abs(netShares))}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground truncate">
                {sharesOwnedBefore !== null && sharesOwnedAfter !== null
                  ? `${formatNumber(sharesOwnedBefore)} → ${formatNumber(sharesOwnedAfter)}`
                  : "—"}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Non-derivative transactions
            </h2>
            {filing.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transactions listed.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Code</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Shares</th>
                      <th className="py-2 pr-2">Price</th>
                      <th className="py-2 pr-2">Value</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filing.transactions.map((txn) => (
                      <tr key={txn.id} className="border-b border-border/60">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatDate(txn.transactionDate)}
                        </td>
                        <td className="py-2 pr-2">
                          {txn.transactionCode ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="underline decoration-dotted cursor-help"
                                >
                                  {txn.transactionCode}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {TRANSACTION_CODE_DESCRIPTIONS[
                                  txn.transactionCode
                                ] || txn.transactionCode}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {txn.acquiredDisposed === "A"
                            ? "Buy"
                            : txn.acquiredDisposed === "D"
                              ? "Sell"
                              : "—"}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatNumber(txn.shares)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatCurrency(txn.pricePerShare)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatCurrency(
                            resolveValue({
                              totalValue: txn.totalValue,
                              shares: txn.shares,
                              price: txn.pricePerShare,
                            }),
                          )}
                        </td>
                        <td className="py-2">
                          {txn.footnoteIds && txn.footnoteIds.length > 0 ? (
                            <span className="flex flex-wrap gap-1">
                              {txn.footnoteIds.map((id) => (
                                <Tooltip key={id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted cursor-help"
                                    >
                                      {id}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-left">
                                    {footnoteMap.get(id) ||
                                      "Footnote not found"}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Non-derivative holdings</h2>
            {filing.holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No holdings listed.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2">Security</th>
                      <th className="py-2 pr-2">Owned</th>
                      <th className="py-2 pr-2">Ownership</th>
                      <th className="py-2 pr-2">Nature</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filing.holdings.map((holding) => (
                      <tr
                        key={holding.id}
                        className="border-b border-border/60"
                      >
                        <td className="py-2 pr-2">{holding.securityTitle}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatNumber(holding.sharesOwned)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {holding.ownershipType === "D"
                            ? "Direct"
                            : holding.ownershipType === "I"
                              ? "Indirect"
                              : "—"}
                        </td>
                        <td className="py-2 pr-2">
                          {holding.indirectNature || "—"}
                        </td>
                        <td className="py-2">
                          {holding.footnoteIds &&
                          holding.footnoteIds.length > 0 ? (
                            <span className="flex flex-wrap gap-1">
                              {holding.footnoteIds.map((id) => (
                                <Tooltip key={id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted cursor-help"
                                    >
                                      {id}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-left">
                                    {footnoteMap.get(id) ||
                                      "Footnote not found"}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Derivative transactions</h2>
            {filing.derivativeTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No derivative transactions listed.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Code</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Underlying</th>
                      <th className="py-2 pr-2">Shares</th>
                      <th className="py-2 pr-2">Price</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filing.derivativeTransactions.map((txn) => (
                      <tr key={txn.id} className="border-b border-border/60">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatDate(txn.transactionDate)}
                        </td>
                        <td className="py-2 pr-2">
                          {txn.transactionCode ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="underline decoration-dotted cursor-help"
                                >
                                  {txn.transactionCode}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {TRANSACTION_CODE_DESCRIPTIONS[
                                  txn.transactionCode
                                ] || txn.transactionCode}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {txn.acquiredDisposed === "A"
                            ? "Buy"
                            : txn.acquiredDisposed === "D"
                              ? "Sell"
                              : "—"}
                        </td>
                        <td className="py-2 pr-2 max-w-[120px] truncate">
                          {txn.underlyingSecurityTitle || "—"}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatNumber(txn.underlyingShares)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatCurrency(txn.pricePerShare)}
                        </td>
                        <td className="py-2">
                          {txn.footnoteIds && txn.footnoteIds.length > 0 ? (
                            <span className="flex flex-wrap gap-1">
                              {txn.footnoteIds.map((id) => (
                                <Tooltip key={id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted cursor-help"
                                    >
                                      {id}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-left">
                                    {footnoteMap.get(id) ||
                                      "Footnote not found"}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Footnotes</h2>
            {filing.footnotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No footnotes.</p>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                {filing.footnotes.map((note) => (
                  <p key={note.id}>
                    <span className="font-medium text-foreground/80">
                      {note.footnoteId}.
                    </span>{" "}
                    {note.content}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
