import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Download,
  Filter,
  ChevronRight,
  Copy,
  Check,
  Compass,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Pagination } from '@/components/ui/pagination';
import { ServerAvatar } from '@/components/DashboardSidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface LedgerTransaction {
  id: string;
  userId: string;
  timestamp: number;
  type: 'earned' | 'spent';
  amount: number;
  balanceAfter: number;
  reason: string;
  description: string;
  guildId?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
  triggeredBy?: string;
  status: 'posted' | 'pending' | 'reversed';
  relatedTxId?: string | null;
  ledgerHash?: string;
}

export interface PendingReward {
  id: string;
  userId: string;
  guildId: string;
  guildName?: string;
  guildIconUrl?: string;
  amount: number;
  createdAt: number;
  releaseAt: number;
  status: string;
  remainingSeconds: number;
}

export interface LedgerSummary {
  balance: number;
  earned: number;
  spent: number;
}

export interface HistoryTabProps {
  onNavigateTab?: (tab: string) => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

export function HistoryTab({ onNavigateTab, addToast }: HistoryTabProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [pendingList, setPendingList] = useState<PendingReward[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({ balance: 0, earned: 0, spent: 0 });
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination state
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [typeFilter, setTypeFilter] = useState<'all' | 'earned' | 'spent'>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Selected row for Detail Sheet
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Fetch History from Backend
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const match = window.location.pathname.match(/\/dashboard\/([^/]+)/);
      const currentGuildId = match?.[1];

      const params = new URLSearchParams({
        range,
        type: typeFilter,
        reason: reasonFilter,
        page: String(currentPage),
        pageSize: String(pageSize),
      });
      if (currentGuildId) params.append('guildId', currentGuildId);

      const res = await fetch(`/api/credits/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.items || []);
        setPendingList(data.pending || []);
        if (data.summary) setSummary(data.summary);
        setTotalCount(data.total || 0);

        // Update local credits cache
        if (data.summary?.balance !== undefined) {
          localStorage.setItem(currentGuildId ? `erlcus_credits_balance_${currentGuildId}` : 'erlcus_credits_balance', String(data.summary.balance));
          window.dispatchEvent(new Event('balance_updated'));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch credit history:', err);
    } finally {
      setLoading(false);
    }
  }, [range, typeFilter, reasonFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Live countdown for pending items
  useEffect(() => {
    if (pendingList.length === 0) return;
    const interval = setInterval(() => {
      setPendingList((prev) =>
        prev.map((p) => ({
          ...p,
          remainingSeconds: Math.max(0, p.remainingSeconds - 1),
        }))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingList.length]);

  // Format pending countdown (e.g. "41h 12m")
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'Ready to release';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `Releases in ${hours}h ${minutes}m`;
    return `Releases in ${minutes}m`;
  };

  // Date formatting helper
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;

    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  };

  // CSV Export action
  const handleExportCsv = async () => {
    try {
      const match = window.location.pathname.match(/\/dashboard\/([^/]+)/);
      const currentGuildId = match?.[1];

      const params = new URLSearchParams({
        range,
        type: typeFilter,
        reason: reasonFilter,
      });
      if (currentGuildId) params.append('guildId', currentGuildId);

      const res = await fetch(`/api/credits/export-csv?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to generate CSV export');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `mavely-credits-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      addToast?.('success', 'Export completed', 'Credit history exported to CSV.');
    } catch {
      addToast?.('error', 'Export failed', 'Could not export CSV file.');
    }
  };

  // Copy Reference ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const hasFiltersApplied = range !== '30d' || typeFilter !== 'all' || reasonFilter !== 'all';

  const resetFilters = () => {
    setRange('30d');
    setTypeFilter('all');
    setReasonFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-12rem)] space-y-6 w-full max-w-7xl mx-auto pb-8 font-sans">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-[24px] font-semibold tracking-tight text-[#F4F4F5] font-sans">
          Credit history
        </h1>
        <p className="text-[14px] text-[#A1A1AA]">
          Every credit added to or spent from your balance.
        </p>
      </div>

