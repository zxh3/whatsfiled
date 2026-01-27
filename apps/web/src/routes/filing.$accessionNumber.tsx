import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";
import { createFileRoute } from "@tanstack/react-router";
import { formatInTimeZone } from "date-fns-tz";

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
  return formatInTimeZone(new Date(value), "America/New_York", "MMM d, yyyy");
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

export const Route = createFileRoute("/filing/$accessionNumber")({
  component: FilingPage,
});

function FilingPage() {
  const { accessionNumber } = Route.useParams();
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
          <p className="text-muted-foreground">Loading filing…</p>
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
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Form {filing.formType}
          </div>
          <h1 className="text-2xl font-semibold">
            <a href={`/company/${company.cik}`} className="hover:underline">
              {company.name}
            </a>
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
            Filed{" "}
            {formatInTimeZone(
              new Date(filing.filedAt),
              "America/New_York",
              "MMM d, yyyy • h:mm a zzz",
            )}
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="text-xs text-muted-foreground">Total buy</div>
            <div className="mt-2 text-lg font-semibold">
              {formatNumber(totalBuyShares)} shares
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(totalBuyValue)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-xs text-muted-foreground">Total sell</div>
            <div className="mt-2 text-lg font-semibold">
              {formatNumber(totalSellShares)} shares
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(totalSellValue)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-xs text-muted-foreground">Net change</div>
            <div className="mt-2 text-lg font-semibold">
              {netShares >= 0 ? "+" : "-"}
              {formatNumber(Math.abs(netShares))} shares
            </div>
            <div className="text-sm text-muted-foreground">
              {sharesOwnedBefore !== null && sharesOwnedAfter !== null
                ? `${formatNumber(sharesOwnedBefore)} → ${formatNumber(sharesOwnedAfter)}`
                : "Ownership data unavailable"}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Non-derivative transactions</h2>
          {filing.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions listed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2">Date</th>
                    <th className="py-2">Code</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Shares</th>
                    <th className="py-2">Price</th>
                    <th className="py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filing.transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-border/60">
                      <td className="py-2">
                        {formatDate(txn.transactionDate)}
                      </td>
                      <td className="py-2">{txn.transactionCode || "—"}</td>
                      <td className="py-2">
                        {txn.acquiredDisposed === "A"
                          ? "Buy"
                          : txn.acquiredDisposed === "D"
                            ? "Sell"
                            : "—"}
                      </td>
                      <td className="py-2">{formatNumber(txn.shares)}</td>
                      <td className="py-2">
                        {formatCurrency(txn.pricePerShare)}
                      </td>
                      <td className="py-2">
                        {formatCurrency(
                          resolveValue({
                            totalValue: txn.totalValue,
                            shares: txn.shares,
                            price: txn.pricePerShare,
                          }),
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2">Date</th>
                    <th className="py-2">Code</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Underlying</th>
                    <th className="py-2">Shares</th>
                    <th className="py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {filing.derivativeTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-border/60">
                      <td className="py-2">
                        {formatDate(txn.transactionDate)}
                      </td>
                      <td className="py-2">{txn.transactionCode || "—"}</td>
                      <td className="py-2">
                        {txn.acquiredDisposed === "A"
                          ? "Buy"
                          : txn.acquiredDisposed === "D"
                            ? "Sell"
                            : "—"}
                      </td>
                      <td className="py-2">
                        {txn.underlyingSecurityTitle || "—"}
                      </td>
                      <td className="py-2">
                        {formatNumber(txn.underlyingShares)}
                      </td>
                      <td className="py-2">
                        {formatCurrency(txn.pricePerShare)}
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
  );
}
