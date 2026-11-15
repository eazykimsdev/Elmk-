import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  page?: number;
  currentPage?: number;
  total?: number;
  totalItems?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  syncUrl?: boolean;
  smoothScroll?: boolean;
}

/**
 * Standard ConnectingERLC Pagination Component (Round 4):
 * - Always visible, even with a single page (shows page 1, chevrons disabled).
 * - Number buttons only: 1 2 3 … 12.
 * - 36px square buttons (size-9), radius 10px (rounded-[10px]).
 * - Active page: raised background (#141417), white text (#F4F4F5), 1px border.
 * - Inactive: text #71717A, hover #19191D, text #F4F4F5.
 * - Guarded against NaN: safely handles undefined/null totals.
 * - Syncs ?page=X in the query string and smoothly scrolls to top on change.
 */
export function Pagination({
  page,
  currentPage,
  total,
  totalItems,
  pageSize = 12,
  onPageChange,
  syncUrl = true,
  smoothScroll = true,
  className,
  ...props
}: PaginationProps) {
  // Resolve inputs safely to guard against NaN
  const rawTotal = total ?? totalItems ?? props.totalCount ?? 0;
  const safeTotal = typeof rawTotal === 'number' && !isNaN(rawTotal) ? Math.max(0, rawTotal) : 0;
  const safePageSize = typeof pageSize === 'number' && !isNaN(pageSize) && pageSize > 0 ? pageSize : 12;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const activePage = Math.max(1, Math.min(page ?? currentPage ?? 1, totalPages));

  // Handle page change with smooth scroll and URL query update
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === activePage) return;
    onPageChange(newPage);

    if (syncUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(newPage));
        window.history.pushState({}, '', url.toString());
      } catch {}
    }

    if (smoothScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Keyboard navigation across page items
  const handleKeyDown = (e: React.KeyboardEvent, targetPage: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePageChange(targetPage);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePageChange(activePage - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handlePageChange(activePage + 1);
    }
  };

  // Compute page number list with ellipsis for > 7 pages
  const getPageNumbers = (): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages];
    }

    if (activePage >= totalPages - 3) {
      return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis-left', activePage - 1, activePage, activePage + 1, 'ellipsis-right', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1.5 mt-auto pt-8 pb-8 select-none", className)}
      {...props}
    >
      {/* Previous Page (<) */}
      <button
        type="button"
        onClick={() => handlePageChange(activePage - 1)}
        disabled={activePage <= 1}
        aria-label="Go to previous page"
        className={cn(
          "size-9 rounded-[10px] flex items-center justify-center text-[#71717A] transition-colors cursor-pointer",
          "hover:bg-[#19191D] hover:text-[#F4F4F5]",
          "disabled:opacity-30 disabled:pointer-events-none disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Number Buttons & Ellipsis */}
      <div className="flex items-center gap-1.5">
        {pages.map((p, idx) => {
          if (p === 'ellipsis-left' || p === 'ellipsis-right') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="size-9 flex items-center justify-center text-[#71717A]"
                aria-hidden="true"
              >
                <MoreHorizontal className="size-4" />
              </span>
            );
          }

          const isCurrent = p === activePage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => handlePageChange(p)}
              onKeyDown={(e) => handleKeyDown(e, p)}
              aria-current={isCurrent ? "page" : undefined}
              aria-label={`Page ${p}`}
              className={cn(
                "size-9 rounded-[10px] text-[13px] font-medium transition-colors flex items-center justify-center cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                isCurrent
                  ? "bg-[#141417] border border-[rgba(255,255,255,0.13)] text-[#F4F4F5] font-semibold"
                  : "text-[#71717A] hover:bg-[#19191D] hover:text-[#F4F4F5]"
              )}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Next Page (>) */}
      <button
        type="button"
        onClick={() => handlePageChange(activePage + 1)}
        disabled={activePage >= totalPages}
        aria-label="Go to next page"
        className={cn(
          "size-9 rounded-[10px] flex items-center justify-center text-[#71717A] transition-colors cursor-pointer",
          "hover:bg-[#19191D] hover:text-[#F4F4F5]",
          "disabled:opacity-30 disabled:pointer-events-none disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
