import { trpc } from "@/lib/trpc";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export function SiteHeader() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data } = trpc.search.search.useQuery(
    { query, limit: 6 },
    { enabled: query.trim().length >= 2 },
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate({ to: "/search", search: { q: trimmed } });
    setIsFocused(false);
  };

  const items = useMemo(() => {
    if (!data || query.trim().length < 2) {
      return [];
    }

    const companyItems = data.companies.map((company) => ({
      key: `company:${company.id}:${company.ticker ?? company.cik}`,
      href: `/company/${company.cik}`,
      label: company.ticker ? company.ticker : company.name,
      subtitle: company.ticker ? company.name : undefined,
    }));

    const insiderItems = data.insiders.map((insider) => ({
      key: `insider:${insider.id}:${insider.cik ?? "unknown"}`,
      href: `/insider/${insider.cik}`,
      label: insider.name,
      subtitle: insider.cik ? `CIK ${insider.cik}` : undefined,
    }));

    return [...companyItems, ...insiderItems];
  }, [data, query]);

  useEffect(() => {
    if (!isFocused || items.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex(0);
  }, [items.length, isFocused]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFocused || items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      return;
    }

    if (event.key === "Enter") {
      const selected = items[selectedIndex];
      if (selected) {
        event.preventDefault();
        navigate({ to: selected.href });
        setIsFocused(false);
      }
    }
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
              onKeyDown={handleKeyDown}
              placeholder="Search companies, tickers, insiders"
              className="w-full rounded-l-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <button
              type="submit"
              className="rounded-r-md border border-l-0 border-border bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Search
            </button>
            <AnimatePresence>
              {isFocused && query.trim().length >= 2 && data && (
                <motion.div
                  key="search-dropdown"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full z-20 mt-2 w-full rounded-md border border-border bg-background p-2 text-sm shadow-lg"
                >
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
                            {data.companies.map((company) => {
                              const itemKey = `company:${company.id}:${company.ticker ?? company.cik}`;
                              const itemIndex = items.findIndex((item) => item.key === itemKey);
                              const isSelected = itemIndex === selectedIndex;
                              return (
                                <a
                                  key={`${company.id}:${company.ticker ?? company.cik}`}
                                  href={`/company/${company.cik}`}
                                  className={`block rounded-md px-2 py-1 hover:bg-muted/40 ${
                                    isSelected ? "bg-muted/60" : ""
                                  }`}
                                  onMouseEnter={() => {
                                    if (itemIndex >= 0) setSelectedIndex(itemIndex);
                                  }}
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
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {data.insiders.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Insiders
                          </div>
                          <div className="mt-1 space-y-1">
                            {data.insiders.map((insider) => {
                              const itemKey = `insider:${insider.id}:${insider.cik ?? "unknown"}`;
                              const itemIndex = items.findIndex((item) => item.key === itemKey);
                              const isSelected = itemIndex === selectedIndex;
                              return (
                                <a
                                  key={`${insider.id}:${insider.cik ?? "unknown"}`}
                                  href={`/insider/${insider.cik}`}
                                  className={`block rounded-md px-2 py-1 hover:bg-muted/40 ${
                                    isSelected ? "bg-muted/60" : ""
                                  }`}
                                  onMouseEnter={() => {
                                    if (itemIndex >= 0) setSelectedIndex(itemIndex);
                                  }}
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
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
