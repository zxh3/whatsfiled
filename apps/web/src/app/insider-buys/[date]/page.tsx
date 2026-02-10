import { Button } from "@whatsfiled/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import {
  getEasternDateString,
  getTopInsiderBuysByDate,
  isValidIsoDate,
} from "@/lib/insider-buys";

type Props = {
  params: Promise<{ date: string }>;
};

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPrice(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShares(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const todayEastern = getEasternDateString();

  if (!isValidIsoDate(date) || date > todayEastern) {
    return {
      title: "Top Insider Buys",
      description:
        "Daily open-market insider buy activity from SEC Form 4 filings.",
    };
  }

  const data = await getTopInsiderBuysByDate(date);
  const prettyDate = formatDate(date);

  const title = `Top Insider Buys - ${prettyDate}`;
  const description =
    data.rowCount > 0
      ? `${data.rowCount} notable insider buy clusters on ${prettyDate}, totaling ${formatCurrency(data.totalEstimatedValue)} from SEC Form 4 filings.`
      : `No notable open-market insider buys found for ${prettyDate} from SEC Form 4 filings.`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsfiled.com";

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/insider-buys/${date}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/insider-buys/${date}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function InsiderBuysDatePage({ params }: Props) {
  const { date } = await params;
  const todayEastern = getEasternDateString();

  if (!isValidIsoDate(date) || date > todayEastern) {
    notFound();
  }

  const data = await getTopInsiderBuysByDate(date);

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Daily Leaderboard
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Top Insider Buys - {formatDate(date)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Open-market purchases (transaction code P) from SEC Form 4 filings,
            ranked by estimated dollar value.
          </p>
          {data.rowCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {data.rowCount} entries totaling{" "}
              {formatCurrency(data.totalEstimatedValue)}.
            </p>
          )}
        </header>

        <section className="mt-5 rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">
            Get the next list by email
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a watchlist and get daily insider trade alerts for companies
            you care about.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/sign-in">
              <Button size="sm">Create free alerts</Button>
            </Link>
            <Link href="/insider-buys/today">
              <Button size="sm" variant="outline">
                Go to today
              </Button>
            </Link>
          </div>
        </section>

        {data.rows.length === 0 ? (
          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-medium">No notable buys</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No open-market insider purchases above $50,000 were found for this
              date.
            </p>
          </section>
        ) : (
          <section className="mt-6">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[840px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Insider</th>
                    <th className="px-3 py-2 font-medium text-right">Shares</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Avg Price
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Est. Value
                    </th>
                    <th className="px-3 py-2 font-medium">Filing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="px-3 py-3 align-top">
                        <Link
                          href={`/company/${row.company.cik}`}
                          className="font-medium hover:underline"
                        >
                          {row.company.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.company.ticker ?? "-"} · CIK {row.company.cik}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{row.insider.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.insider.title}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-top font-mono">
                        {formatShares(row.shares)}
                      </td>
                      <td className="px-3 py-3 text-right align-top font-mono">
                        {formatPrice(row.averagePrice)}
                      </td>
                      <td className="px-3 py-3 text-right align-top font-mono font-medium">
                        {formatCurrency(row.estimatedValue)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Link
                          href={`/filing/${row.filing.accessionNumber}`}
                          className="hover:underline"
                        >
                          {row.filing.accessionNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.filingCount > 1
                            ? `${row.filingCount} filings`
                            : "1 filing"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-lg border p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Methodology
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Includes only Form 4 Table I open-market purchases (transaction code
            P) with acquired shares. Rows are deduplicated by insider and
            company for the date, then ranked by estimated value (shares ×
            price). Entries below $50,000 are excluded.
          </p>
        </section>
      </div>
    </main>
  );
}