      {/* ── SUMMARY ROW (3 SMALL STAT TILES IN 1 CARD WITH DIVIDERS) ────── */}
      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--border)] overflow-hidden">
        {/* Tile 1: Balance */}
        <div className="p-6 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#A1A1AA]">Balance</span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('transfer')}
              className="text-[12px] text-[var(--accent)] hover:underline cursor-pointer"
            >
              Store
            </button>
          </div>
          <div className="text-[28px] font-semibold text-[#F4F4F5] tabular-nums tracking-tight font-sans">
            {loading ? '—' : summary.balance.toLocaleString()}
          </div>
          <p className="text-[12px] text-[#71717A]">
            Available for bumps and promotions
          </p>
        </div>

        {/* Tile 2: Earned */}
        <div className="p-6 space-y-1">
          <div className="text-[13px] font-medium text-[#A1A1AA]">Earned</div>
          <div className="text-[28px] font-semibold text-[var(--accent)] tabular-nums tracking-tight font-sans">
            {loading ? '—' : `+${summary.earned.toLocaleString()}`}
          </div>
          <p className="text-[12px] text-[#71717A]">
            From server joins & check-ins
          </p>
        </div>

        {/* Tile 3: Spent */}
        <div className="p-6 space-y-1">
          <div className="text-[13px] font-medium text-[#A1A1AA]">Spent</div>
          <div className="text-[28px] font-semibold text-[#F4F4F5] tabular-nums tracking-tight font-sans">
            {loading ? '—' : `-${summary.spent.toLocaleString()}`}
          </div>
          <p className="text-[12px] text-[#71717A]">
            On bumps & featured placements
          </p>
        </div>
      </div>

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Range Segmented Control (7d | 30d | 90d | All) */}
          <div className="inline-flex items-center rounded-[10px] border border-[var(--border)] bg-[#141417] p-1 text-xs">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  setCurrentPage(1);
                }}
                className={cn(
                  'rounded-[8px] px-3 py-1 font-medium transition-colors cursor-pointer',
                  range === r
                    ? 'bg-[#19191D] text-[#F4F4F5] font-semibold shadow-xs border border-[var(--border)]'
                    : 'text-[#71717A] hover:text-[#F4F4F5]'
                )}
              >
                {r === 'all' ? 'All time' : r}
              </button>
            ))}
          </div>

          {/* Type Tabs (All | Earned | Spent) */}
          <div className="inline-flex items-center rounded-[10px] border border-[var(--border)] bg-[#141417] p-1 text-xs">
            {(['all', 'earned', 'spent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setCurrentPage(1);
                }}
                className={cn(
                  'rounded-[8px] px-3 py-1 capitalize font-medium transition-colors cursor-pointer',
                  typeFilter === t
                    ? 'bg-[#19191D] text-[#F4F4F5] font-semibold shadow-xs border border-[var(--border)]'
                    : 'text-[#71717A] hover:text-[#F4F4F5]'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Reason Select */}
          <Select
            value={reasonFilter}
            onValueChange={(val) => {
              setReasonFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[145px] h-8.5 rounded-[10px] bg-[#141417] border-[var(--border)] text-xs text-[#F4F4F5]">
              <SelectValue placeholder="All reasons" />
            </SelectTrigger>
            <SelectContent className="bg-[#0E0E11] border-[rgba(255,255,255,0.07)] text-[#F4F4F5] rounded-[10px]">
              <SelectItem value="all">All reasons</SelectItem>
              <SelectItem value="join_reward">Server joins</SelectItem>
              <SelectItem value="bump">Bumps</SelectItem>
              <SelectItem value="Daily check-in">Check-in</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Secondary Export CSV Button */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            className="h-8.5 rounded-[10px] border border-[var(--border)] bg-[#141417] px-3 text-xs font-medium text-[#F4F4F5] hover:bg-[#19191D] hover:text-white"
          >
            <Download className="size-3.5 mr-1.5 text-[#A1A1AA]" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── PENDING RETENTION REWARDS GROUP ─────────────────────────────── */}
      {pendingList.length > 0 && (
        <div className="rounded-[16px] border border-[#FBBF24]/20 bg-[#FBBF24]/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#FBBF24]" />
              <span className="text-[13px] font-semibold text-[#F4F4F5]">
                Pending retention joins
              </span>
            </div>
            <Badge variant="secondary" className="text-[11px] bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30 font-medium">
              72h anti-churn window
            </Badge>
          </div>

          <div className="divide-y divide-[#FBBF24]/10">
            {pendingList.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <ServerAvatar name={p.guildName || 'Server'} iconUrl={p.guildIconUrl} size="sm" className="size-7 rounded-[7px]" />
                  <div>
                    <span className="font-medium text-[#F4F4F5]">{p.guildName || 'Discord Community'}</span>
                    <span className="ml-2 text-[#A1A1AA]">Joined via directory</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[var(--accent)] font-semibold tabular-nums">
                    +{p.amount} cr (pending)
                  </span>
                  <span className="text-[#FBBF24] font-medium tabular-nums">
                    {formatCountdown(p.remainingSeconds)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABLE CONTAINER ─────────────────────────────────────────────── */}
      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden">
        {loading ? (
          /* Skeleton Loader (5 rows) */
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-28 bg-[#19191D] rounded-[4px]" />
                  <div className="h-4 w-48 bg-[#19191D] rounded-[4px]" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-4 w-16 bg-[#19191D] rounded-[4px]" />
                  <div className="h-4 w-12 bg-[#19191D] rounded-[4px]" />
                  <div className="h-4 w-12 bg-[#19191D] rounded-[4px]" />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          /* Empty States */
          <div className="py-16 px-4 text-center space-y-3">
            <div className="size-12 rounded-full bg-[#141417] border border-[var(--border)] flex items-center justify-center mx-auto text-[#71717A]">
              {hasFiltersApplied ? <Filter className="size-5" /> : <Coins className="size-5" />}
            </div>

            <div className="space-y-1">
              <h3 className="text-[16px] font-semibold text-[#F4F4F5]">
                {hasFiltersApplied ? 'No matching transactions' : 'No credit activity yet'}
              </h3>
              <p className="text-[13px] text-[#71717A] max-w-sm mx-auto leading-relaxed">
                {hasFiltersApplied
                  ? 'Try changing your date range or filters to see more activity.'
                  : 'Join a listed server to earn your first credits.'}
              </p>
            </div>

            <div className="pt-2">
              {hasFiltersApplied ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="rounded-[10px] border border-[var(--border)] bg-[#141417] text-xs font-medium text-[#F4F4F5] hover:bg-[#19191D]"
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Reset filters
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigateTab?.('earn')}
                  className="rounded-[10px] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] font-medium text-xs h-9 px-4"
                >
                  <Compass className="size-3.5 mr-1.5" />
                  Browse directory
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Real Transactions Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[#71717A] font-medium text-[12px]">
                  <th className="py-3 px-4 font-normal">Date</th>
                  <th className="py-3 px-4 font-normal">Description</th>
                  <th className="py-3 px-4 font-normal">Type</th>
                  <th className="py-3 px-4 font-normal text-right">Amount</th>
                  <th className="py-3 px-4 font-normal text-right">Balance after</th>
                  <th className="py-3 px-3 font-normal w-8 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[#F4F4F5]">
                {transactions.map((tx) => {
                  const isEarned = tx.type === 'earned';
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="group hover:bg-[#141417]/80 transition-colors cursor-pointer"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 text-[#A1A1AA] whitespace-nowrap">
                        {formatDate(tx.timestamp)}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 font-medium text-[#F4F4F5]">
                        <div className="flex items-center gap-2">
                          {tx.guildId && (
                            <ServerAvatar
                              name={tx.guildName || 'Server'}
                              iconUrl={tx.guildIconUrl}
                              size="sm"
                              className="size-5 rounded-[5px]"
                            />
                          )}
                          <span className="truncate max-w-xs">{tx.description}</span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium border",
                          isEarned
                            ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]"
                            : "bg-[#141417] text-[#A1A1AA] border-[rgba(255,255,255,0.07)]"
                        )}>
                          {isEarned ? 'Earned' : 'Spent'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td
                        className={cn(
                          'py-3.5 px-4 text-right font-semibold tabular-nums whitespace-nowrap',
                          isEarned ? 'text-[var(--accent)]' : 'text-[#F4F4F5]'
                        )}
                      >
                        {isEarned ? `+${tx.amount}` : `-${tx.amount}`}
                      </td>

                      {/* Balance After */}
                      <td className="py-3.5 px-4 text-right text-[#A1A1AA] tabular-nums whitespace-nowrap">
                        {tx.balanceAfter} cr
                      </td>

                      {/* Chevron */}
                      <td className="py-3.5 px-3 text-right">
                        <ChevronRight className="size-4 text-[#71717A] group-hover:text-[#F4F4F5] transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PAGINATION (Always outside and below table card with mt-auto pt-8 pb-8) ── */}
      <Pagination
        currentPage={currentPage}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={(page) => setCurrentPage(page)}
      />

      {/* ── TRANSACTION DETAIL SHEET (SLIDE OVER) ───────────────────────── */}
      <Sheet open={Boolean(selectedTx)} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md border-l border-[var(--border-strong)] bg-[#0E0E11] p-6 space-y-6 font-sans">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-[18px] font-semibold text-[#F4F4F5] font-sans">
              Transaction details
            </SheetTitle>
          </SheetHeader>

          {selectedTx && (
            <div className="space-y-6 text-[13px]">
              {/* Amount & Status Hero */}
              <div className="rounded-[12px] bg-[#141417] p-4 border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Amount</span>
                  <Badge
                    variant={
                      selectedTx.status === 'posted'
                        ? 'default'
                        : selectedTx.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className="capitalize text-[11px]"
                  >
                    {selectedTx.status}
                  </Badge>
                </div>
                <div
                  className={cn(
                    'text-[28px] font-bold tabular-nums font-sans',
                    selectedTx.type === 'earned' ? 'text-[var(--accent)]' : 'text-[#F4F4F5]'
                  )}
                >
                  {selectedTx.type === 'earned' ? `+${selectedTx.amount}` : `-${selectedTx.amount}`}{' '}
                  <span className="text-[14px] font-normal text-[#A1A1AA]">credits</span>
                </div>
              </div>

              {/* Transaction Key Details */}
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {/* Reference ID */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Transaction ID</span>
                  <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#F4F4F5]">
                    <span>{selectedTx.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(selectedTx.id)}
                      className="text-[#71717A] hover:text-[#F4F4F5] transition-colors p-1"
                      title="Copy transaction ID"
                    >
                      {isCopied ? <Check className="size-3.5 text-[var(--accent)]" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Ledger Hash */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Ledger hash</span>
                  <span className="font-mono text-[11px] text-[#71717A] truncate max-w-[200px]">
                    {selectedTx.ledgerHash || `0x${selectedTx.id.replace(/[^a-f0-9]/gi, '').padEnd(16, '0').slice(0, 16)}...`}
                  </span>
                </div>

                {/* Date & Time */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Timestamp</span>
                  <span className="text-[#F4F4F5] font-medium">
                    {new Date(selectedTx.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* Reason */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Reason</span>
                  <span className="text-[#F4F4F5] font-medium">{selectedTx.reason}</span>
                </div>

                {/* Description */}
                <div className="py-3 flex items-start justify-between gap-4">
                  <span className="text-[#A1A1AA] shrink-0">Description</span>
                  <span className="text-[#F4F4F5] text-right">{selectedTx.description}</span>
                </div>

                {/* Balance After */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Balance after</span>
                  <span className="text-[#F4F4F5] font-medium tabular-nums">
                    {selectedTx.balanceAfter} credits
                  </span>
                </div>

                {/* Associated Server */}
                {selectedTx.guildName && (
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#A1A1AA]">Community</span>
                    <div className="flex items-center gap-2">
                      <ServerAvatar
                        name={selectedTx.guildName}
                        iconUrl={selectedTx.guildIconUrl}
                        size="sm"
                        className="size-6 rounded-[6px]"
                      />
                      <span className="text-[#F4F4F5] font-medium">{selectedTx.guildName}</span>
                    </div>
                  </div>
                )}

                {/* Triggered By */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Triggered by</span>
                  <span className="text-[#A1A1AA]">{selectedTx.triggeredBy || 'System automation'}</span>
                </div>

                {/* Reversal Link */}
                {selectedTx.relatedTxId && (
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#A1A1AA]">Linked transaction</span>
                    <span className="font-mono text-xs text-[var(--accent)]">{selectedTx.relatedTxId}</span>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setSelectedTx(null)}
                  className="w-full text-xs text-[#A1A1AA] hover:text-white"
                >
                  Close details
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
