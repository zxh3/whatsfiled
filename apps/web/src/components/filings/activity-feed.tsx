"use client";

import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { FilingCard } from "./filing-card";

const PAGE_SIZE = 50;

type Filing = NonNullable<
  ReturnType<typeof trpc.filings.getRecentFilings.useQuery>["data"]
>["filings"][number];

export function ActivityFeed() {
  const [allFilings, setAllFilings] = useState<Filing[]>([]);
  const [offset, setOffset] = useState(0);
  const [formType, setFormType] = useState<"4" | "4/A" | "all">("all");
  const prevOffset = useRef(0);

  const { data, isLoading, isError, error, isFetching } =
    trpc.filings.getRecentFilings.useQuery({
      limit: PAGE_SIZE,
      offset,
      formType: formType === "all" ? undefined : formType,
    });

  // Accumulate filings when data changes
  useEffect(() => {
    if (data) {
      if (offset === 0) {
        setAllFilings(data.filings);
      } else if (offset !== prevOffset.current) {
        setAllFilings((prev) => [...prev, ...data.filings]);
      }
      prevOffset.current = offset;
    }
  }, [data, offset]);

  useEffect(() => {
    setOffset(0);
    setAllFilings([]);
    prevOffset.current = 0;
  }, [formType]);

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
  };

  if (isLoading && offset === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-border py-4 animate-pulse">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
              </div>
              <div className="space-y-1">
                <div className="h-4 w-12 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-500 font-medium">Failed to load filings</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  if (!allFilings.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">No filings found</p>
      </div>
    );
  }

  const hasMore = data?.hasMore ?? false;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => setFormType("all")}
          className={`rounded-full px-3 py-1 ${
            formType === "all"
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFormType("4")}
          className={`rounded-full px-3 py-1 ${
            formType === "4"
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Form 4
        </button>
        <button
          onClick={() => setFormType("4/A")}
          className={`rounded-full px-3 py-1 ${
            formType === "4/A"
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Form 4/A
        </button>
      </div>
      {allFilings.map((filing) => (
        <FilingCard key={filing.id} filing={filing} />
      ))}

      {hasMore && (
        <div className="py-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isFetching}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {isFetching ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
