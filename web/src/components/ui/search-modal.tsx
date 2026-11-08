"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search as MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  Users,
  X,
  Activity,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchTag {
  label: string;
  icon?: React.ReactNode;
}

export interface SearchResult {
  name: string;
  meta?: string;
  avatar?: string;
  href?: string;
  onClick?: () => void;
}

export interface QuickAction {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
}

export interface SearchModalProps {
  placeholder?: string;
  tags?: SearchTag[];
  results?: SearchResult[];
  quickActions?: QuickAction[];
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  onSelectResult?: (result: SearchResult, index: number) => void;
  className?: string;
  modal?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hotkey?: string | null;
  closeOnEscape?: boolean;
  overlayClassName?: string;
}

const DEFAULT_TAGS: SearchTag[] = [
  { label: "PRC Radar", icon: <Activity className="h-3.5 w-3.5 text-zinc-400" /> },
  { label: "Servers", icon: <Users className="h-3.5 w-3.5 text-zinc-400" /> },
  { label: "Docs", icon: <BookOpen className="h-3.5 w-3.5 text-zinc-400" /> },
];

const DEFAULT_RESULTS: SearchResult[] = [
  {
    name: "Open Dashboard",
    meta: "Manage your servers and ER:LC radar",
    avatar: "/brand/logo.png",
    onClick: () => { window.location.href = "/dashboard"; }
  },
  {
    name: "Live PRC Server Radar",
    meta: "Real-time player count, join codes, server queue",
    avatar: "/brand/logo.png",
    onClick: () => { window.location.href = "/dashboard"; }
  },
  {
    name: "Documentation & Setup Guide",
    meta: "Full API reference and ER:LC integration tutorial",
    avatar: "/brand/logo.png",
    onClick: () => { window.location.href = "/docs"; }
  },
];

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: "Open Dashboard", shortcut: "D", onClick: () => { window.location.href = "/dashboard"; } },
  { label: "View Documentation", shortcut: "G", onClick: () => { window.location.href = "/docs"; } },
  { label: "Add server", shortcut: "A", onClick: () => { window.location.href = "/login"; } },
  { label: "Help & Support", shortcut: "S", onClick: () => { window.location.href = "/docs"; } },
];

