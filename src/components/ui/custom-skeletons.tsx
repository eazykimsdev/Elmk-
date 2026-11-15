import React from 'react';
import { cn } from '@/lib/utils';

export function ShimmerBox({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-[8px] shimmer', className)}
      {...props}
    />
  );
}

/**
 * Overview skeleton: header greeting row, 4 equal stat cards,
 * pulse chart box, next bump + checklist row
 */
export function OverviewSkeleton() {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShimmerBox className="size-8 rounded-full" />
          <div className="space-y-1.5">
            <ShimmerBox className="h-6 w-48" />
            <ShimmerBox className="h-4 w-72" />
          </div>
        </div>
        <ShimmerBox className="h-8 w-28 rounded-[10px]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <ShimmerBox className="h-4 w-24" />
              <ShimmerBox className="h-4 w-12" />
            </div>
            <ShimmerBox className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <ShimmerBox className="h-5 w-32" />
            <ShimmerBox className="h-4 w-44" />
          </div>
          <ShimmerBox className="h-8 w-36 rounded-[8px]" />
        </div>
        <ShimmerBox className="h-44 w-full rounded-[10px]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-3">
          <ShimmerBox className="h-5 w-28" />
          <ShimmerBox className="h-4 w-48" />
          <div className="pt-2">
            <ShimmerBox className="h-10 w-full rounded-[10px]" />
          </div>
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-3">
          <div className="flex justify-between items-center">
            <ShimmerBox className="h-5 w-32" />
            <ShimmerBox className="h-4 w-12" />
          </div>
          <div className="space-y-2 pt-1">
            {[0, 1, 2, 3].map((r) => (
              <ShimmerBox key={r} className="h-9 w-full rounded-[8px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Earn credits skeleton: search/sort toolbar, category filter chips,
 * 2-column compact directory card grid (~120px height) matching Section 3.
 */
export function EarnCreditsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <ShimmerBox className="h-10 w-full sm:max-w-md rounded-[10px]" />
        <ShimmerBox className="h-9 w-40 rounded-[10px]" />
      </div>

      <div className="flex items-center gap-1.5 overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <ShimmerBox key={c} className="h-8 w-24 rounded-[8px] shrink-0" />
        ))}
      </div>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[120px] rounded-[16px] border border-[#19191D] bg-[#0E0E11] px-4 py-3.5 flex items-center justify-between gap-3 overflow-hidden ring-1 ring-white/[0.06]"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <ShimmerBox className="size-[56px] rounded-[14px] shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <ShimmerBox className="h-4 w-36 rounded-[6px]" />
                <div className="flex items-center gap-2">
                  <ShimmerBox className="h-3 w-20 rounded-[4px]" />
                  <ShimmerBox className="h-3 w-16 rounded-[4px]" />
                </div>
                <ShimmerBox className="h-3 w-48 rounded-[4px]" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShimmerBox className="h-8 w-14 rounded-lg" />
              <ShimmerBox className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Leaderboard skeleton: podium 1-3, search toolbar, data table rows
 */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((p) => (
          <div key={p} className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <ShimmerBox className="size-8 rounded-[8px]" />
              <ShimmerBox className="size-6 rounded-full" />
            </div>
            <ShimmerBox className="h-5 w-32" />
            <ShimmerBox className="h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden divide-y divide-[var(--border)]">
        <div className="p-4 flex items-center justify-between">
          <ShimmerBox className="h-9 w-64 rounded-[8px]" />
          <ShimmerBox className="h-9 w-32 rounded-[8px]" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShimmerBox className="size-8 rounded-[8px]" />
              <div className="space-y-1">
                <ShimmerBox className="h-4 w-36" />
                <ShimmerBox className="h-3 w-20" />
              </div>
            </div>
            <ShimmerBox className="h-6 w-20" />
            <ShimmerBox className="h-8 w-20 rounded-[8px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * My joins skeleton: summary line, tab bar, table with progress bars
 */
export function MyJoinsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <ShimmerBox className="h-4 w-64" />
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((t) => (
          <ShimmerBox key={t} className="h-8 w-20 rounded-[8px]" />
        ))}
      </div>
      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] divide-y divide-[var(--border)]">
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShimmerBox className="size-9 rounded-[8px]" />
              <div className="space-y-1">
                <ShimmerBox className="h-4 w-36" />
                <ShimmerBox className="h-3 w-24" />
              </div>
            </div>
            <ShimmerBox className="h-4 w-28" />
            <ShimmerBox className="h-8 w-20 rounded-[8px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Partnerships skeleton: summary line, tab bar, table rows
 */
export function PartnershipsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <ShimmerBox className="h-4 w-72" />
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((t) => (
          <ShimmerBox key={t} className="h-8 w-24 rounded-[8px]" />
        ))}
      </div>
      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] divide-y divide-[var(--border)]">
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShimmerBox className="size-9 rounded-[8px]" />
              <div className="space-y-1">
                <ShimmerBox className="h-4 w-40" />
                <ShimmerBox className="h-3 w-24" />
              </div>
            </div>
            <ShimmerBox className="h-8 w-28 rounded-[8px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Promote server skeleton: left 4 grouped cards, right sticky card
 */
export function PromoteServerSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in-50 duration-200">
      <div className="lg:col-span-7 space-y-6">
        {[0, 1, 2, 3].map((c) => (
          <div key={c} className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-4">
            <ShimmerBox className="h-5 w-32" />
            <ShimmerBox className="h-4 w-48" />
            <ShimmerBox className="h-20 w-full rounded-[10px]" />
          </div>
        ))}
      </div>
      <div className="lg:col-span-5">
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-4">
          <ShimmerBox className="h-4 w-28" />
          <ShimmerBox className="h-48 w-full rounded-[12px]" />
        </div>
      </div>
    </div>
  );
}

