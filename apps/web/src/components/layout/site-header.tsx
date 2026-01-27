"use client";

import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const { data } = trpc.search.search.useQuery(
    { query, limit: 6 },
    { enabled: query.trim().length >= 2 },
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setIsFocused(false);
  };

  useEffect(() => {
    if (!isFocused) return;
    if (!query.trim()) return;
  }, [isFocused, query]);

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a href="/" className="text-2xl font-bold hover:opacity-80">
            WhatsFiled
          </a>
          <p className="text-sm text-muted-foreground mt-1">
            Recent insider trading activity
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <form onSubmit={handleSubmit} className="relative flex">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              placeholder="Search companies, tickers, insiders"
              className="w-full rounded-l-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <button
              type="submit"
              className="rounded-r-md border border-l-0 border-border bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Search
            </button>
            {isFocused && query.trim().length >= 2 && data && (
              <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-md border border-border bg-background p-2 text-sm shadow-lg">
                {data.companies.length === 0 && data.insiders.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No matches found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.companies.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Companies
                        </div>
                        <div className="mt-1 space-y-1">
                          {data.companies.map((company) => (
                            <a
                              key={company.id}
                              href={`/company/${company.cik}`}
                              className="block rounded-md px-2 py-1 hover:bg-muted/40"
                            >
                              <span className="font-medium text-foreground">
                                {company.ticker ? (
                                  <span className="font-mono">
                                    {company.ticker}
                                  </span>
                                ) : (
                                  company.name
                                )}
                              </span>
                              {company.ticker && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {company.name}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.insiders.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Insiders
                        </div>
                        <div className="mt-1 space-y-1">
                          {data.insiders.map((insider) => (
                            <a
                              key={insider.id}
                              href={`/insider/${insider.cik}`}
                              className="block rounded-md px-2 py-1 hover:bg-muted/40"
                            >
                              <span className="font-medium text-foreground">
                                {insider.name}
                              </span>
                              {insider.cik && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  CIK {insider.cik}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
          <div className="text-xs text-muted-foreground">
            <a href="/sync" className="hover:text-foreground">
              Sync status
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
