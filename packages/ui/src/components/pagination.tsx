import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

/* -----------------------------------------------------------------------------
 * Primitive Components (shadcn-style)
 * -------------------------------------------------------------------------- */

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1.5", className)}
      {...props}
    />
  );
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("flex items-center", className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  disabled?: boolean;
} & React.ComponentProps<"button">;

function PaginationLink({
  className,
  isActive,
  disabled,
  ...props
}: PaginationLinkProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md text-sm font-medium leading-none transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Go to previous page"
      aria-disabled={disabled}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium leading-none transition-colors",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      <ChevronLeft className="size-4" />
      <span>Previous</span>
    </button>
  );
}

function PaginationNext({
  className,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Go to next page"
      aria-disabled={disabled}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium leading-none transition-colors",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      <span>Next</span>
      <ChevronRight className="size-4" />
    </button>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 items-center justify-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

/* -----------------------------------------------------------------------------
 * Composed Pagination Component
 * -------------------------------------------------------------------------- */

interface PaginationNavProps {
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

function PaginationNav({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationNavProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
        </PaginationItem>

        {pages.map((p, idx) => (
          <PaginationItem key={p === "..." ? `ellipsis-${idx}` : p}>
            {p === "..." ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                isActive={p === page}
                onClick={() => onPageChange(p)}
              >
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNav,
  PaginationNext,
  PaginationPrevious,
};
export type { PaginationNavProps };
