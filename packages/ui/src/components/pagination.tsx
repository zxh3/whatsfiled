import { Button } from "@base-ui/react/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  if (current <= 3) {
    // Near start: 1 2 3 4 5 ... last
    pages.push(2, 3, 4, 5, "...", total);
  } else if (current >= total - 2) {
    // Near end: 1 ... n-4 n-3 n-2 n-1 n
    pages.push("...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    // Middle: 1 ... c-1 c c+1 ... last
    pages.push("...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      <Button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground"
          >
            ...
          </span>
        ) : (
          <Button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
              p === page
                ? "bg-foreground text-background"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        ),
      )}

      <Button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

export { Pagination };
export type { PaginationProps };
