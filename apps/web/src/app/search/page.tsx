"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { trpc } from "@/lib/trpc";
import { useSearchParams } from "next/navigation";

export default function SearchPage() {
  const params = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const { data, isLoading } = trpc.search.search.useQuery(
    { query, limit: 12 },
    { enabled: query.length > 0 },
  );

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Search</h1>
          {query ? (
            <p className="text-sm text-muted-foreground">
              Results for “{query}”
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a company, ticker, or insider name.
            </p>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Searching…</p>
        )}

        {!isLoading && query && data && (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Companies
              </h2>
              {data.companies.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No companies found.
                </p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  {data.companies.map((company) => (
                    <a
                      key={company.id}
                      href={`/company/${company.cik}`}
                      className="block rounded-md border border-border px-3 py-2 hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {company.ticker ? (
                              <span className="font-mono">
                                {company.ticker}
                              </span>
                            ) : (
                              company.name
                            )}
                          </div>
                          {company.ticker && (
                            <div className="text-xs text-muted-foreground">
                              {company.name}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          CIK {company.cik}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Insiders
              </h2>
              {data.insiders.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No insiders found.
                </p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  {data.insiders.map((insider) => (
                    <a
                      key={insider.id}
                      href={`/insider/${insider.cik}`}
                      className="block rounded-md border border-border px-3 py-2 hover:bg-muted/40"
                    >
                      <div className="font-medium text-foreground">
                        {insider.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        CIK {insider.cik ?? "—"}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
