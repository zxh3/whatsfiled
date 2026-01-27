"use client";

import { FilingCard } from "@/components/filings/filing-card";
import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";

export default function InsiderPage() {
  const params = useParams<{ cik: string }>();
  const cik = params?.cik ?? "";
  const { data, isLoading, isError } = trpc.insiders.getByCik.useQuery(
    { cik, limit: 50 },
    { enabled: Boolean(cik) },
  );

  if (!cik || isLoading) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-muted-foreground">Loading insider…</p>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-red-500 font-medium">Insider not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground">Insider</div>
        <h1 className="text-2xl font-semibold">{data.insider.name}</h1>
        <p className="text-sm text-muted-foreground">CIK {data.insider.cik}</p>
      </header>

      <section className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Company affiliations
          </h3>
          {data.affiliations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No company roles recorded yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              {data.affiliations.map((company) => (
                <div key={company.id} className="flex items-start justify-between gap-3">
                  <div>
                    <a
                      href={`/company/${company.cik}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {company.ticker ? (
                        <span className="font-mono">{company.ticker}</span>
                      ) : (
                        company.name
                      )}
                    </a>
                    {company.ticker && (
                      <div className="text-xs text-muted-foreground">
                        {company.name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {company.title || "Insider"}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground text-right">
                    {getRoleTags(company)
                      .map((tag) => (
                        <div key={tag}>{tag}</div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
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
      </section>
      </div>
    </main>
  );
}

function getRoleTags(company: {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  title?: string | null;
}): string[] {
  const tags: string[] = [];
  if (company.isDirector) tags.push("Director");
  if (company.isOfficer) tags.push("Officer");
  if (company.isTenPercentOwner) tags.push("10% Owner");
  const title = company.title?.toLowerCase() ?? "";
  return tags.filter((tag) => !title.includes(tag.toLowerCase()));
}
