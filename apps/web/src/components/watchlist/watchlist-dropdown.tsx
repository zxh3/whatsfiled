"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@whatsfiled/ui/components/dropdown-menu";
import { Spinner } from "@whatsfiled/ui/components/spinner";
import { Star } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export function WatchlistDropdown() {
  const { data: session } = useSession();
  const { data: watchlist, isLoading } = trpc.watchlist.list.useQuery(
    undefined,
    { enabled: !!session },
  );

  // Don't render if not logged in
  if (!session) {
    return null;
  }

  const hasItems = watchlist && watchlist.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/20"
        aria-label="Watchlist"
      >
        <Star
          className={`h-4 w-4 ${hasItems ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
        {hasItems && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
            {watchlist.length > 9 ? "9+" : watchlist.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Watchlist
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : !hasItems ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No companies watched yet.
            <br />
            <span className="text-[10px]">
              Visit a company page and click the star to add.
            </span>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {watchlist.map((item) => (
              <DropdownMenuItem key={item.id} className="p-0">
                <Link
                  href={`/company/${item.company.cik}`}
                  className="flex w-full items-center justify-between px-2 py-1"
                >
                  <span className="truncate font-medium">
                    {item.company.ticker || item.company.name}
                  </span>
                  {item.company.ticker && (
                    <span className="ml-2 max-w-24 truncate text-xs text-muted-foreground">
                      {item.company.name}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
