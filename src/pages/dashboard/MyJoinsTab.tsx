import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Check,
  AlertTriangle,
  ExternalLink,
  Info,
  LogOut,
  HelpCircle,
  Users,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { MyJoinsSkeleton } from '@/components/ui/custom-skeletons';
import { Pagination } from '@/components/ui/pagination';
import { openServerProfile } from '@/components/ServerProfileModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type PromotedServer } from './EarnCoinsTab';

interface JoinRecord {
  serverId: string;
  serverName: string;
  serverIcon?: string | null;
  category?: string;
  joinedAt: number;
  retentionHours: number;
  status: 'verifying' | 'verified' | 'reversed';
  reward: number;
  inviteUrl?: string;
}

interface MyJoinsTabProps {
  onNavigateTab?: (tab: string) => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

type TabFilter = 'all' | 'pending' | 'verified' | 'reversed';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getRemainingSeconds(joinedAt: number, totalMinutes: number = 2): number {
  const elapsedMs = Date.now() - joinedAt;
  const totalMs = totalMinutes * 60 * 1000;
  const remainingMs = totalMs - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function MyJoinsTab({ onNavigateTab, addToast }: MyJoinsTabProps) {
  const [loading, setLoading] = useState(true);
  const [joins, setJoins] = useState<JoinRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [currentPage, setCurrentPage] = useState<number>(() => {
    try {
      const p = Number(new URLSearchParams(window.location.search).get('page'));
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 20;
  const [showRetentionInfo, setShowRetentionInfo] = useState(false);

  // Leave server confirmation dialog state
  const [leaveTarget, setLeaveTarget] = useState<JoinRecord | null>(null);

  // Load user joins
  useEffect(() => {
    setLoading(true);
    const start = Date.now();

    try {
      // 1. Load promoted servers for metadata
      const rawPromoted = localStorage.getItem('erlcus_promoted_servers');
      const promotedList: PromotedServer[] = rawPromoted ? JSON.parse(rawPromoted) : [];
      const serverMap = new Map<string, PromotedServer>();
      promotedList.forEach((s) => serverMap.set(String(s.id), s));

      // 2. Load rich user joins
      const rawJoins = localStorage.getItem('connectingerlc_user_joins');
      const richJoins: Record<string, any> = rawJoins ? JSON.parse(rawJoins) : {};

      // 3. Load legacy joins if any exist
      const rawLegacy = localStorage.getItem('erlcus_joined_servers');
      const legacyJoins: Record<string, boolean> = rawLegacy ? JSON.parse(rawLegacy) : {};

      const records: JoinRecord[] = [];

      // Add rich joins
      Object.keys(richJoins).forEach((id) => {
        const item = richJoins[id];
        const server = serverMap.get(id);
        const joinedAt = item.joinedAt || Date.now() - 3600000;
        const remainingSec = getRemainingSeconds(joinedAt, 2);
        const currentStatus = remainingSec === 0 && item.status === 'verifying' ? 'verified' : item.status || 'verifying';

        records.push({
          serverId: id,
          serverName: server?.name || item.serverName || `Server (${id})`,
          serverIcon: server?.icon || null,
          category: server?.category || 'Roleplay server',
          joinedAt: joinedAt,
          retentionHours: 0.033,
          status: currentStatus,
          reward: item.reward || 2,
          inviteUrl: server?.inviteUrl
        });
      });

      // Add any legacy joins not yet in rich joins
      Object.keys(legacyJoins).forEach((id) => {
        if (!richJoins[id] && legacyJoins[id]) {
          const server = serverMap.get(id);
          records.push({
            serverId: id,
            serverName: server?.name || `Server (${id})`,
            serverIcon: server?.icon || null,
            category: server?.category || 'Roleplay server',
            joinedAt: Date.now() - 86400000,
            retentionHours: 72,
            status: 'verified',
            reward: 2,
            inviteUrl: server?.inviteUrl
          });
        }
      });

      // Sort newest first
      records.sort((a, b) => b.joinedAt - a.joinedAt);
      setJoins(records);
    } catch (e) {
      console.warn('Failed to parse joins:', e);
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 400 - elapsed);
      setTimeout(() => setLoading(false), delay);
    }
  }, []);

  // Compute counts
  const verifiedCount = useMemo(() => joins.filter((j) => j.status === 'verified').length, [joins]);
  const pendingCount = useMemo(() => joins.filter((j) => j.status === 'verifying').length, [joins]);
  const reversedCount = useMemo(() => joins.filter((j) => j.status === 'reversed').length, [joins]);

  // Filtered joins
  const filteredJoins = useMemo(() => {
    if (activeTab === 'pending') return joins.filter((j) => j.status === 'verifying');
    if (activeTab === 'verified') return joins.filter((j) => j.status === 'verified');
    if (activeTab === 'reversed') return joins.filter((j) => j.status === 'reversed');
    return joins;
  }, [joins, activeTab]);

  // Paginated joins
  const paginatedJoins = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredJoins.slice(startIndex, startIndex + pageSize);
  }, [filteredJoins, currentPage, pageSize]);

  // Handle leave confirmation
  const handleConfirmLeave = () => {
    if (!leaveTarget) return;

    // Update status in state & storage
    const updated = joins.map((j) => {
      if (j.serverId === leaveTarget.serverId) {
        return { ...j, status: 'reversed' as const, reward: 0 };
      }
      return j;
    });
    setJoins(updated);

    // Save to connectingerlc_user_joins
    try {
      const stored: Record<string, any> = JSON.parse(localStorage.getItem('connectingerlc_user_joins') || '{}');
      if (stored[leaveTarget.serverId]) {
        stored[leaveTarget.serverId].status = 'reversed';
        stored[leaveTarget.serverId].reward = 0;
        localStorage.setItem('connectingerlc_user_joins', JSON.stringify(stored));
      }
      // Also remove from legacy joined servers map
      const legacy = JSON.parse(localStorage.getItem('erlcus_joined_servers') || '{}');
      delete legacy[leaveTarget.serverId];
      localStorage.setItem('erlcus_joined_servers', JSON.stringify(legacy));
    } catch {}

    // Deduct bounty credits
    try {
      const balance = parseInt(localStorage.getItem('erlcus_credits_balance') || '0', 10);
      const newBal = Math.max(0, balance - 2);
      localStorage.setItem('erlcus_credits_balance', newBal.toString());
      window.dispatchEvent(new Event('erlcus_credits_updated'));
    } catch {}

    addToast?.('info', 'Left server', `You left ${leaveTarget.serverName}. 2 credits reversed.`);
    setLeaveTarget(null);
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-12rem)] space-y-6 w-full max-w-7xl mx-auto pb-8 font-sans">
      {/* Top compact summary line with clickable filters and retention explainer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-[10px] bg-[#0E0E11] border border-[var(--border)] text-[13px] font-sans">
        <div className="flex items-center gap-2 text-[#F4F4F5]">
          <button
            type="button"
            onClick={() => { setActiveTab('verified'); setCurrentPage(1); }}
            className={`font-medium hover:underline cursor-pointer ${activeTab === 'verified' ? 'text-[var(--accent)] font-semibold underline' : 'text-[var(--accent)]'}`}
          >
            {verifiedCount} verified
          </button>
          <span className="text-[#71717A]">·</span>
          <button
            type="button"
            onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
            className={`font-medium hover:underline cursor-pointer ${activeTab === 'pending' ? 'text-[#F59E0B] font-semibold underline' : 'text-[#F59E0B]'}`}
          >
            {pendingCount} pending
          </button>
          <span className="text-[#71717A]">·</span>
          <button
            type="button"
            onClick={() => { setActiveTab('reversed'); setCurrentPage(1); }}
            className={`font-medium hover:underline cursor-pointer ${activeTab === 'reversed' ? 'text-[#A1A1AA] font-semibold underline' : 'text-[#A1A1AA]'}`}
          >
            {reversedCount} left early
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowRetentionInfo(!showRetentionInfo)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#141417] border border-[var(--border)] text-[12px] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors cursor-pointer"
        >
          <HelpCircle className="size-3.5" />
          <span>How verified joins work</span>
        </button>
      </div>

      {/* Retention Explainer Pill (collapsible) */}
      {showRetentionInfo && (
        <div className="p-4 rounded-[10px] bg-[#141417] border border-[var(--border)] text-[13px] text-[#A1A1AA] space-y-1.5 animate-in fade-in-50 duration-150">
          <div className="font-medium text-[#F4F4F5] flex items-center gap-1.5">
            <Info className="size-4 text-[var(--accent)]" />
            How verified joins work
          </div>
          <p className="leading-relaxed">
            When you join a server through ConnectingERLC, a 2-minute retention verification begins.
            Once you remain in the server for the full 2 minutes, the join is confirmed as permanent and verified.
            If you leave before the 2 minutes finish, the join is marked as reversed and the credits are withdrawn.
          </p>
        </div>
      )}

      {/* Tab Filter Row */}
      <div className="flex items-center gap-1.5 border-b border-[var(--border)] pb-2">
        {(
          [
            { id: 'all', label: 'All', count: joins.length },
            { id: 'pending', label: 'Pending', count: pendingCount },
            { id: 'verified', label: 'Verified', count: verifiedCount },
            { id: 'reversed', label: 'Left early', count: reversedCount }
          ] as const
        ).map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all inline-flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#141417] text-[#F4F4F5] border border-[var(--border-strong)] shadow-xs'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#141417]/40'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                isSelected ? 'bg-[#0E0E11] text-[#F4F4F5]' : 'text-[#71717A]'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table or Skeleton */}
      {loading ? (
        <MyJoinsSkeleton />
      ) : filteredJoins.length === 0 ? (
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-12">
          <EmptyState
            title={
              activeTab === 'pending'
                ? 'No pending joins'
                : activeTab === 'verified'
                ? 'No verified joins yet'
                : activeTab === 'reversed'
                ? 'No early departures'
                : 'No joins yet'
            }
            description={
              activeTab === 'pending'
                ? 'Join communities in the directory to start 72-hour verification.'
                : 'Browse the directory to earn credits by joining communities.'
            }
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigateTab?.('earn')}
              >
                Browse directory
              </Button>
            }
          />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[#141417]/50 text-[12px] font-medium text-[#71717A]">
                  <th className="py-3 px-4">Server</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Category</th>
                  <th className="py-3 px-4 hidden md:table-cell">Joined</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Credits</th>
                  <th className="py-3 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[13px]">
                {paginatedJoins.map((row) => {
                  const remainingSec = getRemainingSeconds(row.joinedAt, 2);
                  const progressPct = Math.min(100, Math.max(0, Math.round(((120 - remainingSec) / 120) * 100)));
                  const remainingDisplay = remainingSec > 60 ? `${Math.ceil(remainingSec / 60)}m` : `${remainingSec}s`;

                  return (
                    <tr
                      key={row.serverId}
                      onClick={() => openServerProfile(row.serverId)}
                      className="hover:bg-[#141417]/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <ServerIcon
                            guildId={row.serverId}
                            iconUrl={row.serverIcon}
                            name={row.serverName}
                            size={32}
                            className="size-8 rounded-[8px] object-cover shrink-0"
                          />
                          <span className="font-semibold text-[#F4F4F5] truncate max-w-[180px] hover:text-[var(--accent)] transition-colors">
                            {row.serverName}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <span className="text-[12px] text-[#A1A1AA]">
                          {row.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 hidden md:table-cell text-[#71717A] text-[12px]">
                        {formatRelativeTime(row.joinedAt)}
                      </td>

                      <td className="py-3.5 px-4">
                        {row.status === 'verifying' ? (
                          <div className="space-y-1.5 max-w-[160px]">
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#F59E0B]">
                              <Clock className="size-3" />
                              <span>Verified in {remainingDisplay}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#141417] overflow-hidden">
                              <div
                                className="h-full bg-[#F59E0B] rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        ) : row.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/25 text-[11px] font-medium">
                            <Check className="size-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25 text-[11px] font-medium">
                            Reversed
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium">
                        {row.status === 'reversed' ? (
                          <span className="text-[#71717A]">0 cr</span>
                        ) : (
                          <span className="text-[var(--accent)]">+{row.reward} cr</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="size-7 rounded-[6px] hover:bg-[#141417] text-[#71717A] hover:text-[#F4F4F5] inline-flex items-center justify-center transition-colors cursor-pointer"
                                aria-label="Server actions"
                              >
                                <MoreVertical className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-[#0E0E11] border border-[rgba(255,255,255,0.07)] text-[#F4F4F5] rounded-[10px] p-1 font-sans">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (row.inviteUrl) {
                                    window.open(row.inviteUrl, '_blank', 'noopener,noreferrer');
                                  } else {
                                    openServerProfile(row.serverId);
                                  }
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-[6px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#141417] cursor-pointer"
                              >
                                <ExternalLink className="size-3.5" />
                                <span>Open server</span>
                              </DropdownMenuItem>
                              {row.status !== 'reversed' && (
                                <DropdownMenuItem
                                  onClick={() => setLeaveTarget(row)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-[6px] text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer"
                                >
                                  <LogOut className="size-3.5" />
                                  <span>Leave server</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination outside and below table card: centered with mt-auto pt-8 pb-8 */}
      <Pagination
        page={currentPage}
        pageSize={20}
        total={filteredJoins.length}
        onPageChange={setCurrentPage}
      />

      {/* Leave Server Confirm Dialog */}
      {leaveTarget && (
        <Dialog open={Boolean(leaveTarget)} onOpenChange={(open) => !open && setLeaveTarget(null)}>
          <DialogContent className="sm:max-w-md bg-[#0E0E11] border border-[var(--border)] rounded-[16px] p-6 space-y-4 font-sans text-left">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/25 flex items-center justify-center text-[#EF4444] shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-[17px] font-semibold text-[#F4F4F5] font-sans">
                    Leave {leaveTarget.serverName}?
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-[#A1A1AA] font-sans mt-0.5">
                    Confirming will deduct the {leaveTarget.reward || 2} credits you earned for joining.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogFooter className="flex items-center justify-end gap-2.5 pt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLeaveTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmLeave}
              >
                Leave server
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
