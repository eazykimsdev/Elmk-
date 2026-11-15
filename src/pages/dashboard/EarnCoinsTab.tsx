import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Users,
  ShieldCheck,
  Check,
  Clock,
  Compass,
  Coins
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
  status: 'verifying' | 'verified' | 'reversed';
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
  const [sortBy, setSortBy] = useState<'members_desc' | 'members_asc'>('members_desc');
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
    try {
      const legacyRaw = localStorage.getItem('erlcus_joined_servers');
      const legacyMap = legacyRaw ? JSON.parse(legacyRaw) : {};
      for (const [id, val] of Object.entries(legacyMap)) {
        if (!userJoins[id] && val) {
          const match = promotedServers.find(s => String(s.id) === String(id));
          list.push({
            serverId: id,
            serverName: match?.name || `Server (${id})`,
            iconUrl: match ? getResolvedServerIcon(match) : null,
            category: match?.category || 'Roleplay Server',
            joinedAt: Date.now() - 3600000,
            retentionHours: 0.033,
            status: 'verified',
            reward: match?.rewardCoins || 2,
            claimed: true,
            verified: match?.verified
          });
        }
      }
    } catch {}

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
      return (b.memberCount || 0) - (a.memberCount || 0);
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

  return (
    <div className="flex flex-col min-h-[calc(100dvh-12rem)] space-y-6 w-full max-w-[1120px] mx-auto pb-8 font-sans">
      {/* Top Banner mounted globally by AppShell on all dashboard tabs: <BugReportBanner /> */}
      {/* ── LIST 1: YOUR JOINED COMMUNITIES (Point 2: Redesigned clean, 10 per page, matching style) ── */}
      {joinedServersList.length > 0 && (
        <div className="space-y-3.5 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Your Joined Communities</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#141417] border border-white/10 text-xs font-mono text-zinc-400">
                {joinedServersList.length}
              </span>
            </div>
            <span className="text-xs text-zinc-500 hidden sm:inline">2-minute retention verification</span>
          </div>

          {/* Restored 2-column Grid (1 column on mobile, 2 from 900px) */}
          <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-4">
            {paginatedJoined.map((join) => {
              const match = promotedServers.find(s => String(s.id) === String(join.serverId));
              const iconUrl = join.iconUrl || (match ? getResolvedServerIcon(match) : null);
              const cardData: DirectoryServerData = {
                id: join.serverId,
                name: join.serverName,
                icon: iconUrl,
                iconUrl: iconUrl,
                category: join.category,
                description: match?.description,
                summary: match?.summary,
                tags: match?.tags,
                bannerUrl: match?.bannerUrl,
                memberCount: match?.memberCount,
                verified: join.verified,
                rewardCoins: join.reward || 2,
              };
              return (
                <DirectoryCard
                  key={join.serverId}
                  server={cardData}
                  rewardCoins={join.reward || 2}
                  isJoined={true}
                  onClick={() => openServerProfile(join.serverId, match)}
                />
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

          {/* Sort Dropdown: ONLY "Most members" (default) and "Fewest members" */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] text-[#A1A1AA] hidden sm:inline font-sans">Sort:</span>
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-[160px] h-9 bg-[#141417] border-[rgba(255,255,255,0.07)] text-[13px] font-sans">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
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

      {/* Directory List or Skeleton */}
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
          {/* Restored 2-column Grid (1 column on mobile, 2 from 900px) - 10 rows per page */}
          <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-4">
            {paginatedServers.map((server) => {
              const isOwnServer = currentGuildId && String(server.id) === String(currentGuildId);
              const userJoin = userJoins[server.id];
              const isVerifying = userJoin && userJoin.status === 'verifying';
              const isVerified = userJoin && userJoin.status === 'verified';
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
                inviteUrl: server.inviteUrl,
                rewardCoins: server.rewardCoins,
                erlc: server.joinCode ? {
                  connected: true,
                  currentPlayers: Math.min(24, Math.floor((server.memberCount || 10) / 4)),
                  maxPlayers: 32,
                } : null,
              };

              return (
                <DirectoryCard
                  key={server.id}
                  server={cardData}
                  rewardCoins={server.rewardCoins || 2}
                  isOwnServer={Boolean(isOwnServer)}
                  isJoined={Boolean(userJoin || isVerified || isVerifying)}
                  isVerifying={false}
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
  );
}
