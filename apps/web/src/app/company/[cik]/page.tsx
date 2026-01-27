"use client";

import { FilingCard } from "@/components/filings/filing-card";
import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";

export default function CompanyPage() {
  const params = useParams<{ cik: string }>();
  const cik = params?.cik ?? "";
  const { data, isLoading, isError } = trpc.companies.getByCik.useQuery(
    { cik, limit: 50 },
    { enabled: Boolean(cik) },
  );

  if (!cik || isLoading) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-muted-foreground">Loading company…</p>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-red-500 font-medium">Company not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground">Company</div>
        <h1 className="text-2xl font-semibold">
          {data.company.name}
          {data.company.ticker && (
            <span className="ml-2 text-sm text-muted-foreground font-mono">
              {data.company.ticker}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">CIK {data.company.cik}</p>
      </header>

      <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent filings</h2>
          {data.filings.length === 0 ? (
            <p className="text-muted-foreground">No filings found.</p>
          ) : (
            <div>
              {data.filings.map((filing) => (
                <FilingCard key={filing.id} filing={filing} />
              ))}
            </div>
          )}
        </div>
        <aside className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Insider roster
          </h3>
          {data.roster.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No insiders recorded yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              {data.roster.map((insider) => (
                <div key={insider.id} className="flex items-start justify-between gap-3">
                  <div>
                    {insider.cik ? (
                      <a
                        href={`/insider/${insider.cik}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {insider.name}
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">
                        {insider.name}
                      </span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {insider.title || "Insider"}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground text-right">
                    {getRoleTags(insider)
                      .map((tag) => (
                        <div key={tag}>{tag}</div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold">Activity over time</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Form 4 filings per month (last 12 months)
        </p>
        <div className="mt-4">
          <MonthlyChart filings={data.filings} />
        </div>
      </section>
      </div>
    </main>
  );
}

function getRoleTags(insider: {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  title?: string | null;
}): string[] {
  const tags: string[] = [];
  if (insider.isDirector) tags.push("Director");
  if (insider.isOfficer) tags.push("Officer");
  if (insider.isTenPercentOwner) tags.push("10% Owner");
  const title = insider.title?.toLowerCase() ?? "";
  return tags.filter((tag) => !title.includes(tag.toLowerCase()));
}

function MonthlyChart({ filings }: { filings: Array<{ filedAt: Date }> }) {
  const buckets = new Map<string, number>();
  for (const filing of filings) {
    const date = new Date(filing.filedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = Array.from({ length: 12 }, (_, index) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (11 - index), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
    }).format(d);
    const year = d.getFullYear();
    return { key, label, year, date: d };
  });

  const counts = months.map((m) => buckets.get(m.key) ?? 0);
  const max = Math.max(...counts, 1);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const thisMonth = counts[counts.length - 1] ?? 0;
  const lastMonth = counts[counts.length - 2] ?? 0;
  const delta = thisMonth - lastMonth;

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>
          Total last 12 months:{" "}
          <span className="font-mono text-foreground">{total.toLocaleString()}</span>
        </span>
        <span>
          This month:{" "}
          <span className="font-mono text-foreground">{thisMonth.toLocaleString()}</span>
        </span>
        <span>
          vs last month:{" "}
          <span className={`font-mono ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toLocaleString()}
          </span>
        </span>
        <span className="text-muted-foreground/70">
          Based on last {filings.length} filings loaded
        </span>
      </div>

      <div className="grid grid-cols-[40px_1fr] gap-4">
        <div className="flex h-36 flex-col justify-between text-[11px] text-muted-foreground">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>

        <div className="relative h-36">
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-border/60" />
            <div className="border-t border-border/40" />
            <div className="border-t border-border/60" />
          </div>

          <div className="absolute inset-0 flex items-end gap-2">
            {months.map((month, index) => {
              const count = counts[index] ?? 0;
              const height = Math.max(4, (count / max) * 100);
              const isCurrent = index === months.length - 1;
              return (
                <div key={month.key} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={`w-full max-w-[22px] rounded-md transition-colors ${
                      isCurrent ? "bg-foreground" : "bg-foreground/70"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground shadow-sm group-hover:block">
                    <span className="font-medium">{month.label}</span>
                    <span className="text-muted-foreground"> · {count.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 text-[11px] text-muted-foreground">
        {months.map((month, index) => (
          <div key={month.key} className="text-center">
            {index % 2 === 0 ? month.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
