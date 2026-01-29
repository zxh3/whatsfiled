"use client";

import { Button } from "@whatsfiled/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@whatsfiled/ui/components/dropdown-menu";
import { Kbd, KbdGroup } from "@whatsfiled/ui/components/kbd";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  FileText,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { WatchlistDropdown } from "@/components/watchlist/watchlist-dropdown";
import { useTheme } from "@/hooks/use-theme";
import { trpc } from "@/lib/trpc";

export function SiteHeader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { resolvedTheme, setTheme, mounted } = useTheme();
  const { data: isAdmin } = trpc.auth.isAdmin.useQuery();

  // Detect OS for keyboard shortcut display
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      // Also support Escape to blur
      if (event.key === "Escape" && isFocused) {
        inputRef.current?.blur();
        setIsFocused(false);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isFocused]);

  const clearSearch = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

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
        router.push(selected.href);
        setIsFocused(false);
      }
    }
  };

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight hover:opacity-80"
        >
          <Image
            src="/logo.png"
            alt="WhatsFiled logo"
            width={24}
            height={24}
            quality={100}
            priority
            className="rounded"
          />
          <span className="hidden sm:inline">WhatsFiled</span>
        </Link>

        {/* Search */}
        <form
          onSubmit={handleSubmit}
          className="relative min-w-0 flex-1 sm:max-w-md"
        >
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="h-9 w-full rounded-md border border-border bg-muted/40 py-2 pl-9 pr-10 text-base text-foreground transition-colors placeholder:text-muted-foreground/70 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 sm:pr-20 sm:text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <KbdGroup className="pointer-events-none absolute right-3 hidden select-none sm:inline-flex">
                <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            )}
          </div>
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
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                    No matches found for "{query}"
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.companies.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          Companies
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {data.companies.map((company) => {
                            const itemKey = `company:${company.id}:${company.ticker ?? company.cik}`;
                            const itemIndex = items.findIndex(
                              (item) => item.key === itemKey,
                            );
                            const isSelected = itemIndex === selectedIndex;
                            return (
                              <Link
                                key={`${company.id}:${company.ticker ?? company.cik}`}
                                href={`/company/${company.cik}`}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 ${
                                  isSelected ? "bg-muted/70" : ""
                                }`}
                                onMouseEnter={() => {
                                  if (itemIndex >= 0)
                                    setSelectedIndex(itemIndex);
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
                                  <span className="truncate text-xs text-muted-foreground">
                                    {company.name}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {data.insiders.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <User className="h-3 w-3" />
                          Insiders
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {data.insiders.map((insider) => {
                            const itemKey = `insider:${insider.id}:${insider.cik ?? "unknown"}`;
                            const itemIndex = items.findIndex(
                              (item) => item.key === itemKey,
                            );
                            const isSelected = itemIndex === selectedIndex;
                            return (
                              <Link
                                key={`${insider.id}:${insider.cik ?? "unknown"}`}
                                href={`/insider/${insider.cik}`}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 ${
                                  isSelected ? "bg-muted/70" : ""
                                }`}
                                onMouseEnter={() => {
                                  if (itemIndex >= 0)
                                    setSelectedIndex(itemIndex);
                                }}
                              >
                                <span className="font-medium text-foreground">
                                  {insider.name}
                                </span>
                                {insider.cik && (
                                  <span className="text-xs text-muted-foreground">
                                    CIK {insider.cik}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Keyboard navigation hint - hidden on mobile */}
                    <div className="hidden border-t border-border pt-2 text-[10px] text-muted-foreground sm:block">
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <KbdGroup size="sm">
                            <Kbd size="sm">↑</Kbd>
                            <Kbd size="sm">↓</Kbd>
                          </KbdGroup>
                          <span>navigate</span>
                        </span>
                        <span className="text-border">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Kbd size="sm">↵</Kbd>
                          <span>select</span>
                        </span>
                        <span className="text-border">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Kbd size="sm">esc</Kbd>
                          <span>close</span>
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Right side: Watchlist + Menu + User */}
        <div className="flex items-center gap-2">
          <WatchlistDropdown />
          {/* Render placeholder during SSR to avoid hydration mismatch with Base UI's generated IDs */}
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  render={<Link href="/resources/sec-filings" />}
                >
                  <FileText className="h-4 w-4" />
                  SEC Filings Reference
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <Shield className="h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon-sm" aria-label="Menu" disabled>
              <Menu className="h-4 w-4" />
            </Button>
          )}

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