export function SearchModal({
  placeholder = "Search servers, documentation...",
  tags = DEFAULT_TAGS,
  results = DEFAULT_RESULTS,
  quickActions = DEFAULT_QUICK_ACTIONS,
  defaultQuery = "",
  onQueryChange,
  onSelectResult,
  className,
  modal = true,
  open,
  defaultOpen = false,
  onOpenChange,
  hotkey = "k",
  closeOnEscape = true,
  overlayClassName,
}: SearchModalProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [activeTags, setActiveTags] = useState<SearchTag[]>(tags);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open state — controlled via `open`, otherwise internal.
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const actualOpen = isControlled ? open : internalOpen;

  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  const openRef = useRef(actualOpen);
  const setOpenRef = useRef(setOpen);
  useEffect(() => {
    openRef.current = actualOpen;
    setOpenRef.current = setOpen;
  });

  // Hotkey listener: Cmd/Ctrl + K or Cmd/Ctrl + F toggles modal; Escape closes it.
  // Also shortcuts D, G, A, S when modal is open and input is empty.
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isCmdOrCtrl && (key === "k" || key === "f")) {
        e.preventDefault();
        setOpenRef.current(!openRef.current);
        return;
      }

      if (closeOnEscape && key === "escape" && openRef.current) {
        setOpenRef.current(false);
        return;
      }

      // Quick action keys if search input is not focused or is empty
      if (openRef.current && !isCmdOrCtrl && document.activeElement !== inputRef.current) {
        if (key === "d") {
          e.preventDefault();
          window.location.href = "/dashboard";
        } else if (key === "g") {
          e.preventDefault();
          window.location.href = "/docs";
        } else if (key === "a") {
          e.preventDefault();
          window.location.href = "/login";
        } else if (key === "s") {
          e.preventDefault();
          window.location.href = "/docs";
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, closeOnEscape]);

  // Focus input on open
  useEffect(() => {
    if (modal && actualOpen) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [modal, actualOpen]);

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) => `${r.name} ${r.meta ?? ""}`.toLowerCase().includes(q));
  }, [query, results]);

  const handleQuery = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  };

  const removeTag = (index: number) =>
    setActiveTags((prev) => prev.filter((_, i) => i !== index));

  const panel = (
    <div
      role={modal ? "dialog" : undefined}
      aria-modal={modal ? true : undefined}
      className={cn(
        "mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121214] text-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] font-sans select-none",
        className,
      )}
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3.5">
        <MagnifyingGlass className="h-[18px] w-[18px] text-zinc-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-zinc-500 font-sans"
        />
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            aria-label="Filters"
            className="text-zinc-400 transition-colors hover:text-white"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </button>
          <kbd className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-400">
            <span className="text-[12px] leading-none">⌘</span>
            <span>F</span>
          </kbd>
        </div>
      </div>

      {/* Tags: I'm looking for... */}
      {activeTags.length > 0 && (
        <div className="border-b border-white/[0.06] px-4 py-3">
          <span className="text-xs text-zinc-400 font-sans">I&apos;m looking for...</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {activeTags.map((tag, i) => (
              <span
                key={`${tag.label}-${i}`}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] py-1 pl-3 pr-2 text-xs text-zinc-200 transition-colors hover:bg-white/[0.08]"
              >
                {tag.icon}
                <span className="font-medium">{tag.label}</span>
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  aria-label={`Remove ${tag.label}`}
                  className="text-zinc-400 transition-colors hover:text-white ml-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results: Last search */}
      {results.length > 0 && (
        <div className="border-b border-white/[0.06]">
          <p className="px-4 pt-3.5 pb-2 text-xs text-zinc-400 font-sans flex items-center gap-2">
            <span>Last search</span>
            <span className="text-zinc-200 font-medium">{filteredResults.length}</span>
          </p>
          <ul className="px-2 pb-2 space-y-0.5">
            {filteredResults.map((result, i) => (
              <li key={`${result.name}-${i}`}>
                <a
                  href={result.href ?? "#"}
                  onClick={(e) => {
                    if (result.onClick) {
                      e.preventDefault();
                      result.onClick();
                    }
                    onSelectResult?.(result, i);
                  }}
                  className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="size-6 shrink-0 rounded-full bg-black/40 border border-white/[0.08] flex items-center justify-center overflow-hidden">
                    <img
                      src={result.avatar || "/brand/logo.png"}
                      alt=""
                      className="size-5 object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-xs">
                    <span className="font-semibold text-white mr-2">{result.name}</span>
                    {result.meta && (
                      <span className="text-zinc-400 font-normal">{result.meta}</span>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <div className="px-2 py-2">
          <p className="px-2.5 pt-1.5 pb-2 text-xs text-zinc-400 font-sans">Quick actions</p>
          <div className="space-y-0.5">
            {quickActions.map((action, i) => (
              <button
                key={`${action.label}-${i}`}
                type="button"
                onClick={action.onClick}
                className="group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 group-hover:text-white transition-colors">
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  </span>
                  <span className="text-xs text-zinc-200 group-hover:text-white transition-colors font-sans">
                    {action.label}
                  </span>
                </div>
                {action.shortcut && (
                  <kbd className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] font-sans text-xs text-zinc-400">
                    {action.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (!actualOpen) return null;
  if (!modal) return panel;

  return (
    <div
      onClick={() => setOpen(false)}
      aria-hidden={!actualOpen}
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh] transition-opacity duration-200",
        actualOpen ? "opacity-100" : "pointer-events-none opacity-0",
        overlayClassName,
      )}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full max-w-xl transition-all duration-200 ease-out",
          actualOpen ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.98] opacity-0",
        )}
      >
        {panel}
      </div>
    </div>
  );
}

export default SearchModal;
