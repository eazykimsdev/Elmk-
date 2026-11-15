import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SearchPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onOpen?: () => void;
}

/**
 * SearchPill: Sleek rounded search trigger button matching user reference.
 * Sits in the page header under the top banner's X button.
 * Seamless blended CTRL + K shortcut with zero icon boxiness.
 */
export function SearchPill({
  className,
  onClick,
  onOpen,
  ...props
}: SearchPillProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) onClick(e);
    if (onOpen) onOpen();
    window.dispatchEvent(new CustomEvent('erlc-open-search'));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Search"
      title="Search (CTRL + K)"
      className={cn(
        "group inline-flex items-center justify-between gap-3 h-8.5 px-3.5 w-48 sm:w-56 md:w-64 rounded-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.14] text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer select-none",
        className
      )}
      {...props}
    >
      <span className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
        Search
      </span>
      <span className="inline-flex items-center text-[11px] font-sans font-medium text-zinc-500 group-hover:text-zinc-400 tracking-wider select-none shrink-0">
        CTRL + K
      </span>
    </button>
  );
}

export default SearchPill;
