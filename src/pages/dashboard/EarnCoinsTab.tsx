import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Users,
  ShieldCheck,
  Check,
  Clock,
  Compass,
  Coins,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DirectoryCard, type DirectoryServerData } from '@/components/ui/directory-card';
import { ServerProfileModal, openServerProfile } from '@/components/ServerProfileModal';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { BugReportBanner } from '@/components/BugReportBanner';
import { EarnCreditsSkeleton } from '@/components/ui/custom-skeletons';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { fetchDirectoryServers, claimDirectoryBounty, api } from '@/lib/api';

export interface PromotedServer {
  id: string;
  name: string;
  icon: string | null;
  category: string;
  categories?: string[];
  language?: string;
  description: string;
  summary?: string;
  tags: string[];
  rewardCoins: number;
  inviteUrl: string;
  verified?: boolean;
  createdAt?: number;
  lastBumpedAt?: number;
  bannerUrl?: string;
  memberCount?: number;
  joinCode?: string | null;
}

export interface UserJoinRecord {
  serverId: string;
  serverName: string;
  joinedAt: number;
  retentionHours: number;
  status: 'verifying' | 'verified' | 'reversed' | 'joined' | 'left';
  reward: number;
  claimed?: boolean;
}

interface EarnCoinsTabProps {
  currentGuildId?: string;
  workspace?: any;
  onNavigateTab?: (tab: string) => void;
  onAddCoins?: (amount: number) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

export const DIRECTORY_CATEGORIES = [
  'All',
  'Design server',
  'Roleplay server',
  'Misc',
  'COTS',
  'Departments',
  'Events'
] as const;

export function getResolvedServerIcon(server?: { id?: string; icon?: string | null; iconUrl?: string | null } | null): string | null {
  if (!server) return null;
  const raw = (server as any).iconUrl || server.icon;
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  return `https://cdn.discordapp.com/icons/${server.id}/${raw}.${raw.startsWith('a_') ? 'gif' : 'png'}?size=128`;
}

export function EarnCoinsTab({
  currentGuildId,
  addToast,
  onNavigateTab
}: EarnCoinsTabProps) {
  const { user } = useAuth();

  const [promotedServers, setPromotedServers] = useState<PromotedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'bump' | 'members_desc' | 'members_asc'>('bump');
  const [isJoinedOpen, setIsJoinedOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('connectingerlc_joined_open') === 'true';
    } catch {
      return false;
    }
  });

  const toggleJoinedOpen = () => {
    setIsJoinedOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('connectingerlc_joined_open', String(next));
      } catch {}
      return next;
    });
  };

  const [currentPage, setCurrentPage] = useState<number>(() => {
    try {
      const p = Number(new URLSearchParams(window.location.search).get('page'));
      return !isNaN(p) && p > 0 ? p : 1;
    } catch {
      return 1;
    }
  });
  const pageSize = 20;
  const [joinedPage, setJoinedPage] = useState<number>(1);

  // Selected server for modal popup (?server={slug})
  const [selectedServerForModal, setSelectedServerForModal] = useState<PromotedServer | null>(null);

  // Track joined servers with 72h retention timestamps
  const [userJoins, setUserJoins] = useState<Record<string, UserJoinRecord>>(() => {
    try {
      const raw = localStorage.getItem('connectingerlc_user_joins');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Array of joined communities for List 1
  const joinedServersList = useMemo(() => {
    const list: (UserJoinRecord & { iconUrl?: string | null; category?: string; verified?: boolean })[] = [];
    for (const [id, rec] of Object.entries(userJoins)) {
      const match = promotedServers.find(s => String(s.id) === String(id));
      list.push({
        ...rec,
        serverName: rec.serverName || match?.name || `Server (${id})`,
        iconUrl: match ? getResolvedServerIcon(match) : null,
        category: match?.category || 'Roleplay Server',
        verified: match?.verified
      });
    }
    // Clean list of joined communities from actual records

    list.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
    return list;
  }, [userJoins, promotedServers]);

  const paginatedJoined = useMemo(() => {
    const start = (joinedPage - 1) * pageSize;
    return joinedServersList.slice(start, start + pageSize);
  }, [joinedServersList, joinedPage, pageSize]);

  // Load directory servers
  const loadServers = async () => {
    setLoading(true);
    const start = Date.now();
    try {
      const live = await fetchDirectoryServers();
      if (Array.isArray(live) && live.length > 0) {
        setPromotedServers(live);
        localStorage.setItem('erlcus_promoted_servers', JSON.stringify(live));
      } else {
        const cached = localStorage.getItem('erlcus_promoted_servers');
        if (cached) {
          setPromotedServers(JSON.parse(cached));
        }
      }
    } catch {
      const cached = localStorage.getItem('erlcus_promoted_servers');
      if (cached) {
        try {
          setPromotedServers(JSON.parse(cached));
        } catch {}
      }
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 300 - elapsed);
      setTimeout(() => setLoading(false), delay);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  // Sync user's joined communities live from backend (Point B1)
  useEffect(() => {
    let active = true;
    if (user?.id) {
      api<{ joined: any[] }>('/user/joined-communities').then((res) => {
        if (!active || !Array.isArray(res?.joined)) return;
        const map: Record<string, UserJoinRecord> = {};
        for (const item of res.joined) {
          map[item.serverId] = {
            serverId: item.serverId,
            serverName: item.serverName,
            joinedAt: item.joinedAt,
            retentionHours: 72,
            status: item.status?.toLowerCase() === 'joined' ? 'verified' : (item.status?.toLowerCase() as any),
            reward: item.reward || 2,
            claimed: item.status?.toLowerCase() === 'joined'
          };
        }
        if (Object.keys(map).length > 0) {
          setUserJoins((prev) => ({ ...prev, ...map }));
        }
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [user?.id]);

  // Check ?server={slug} on load and URL change
  useEffect(() => {
    if (promotedServers.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('server');
    if (slug) {
      const matched = promotedServers.find((s) => String(s.id) === slug);
      if (matched) {
        setSelectedServerForModal(matched);
      }
    }
  }, [promotedServers]);

  const handleJoinServer = async (server: DirectoryServerData | PromotedServer) => {
    if (currentGuildId && server.id === currentGuildId) {
      addToast('warning', 'Action not allowed', 'You cannot earn credits by joining your own server.');
      return;
    }

    if (!server.inviteUrl) {
      addToast('warning', 'Invite unavailable', 'This server has not configured a Discord invite link yet.');
      return;
    }

    try {
      const redirectUrl = `/discovery/${server.id}/invite`;
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');

      const res = await api<any>(`/servers/${server.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ recipientServerId: currentGuildId || undefined })
      }).catch(() => null);

      if (res?.verifiable === false) {
        addToast('warning', 'Unverifiable Server', "Joins can't be verified because the bot is not present in this server.");
      } else {
        addToast('success', 'Invite Opened', `Joined ${server.name}! Stay in the server to receive your reward once the bot verifies your stay.`);
      }

      const record: UserJoinRecord = {
        serverId: server.id,
        serverName: server.name,
        joinedAt: Date.now(),
        retentionHours: 2 / 60,
        status: 'verifying',
        reward: server.rewardCoins || 2,
        claimed: false,
      };

      const updatedJoins = { ...userJoins, [server.id]: record };
      setUserJoins(updatedJoins);
      localStorage.setItem('connectingerlc_user_joins', JSON.stringify(updatedJoins));
    } catch (err: any) {
      addToast('error', 'Join failed', err?.message || 'Could not initiate join.');
    }
  };

  // Filter & Sort
  const filteredServers = useMemo(() => {
    let list = promotedServers.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)));

      const matchesCat =
        selectedCategory === 'All' ||
        s.category?.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });

    list.sort((a, b) => {
      if (sortBy === 'members_asc') {
        return (a.memberCount || 0) - (b.memberCount || 0);
      }
      if (sortBy === 'members_desc') {
        return (b.memberCount || 0) - (a.memberCount || 0);
      }
      // 'bump' (default): valid invites first, sorted by most recent bump; unknown next, expired last (Point B3)
      const getRank = (s: any) => {
        const st = String(s.invite_status || 'unknown').toLowerCase();
        if (st === 'valid') return 0;
        if (st === 'expired') return 2;
        return 1;
      };
      const rankA = getRank(a);
      const rankB = getRank(b);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA !== 2) {
        const featA = (a as any).isFeaturedSpot ? 1 : 0;
        const featB = (b as any).isFeaturedSpot ? 1 : 0;
        if (featA !== featB) return featB - featA;
      }
      const timeA = Number(a.lastBumpedAt || a.createdAt || 0);
      const timeB = Number(b.lastBumpedAt || b.createdAt || 0);
      return timeB - timeA;
    });

    return list;
  }, [promotedServers, search, selectedCategory, sortBy]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, sortBy]);

  // Paginated servers
  const paginatedServers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredServers.slice(startIndex, startIndex + pageSize);
  }, [filteredServers, currentPage, pageSize]);

  // Featured servers with active Featured boost
  const featuredServers = useMemo(() => {
    return promotedServers.filter((s: any) => Boolean(s.isFeaturedSpot));
  }, [promotedServers]);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-12rem)] space-y-6 w-full max-w-[1240px] mx-auto pb-8 font-sans">
      {/* Top Banner mounted globally by AppShell on all dashboard tabs: <BugReportBanner /> */}
      {/* ── LIST 1: YOUR JOINED COMMUNITIES (Point B1: Collapsible section, closed by default, remember choice) ── */}
      {joinedServersList.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-4 space-y-3.5">
          <button
            type="button"
            onClick={toggleJoinedOpen}
            className="w-full flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2.5">
              <ChevronDown
                className={`size-4 text-zinc-400 transition-transform duration-200 ${
                  isJoinedOpen ? 'rotate-180' : ''
                }`}
              />
              <h2 className="text-sm font-semibold text-white group-hover:text-zinc-200 transition-colors">
                Your Joined Communities
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#141417] border border-white/10 text-xs font-mono text-zinc-400">
                {joinedServersList.length}
              </span>
            </div>
            <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
              {isJoinedOpen ? 'Click to hide' : 'Click to expand'}
            </span>
          </button>

          {isJoinedOpen && (
            <div className="pt-2 space-y-3">
              <div className="divide-y divide-white/5 border border-white/5 rounded-lg overflow-hidden bg-[#141417]">
                {paginatedJoined.map((join) => {
                  const match = promotedServers.find((s) => String(s.id) === String(join.serverId));
                  const iconUrl = join.iconUrl || (match ? getResolvedServerIcon(match) : null);
                  const rawStatus = String(join.status || 'verifying').toLowerCase();

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="size-3" />
                      Verifying
                    </span>
                  );

                  if (rawStatus === 'joined' || rawStatus === 'verified') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="size-3" />
                        Joined
                      </span>
                    );
                  } else if (rawStatus === 'left') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-white/10">
                        Left
                      </span>
                    );
                  } else if (rawStatus === 'not confirmed' || rawStatus === 'not_confirmed' || rawStatus === 'left_early') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        Not confirmed
                      </span>
                    );
                  }

                  return (
                    <div
                      key={join.serverId}
                      className="flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ServerIcon
                          iconUrl={iconUrl}
                          name={join.serverName}
                          size="md"
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {join.serverName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Joined {new Date(join.joinedAt || Date.now()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>

              {joinedServersList.length > pageSize && (
                <Pagination
                  page={joinedPage}
                  pageSize={pageSize}
                  total={joinedServersList.length}
                  onPageChange={setJoinedPage}
                  syncUrl={false}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LIST 2: DIRECTORY LISTINGS (Available Communities, 10 per page) ── */}
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by server name, description or tag…"
              className="pl-9 h-10 text-[13px] bg-[#0E0E11] border-[rgba(255,255,255,0.07)] focus:border-[rgba(255,255,255,0.13)] font-sans"
            />
          </div>

          {/* Sort Dropdown: "Recently bumped" (default), "Most members", "Fewest members" */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] text-[#A1A1AA] hidden sm:inline font-sans">Sort:</span>
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-[170px] h-9 bg-[#141417] border-[rgba(255,255,255,0.07)] text-[13px] font-sans">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bump">Recently bumped</SelectItem>
                <SelectItem value="members_desc">Most members</SelectItem>
                <SelectItem value="members_asc">Fewest members</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {DIRECTORY_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer font-sans ${
                  isSelected
                    ? 'bg-[#141417] text-[#F4F4F5] border border-[rgba(255,255,255,0.13)] shadow-xs'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#141417]/50 border border-transparent'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TWO-COLUMN WRAPPER: Main List on Left, Sticky Featured Panel on Right (Above on Mobile) ── */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        {/* Main Left Column */}
        <div className="flex-1 w-full min-w-0 space-y-6">
          {loading ? (
            <EarnCreditsSkeleton />
          ) : filteredServers.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-12 text-center">
              <p className="text-sm font-medium text-white mb-1">No servers found in this category</p>
              <p className="text-xs text-zinc-400 mb-4">No communities match your current search and category filters.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                }}
                className="bg-[#272727] text-zinc-200 border-white/10 text-xs h-8 px-3 rounded-lg cursor-pointer"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Restored 2-column Grid (1 column on mobile, 2 on tablet/desktop) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedServers.map((server) => {
                  const isOwnServer = currentGuildId && String(server.id) === String(currentGuildId);
                  const userJoin = userJoins[server.id];
                  const isVerifying = Boolean(userJoin && userJoin.status === 'verifying');
                  const isVerified = Boolean(userJoin && (userJoin.status === 'verified' || userJoin.status === 'joined'));
                  const iconUrl = getResolvedServerIcon(server);

                  const cardData: DirectoryServerData = {
                    id: server.id,
                    name: server.name,
                    icon: iconUrl,
                    iconUrl: iconUrl,
                    category: server.category,
                    description: server.description,
                    summary: server.summary,
                    tags: server.tags,
                    bannerUrl: server.bannerUrl,
                    memberCount: server.memberCount,
                    verified: server.verified,
                    is_premium: (server as any).is_premium,
                    isFeaturedSpot: (server as any).isFeaturedSpot,
                    isHighlighted: (server as any).isHighlighted,
                    invite_status: (server as any).invite_status,
                    bot_in_guild: (server as any).bot_in_guild,
                    inviteUrl: server.inviteUrl,
                    rewardCoins: server.rewardCoins,
                    erlc: (server as any).erlc || null,
                  };

                  return (
                    <DirectoryCard
                      key={server.id}
                      server={cardData}
                      rewardCoins={server.rewardCoins || 2}
                      isOwnServer={Boolean(isOwnServer)}
                      isJoined={isVerified}
                      isVerifying={isVerifying}
                      onJoin={handleJoinServer}
                      onClick={() => openServerProfile(server.id, server)}
                    />
                  );
                })}
              </div>

              {/* Pagination: Always visible outside and below list */}
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                total={filteredServers.length}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* Right Column: Featured Panel (Sticky on Desktop, Above List on Mobile) */}
        <div className="w-full lg:w-[320px] lg:sticky lg:top-6 shrink-0 order-first lg:order-last">
          <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-4 space-y-3 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 font-sans">
                <Sparkles className="size-3.5 text-amber-400" />
                Featured
              </h2>
              {featuredServers.length > 0 && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  {featuredServers.length} active
                </span>
              )}
            </div>

            {featuredServers.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-lg border border-dashed border-white/5 bg-[#141417]/50">
                <p className="text-xs text-zinc-400 font-medium">No featured communities</p>
                <p className="text-[11px] text-zinc-500 mt-1">Servers with an active Featured boost appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {featuredServers.map((server) => {
                  const isOwnServer = currentGuildId && String(server.id) === String(currentGuildId);
                  const userJoin = userJoins[server.id];
                  const isVerifying = Boolean(userJoin && userJoin.status === 'verifying');
                  const isVerified = Boolean(userJoin && (userJoin.status === 'verified' || userJoin.status === 'joined'));
                  const iconUrl = getResolvedServerIcon(server);

                  return (
                    <div
                      key={`featured-panel-${server.id}`}
                      className="p-2.5 rounded-lg border border-white/5 bg-[#141417] hover:border-white/10 transition-colors flex items-center justify-between gap-3"
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                        onClick={() => openServerProfile(server.id, server)}
                      >
                        <ServerIcon
                          iconUrl={iconUrl}
                          name={server.name}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate hover:underline">
                            {server.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            {server.category || 'Roleplay Server'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={Boolean(isOwnServer) || isVerifying || isVerified}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinServer(server);
                        }}
                        className={`h-7 px-2.5 text-xs font-medium shrink-0 rounded-md cursor-pointer ${
                          isVerified
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isVerifying
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : isOwnServer
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                      >
                        {isVerified ? 'Joined' : isVerifying ? 'Verifying' : isOwnServer ? 'Your Server' : `Join +${server.rewardCoins || 2}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
