import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FilingCard, type FilingCardProps } from "./filing-card";

const PAGE_SIZE = 50;

type Filing = FilingCardProps["filing"];

export function ActivityFeed() {
  const [allFilings, setAllFilings] = useState<Filing[]>([]);
  const [offset, setOffset] = useState(0);
  const prevOffset = useRef(0);
  const [hasMore, setHasMore] = useState(true);

  const { data, isLoading, isError, error, isFetching } =
    trpc.filings.getRecentFilings.useQuery(
      {
        limit: PAGE_SIZE,
        offset,
      },
      {
        placeholderData: keepPreviousData,
        refetchInterval: offset === 0 ? 60000 : false,
        staleTime: 30000,
      },
    );

  // Accumulate filings when data changes
  useEffect(() => {
    if (data) {
      if (offset === 0) {
        setAllFilings(data.filings);
      } else if (offset !== prevOffset.current) {
        setAllFilings((prev) => [...prev, ...data.filings]);
      }
      prevOffset.current = offset;
      if (typeof data.hasMore === "boolean") {
        setHasMore(data.hasMore);
      }
    }
  }, [data, offset]);

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

  return (
    <div>
      <AnimatePresence initial={false}>
        {allFilings.map((filing, index) => (
          <motion.div
            key={filing.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, delay: index < 6 ? index * 0.03 : 0 }}
          >
            <FilingCard filing={filing} />
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="py-4 text-center min-h-[44px]">
        {hasMore ? (
          <button
            onClick={handleLoadMore}
            disabled={isFetching}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {isFetching ? "Loading..." : "Load more"}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">No more filings</span>
        )}
      </div>
    </div>
  );
}
