import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Trophy,
  Search,
  ExternalLink,
  Flame,
  Users,
  Handshake,
  Check,
  UserCheck,
  Sparkles,
  Eye,
  Radio,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { openServerProfile } from '@/components/ServerProfileModal';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';

export interface LeaderboardTabProps {
  currentGuildId?: string;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const CATEGORIES = [
  'All',
  'Design server',
  'Roleplay server',
  'Misc',
  'COTS',
  'Departments',
  'Events',
] as const;

export function LeaderboardTab({
  currentGuildId: propGuildId,
  addToast,
  onNavigateTab,
}: LeaderboardTabProps) {
  const params = useParams<{ guildId?: string }>();
  const currentGuildId = propGuildId || params.guildId || (() => {
    try {
      return localStorage.getItem('erlcus_default_guild') || '';
    } catch {
      return '';
    }
  })();

  const { user, guilds } = useAuth();
  const currentGuild = useMemo(() => {
    return guilds?.find((g) => g.id === currentGuildId) || null;
  }, [guilds, currentGuildId]);

  const [activeTab, setActiveTab] = useState<'servers' | 'recruiters' | 'partners'>('servers');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [yourRank, setYourRank] = useState<{
    rank: number;
    total: number;
    topPercent: number;
    name: string;
    guildId?: string;
    iconHash?: string | null;
    iconUrl?: string | null;
    change?: number | null;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Fetch from backend
  useEffect(() => {
    let mounted = true;
    async function loadLeaderboard() {
      setLoading(true);
      try {
        const catParam = selectedCategory !== 'All' ? `&category=${encodeURIComponent(selectedCategory)}` : '';
        const guildParam = currentGuildId ? `&guildId=${encodeURIComponent(currentGuildId)}` : '';
        const res = await fetch(`/api/leaderboard?tab=${activeTab}&range=${range}&page=${currentPage}&pageSize=${pageSize}${catParam}${guildParam}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setItems(data.items || []);
            setTotalCount(data.total || 0);
            if (data.yourRank) setYourRank(data.yourRank);
          }
        }
      } catch (err) {
        console.warn('Leaderboard error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLeaderboard();
    return () => {
      mounted = false;
    };
  }, [activeTab, range, selectedCategory, currentPage, currentGuildId]);

  // Client search filter
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      if (activeTab === 'servers') {
        return item.name?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
      }
      if (activeTab === 'recruiters') {
        return item.recruiter_name?.toLowerCase().includes(q) || item.server_name?.toLowerCase().includes(q);
      }
      if (activeTab === 'partners') {
        return item.name?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, search, activeTab]);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-12rem)] space-y-6 w-full max-w-7xl mx-auto pb-12 font-sans">
      {/* ── YOUR RANK COMPACT CARD (Section 11) ── */}
      {yourRank && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Server Icon, Name, and Status line */}
            <div className="flex items-center gap-3.5 min-w-0">
              {activeTab === 'servers' ? (
                <ServerIcon
                  guildId={yourRank.guildId || currentGuildId}
                  iconHash={yourRank.iconHash || currentGuild?.icon}
                  iconUrl={yourRank.iconUrl || currentGuild?.iconUrl}
                  name={yourRank.name || currentGuild?.name || 'Server'}
                  size={44}
                  className="size-11 rounded-xl object-cover shrink-0"
                />
              ) : (
                <UserAvatar
                  userId={user?.id}
                  avatarHash={user?.avatar}
                  name={user?.globalName || user?.username || 'You'}
                  size={44}
                  className="size-11 rounded-xl object-cover shrink-0"
                />
              )}

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white truncate font-sans">
                    {activeTab === 'servers'
                      ? (yourRank.name || currentGuild?.name || 'Server')
                      : (user?.globalName || user?.username || 'You')}
                  </h3>
                  {yourRank.total >= 10 && yourRank.topPercent && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] text-[11px] font-semibold tabular-nums">
                      Top {yourRank.topPercent}%
                    </span>
                  )}
                  {yourRank.change !== null && yourRank.change !== undefined && (
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                      yourRank.change > 0 ? "text-[var(--accent)]" : yourRank.change < 0 ? "text-rose-400" : "text-zinc-400"
                    )}>
                      {yourRank.change > 0 ? '↑' : yourRank.change < 0 ? '↓' : '•'}
                      {Math.abs(yourRank.change)}
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 font-sans">
                  You are #{yourRank.rank} of {yourRank.total} listed servers.
                </p>
              </div>
            </div>

            {/* Right: Big Rank & Total */}
            <div className="flex items-baseline gap-1.5 self-start sm:self-auto shrink-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                #{yourRank.rank}
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                of {yourRank.total} listed servers
              </span>
            </div>
          </div>

          {/* Thin 4px neutral position bar only when 3 or more listed servers */}
          {yourRank.total >= 3 && (
            <div className="w-full h-1 rounded-full bg-[#19191D] overflow-hidden">
              <div
                className="h-full bg-zinc-600 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(6, Math.min(100, Math.round(((yourRank.total - yourRank.rank + 1) / Math.max(1, yourRank.total)) * 100)))}%`
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── TABS: Top servers | Top recruiters | Top partners ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center rounded-xl bg-[#141417] p-1 border border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('servers');
              setCurrentPage(1);
            }}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans',
              activeTab === 'servers'
                ? 'bg-[#272727] text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            Top servers
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('recruiters');
              setCurrentPage(1);
            }}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans',
              activeTab === 'recruiters'
                ? 'bg-[#272727] text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            Top recruiters
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('partners');
              setCurrentPage(1);
            }}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans',
              activeTab === 'partners'
                ? 'bg-[#272727] text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            Top partners
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}…`}
            className="pl-8.5 h-8.5 text-xs bg-[#0E0E11] border-white/10 rounded-xl font-sans"
          />
        </div>
      </div>

      {/* Category Chips for Top Servers */}
      {activeTab === 'servers' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer font-sans',
                  isSelected
                    ? 'bg-[#19191D] text-white border border-white/15'
                    : 'text-zinc-400 hover:text-white hover:bg-[#141417] border border-transparent'
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* ── TABLE CARD ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-sans">
            Loading rankings…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title={
                activeTab === 'servers'
                  ? 'No ranked servers found'
                  : activeTab === 'recruiters'
                  ? 'No active recruiters yet'
                  : 'No partner communities found'
              }
              description={
                activeTab === 'servers'
                  ? 'Communities will appear here once verified joins and bumps are recorded.'
                  : activeTab === 'recruiters'
                  ? 'Share your recruit link to begin climbing the recruiter leaderboard.'
                  : 'Form mutual partnerships to appear on this leaderboard.'
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('All');
                  }}
                  className="bg-[#272727] text-zinc-200 border-white/10 text-xs h-8 px-3 rounded-lg cursor-pointer"
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* ── 1. TOP SERVERS TABLE ── */}
            {activeTab === 'servers' && (
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#141417]/50 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                    <th className="py-3 px-5 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Server</th>
                    <th className="py-3 px-4 text-right">Members</th>
                    <th className="py-3 px-4 text-right">Joins this month</th>
                    <th className="py-3 px-4 text-right hidden sm:table-cell">Bumps this month</th>
                    <th className="py-3 px-5 w-24 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredItems.map((row) => {
                    const isOwn = currentGuildId && String(row.id) === String(currentGuildId);
                    const rankColor =
                      row.rank === 1
                        ? 'text-amber-400 font-bold'
                        : row.rank === 2
                        ? 'text-zinc-300 font-semibold'
                        : row.rank === 3
                        ? 'text-amber-600 font-semibold'
                        : 'text-zinc-500';

                    return (
                      <tr
                        key={row.id}
                        onClick={() => openServerProfile(row.id)}
                        className={cn(
                          'transition-colors cursor-pointer',
                          isOwn ? 'bg-[#141417]/70 hover:bg-[#141417]' : 'hover:bg-[#141417]/40'
                        )}
                      >
                        <td className={`py-3.5 px-5 text-center tabular-nums text-xs ${rankColor}`}>
                          #{row.rank}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <ServerIcon
                              guildId={row.id}
                              iconHash={row.icon_hash || row.iconHash || row.icon}
                              iconUrl={row.icon}
                              name={row.name}
                              size={32}
                              className="size-8 rounded-[8px] object-cover shrink-0"
                            />
                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white truncate max-w-[200px]">
                                {row.name}
                              </span>
                              {row.verified && (
                                <Check className="size-3 text-[var(--accent)] stroke-[2.5] shrink-0" />
                              )}
                              <Badge variant="outline" className="text-[10px] bg-[#141417] border-white/10 text-zinc-300 px-1.5 py-0">
                                {row.category}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-zinc-300 tabular-nums">
                          {Number(row.memberCount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-[var(--accent)] tabular-nums">
                          +{row.verifiedJoins || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-400 tabular-nums hidden sm:table-cell">
                          {row.bumps || 0}
                        </td>
                        <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openServerProfile(row.id)}
                            className="bg-[#272727] hover:bg-[#323232] text-zinc-200 border-white/10 text-xs h-7.5 px-3 rounded-lg cursor-pointer"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── 2. TOP RECRUITERS TABLE ── */}
            {activeTab === 'recruiters' && (
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#141417]/50 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                    <th className="py-3 px-5 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Recruiter</th>
                    <th className="py-3 px-4">Server</th>
                    <th className="py-3 px-4 text-right">Recruits verified</th>
                    <th className="py-3 px-5 text-right">Credits earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredItems.map((row) => {
                    const isCurrentUser = user && String(user.id) === String(row.recruiter_id);
                    return (
                      <tr
                        key={row.recruiter_id || row.rank}
                        className={cn(
                          'transition-colors',
                          isCurrentUser ? 'bg-[#141417]/70' : 'hover:bg-[#141417]/40'
                        )}
                      >
                        <td className="py-3.5 px-5 text-center tabular-nums text-xs text-zinc-400 font-medium">
                          #{row.rank}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              userId={row.recruiter_id}
                              avatarUrl={row.recruiter_avatar}
                              name={row.recruiter_name}
                              size="sm"
                              className="size-7 rounded-full shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-white truncate block">
                                {row.recruiter_name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 truncate max-w-[160px]">
                          {row.server_name || 'Community'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-[var(--accent)] tabular-nums">
                          {row.verifiedCount || 0}
                        </td>
                        <td className="py-3.5 px-5 text-right font-semibold text-zinc-200 tabular-nums">
                          +{row.creditsEarned || 0} cr
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── 3. TOP PARTNERS TABLE ── */}
            {activeTab === 'partners' && (
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#141417]/50 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                    <th className="py-3 px-5 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Server</th>
                    <th className="py-3 px-4 text-right">Partners count</th>
                    <th className="py-3 px-4 text-right">Mentions sent</th>
                    <th className="py-3 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredItems.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openServerProfile(row.id)}
                      className="hover:bg-[#141417]/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5 text-center tabular-nums text-xs text-zinc-400 font-medium">
                        #{row.rank}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <ServerIcon
                            guildId={row.id}
                            iconUrl={row.icon}
                            name={row.name}
                            size="sm"
                            className="size-7 rounded-[8px] shrink-0"
                          />
                          <span className="font-medium text-white truncate max-w-[200px]">
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-zinc-200 tabular-nums">
                        {row.partnersCount || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400 tabular-nums">
                        {row.mentionsSent || 0}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] text-[10px] font-medium">
                          <span className="size-1 rounded-full bg-[var(--accent)]" />
                          {row.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── PAGINATION ── */}
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={totalCount || items.length}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

export default LeaderboardTab;
