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
