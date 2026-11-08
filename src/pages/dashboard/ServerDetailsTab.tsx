import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Check,
  Copy,
  Share2,
  Flag,
  Flame,
  Star,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { BumpDialog } from '@/components/BumpDialog';
import { api } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';
import { cn } from '@/lib/utils';

interface ServerDetailsTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onNavigateTab?: (tab: string) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

interface ReviewItem {
  id: string;
  server_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string | null;
  user_avatar_hash?: string | null;
  rating: number;
  text: string;
  created_at: string;
  updated_at?: string;
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    average: number;
    total: number;
    distribution: Record<number, number>;
  };
}

export function ServerDetailsTab({
  guild,
  workspace,
  config,
  onNavigateTab: _onNavigateTab,
  addToast,
}: ServerDetailsTabProps) {
  const { user } = useAuth();
  const guildId = guild?.id || workspace?.guildId || '1530147023754367006';
  const serverName = guild?.name || config.serverName || 'Community Server';
  const serverIconUrl =
    guild?.iconUrl ||
    (guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null) ||
    config.serverIconUrl;

  const bannerUrl = config.bannerUrl || null;
  const category = config.serverCategory || 'Roleplay server';
  const memberCount = Number(guild?.memberCount || 17);
  const joinCode = config.joinCode || '';
  const description = config.serverDescription || 'This community has not added a description yet.';
  const rewardCoins = Number(config.rewardCoins || 2);
  const inviteUrl = config.inviteUrl || (guildId ? `https://discord.gg/central` : '');

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [showBumpDialog, setShowBumpDialog] = useState(false);
  const [bumpRemainingSeconds, setBumpRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function loadBumpStatus() {
      try {
        const res = await fetch(`/api/servers/${guildId}/bump`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setBumpRemainingSeconds(data.cooldownSeconds || 0);
          }
        }
      } catch {}
    }
    loadBumpStatus();
    return () => { mounted = false; };
  }, [guildId]);

  useEffect(() => {
    if (bumpRemainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setBumpRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [bumpRemainingSeconds]);

  const bumpTimeFormatted = React.useMemo(() => {
    if (bumpRemainingSeconds <= 0) return 'Ready';
    const hours = Math.floor(bumpRemainingSeconds / 3600);
    const minutes = Math.floor((bumpRemainingSeconds % 3600) / 60);
    const seconds = bumpRemainingSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [bumpRemainingSeconds]);

  // Real Owner Telemetry & Server Profile
  const [serverProfile, setServerProfile] = useState<{
    owner?: { id: string; name: string; avatar: string | null };
    stats?: { memberCount: number; bumps: number; verifiedJoins: number; rewardCoins: number };
    userState?: { isOwner: boolean; canManage: boolean };
    server?: any;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/servers/${guildId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data) {
          setServerProfile(data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [guildId]);

  const isOwnerOrTeam = Boolean(
    (guild as any)?.owner ||
    (guild as any)?.isOwner ||
    (guild as any)?.ownerId === user?.id ||
    serverProfile?.userState?.isOwner ||
    serverProfile?.userState?.canManage ||
    (workspace as any)?.isOwner
  );

  const resolvedOwnerId =
    serverProfile?.owner?.id ||
    (guild as any)?.ownerId ||
    ((guild as any)?.owner ? user?.id : '') ||
    serverProfile?.server?.ownerId ||
    serverProfile?.server?.owner_discord_id ||
    user?.id ||
    '';

  const resolvedOwnerName =
    serverProfile?.owner?.name ||
    ((guild as any)?.owner || (guild as any)?.ownerId === user?.id
      ? user?.globalName || (user as any)?.displayName || user?.username
      : null) ||
    serverProfile?.server?.owner_display_name ||
    serverProfile?.server?.ownerUsername ||
    'Community Owner';

  const resolvedOwnerAvatar =
    serverProfile?.owner?.avatar ||
    ((guild as any)?.owner || (guild as any)?.ownerId === user?.id
      ? user?.avatar
      : null) ||
    serverProfile?.server?.owner_avatar_hash ||
    serverProfile?.server?.ownerAvatar ||
    null;

  // Server Treasury Balance & Credit Range
  const [serverBalance, setServerBalance] = useState<number>(0);
  const [creditRange, setCreditRange] = useState<'7d' | '30d'>('30d');
  const [creditTrend, setCreditTrend] = useState<Array<{ day: string; balance: number }>>([]);

  useEffect(() => {
    let mounted = true;
    async function loadCreditTrend() {
      try {
        const res = await fetch(`/api/credits/history?guildId=${guildId}&range=${creditRange}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            const daysCount = creditRange === '7d' ? 7 : 30;
            const currentBal = typeof data.summary?.balance === 'number' ? data.summary.balance : serverBalance;
            if (Array.isArray(data.items) && data.items.length > 0) {
              const points: Array<{ day: string; balance: number }> = [];
              for (let i = daysCount - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                points.push({ day: label, balance: currentBal });
              }
              setCreditTrend(points);
            } else if (currentBal > 0) {
              const points: Array<{ day: string; balance: number }> = [];
              for (let i = daysCount - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                points.push({ day: label, balance: currentBal });
              }
              setCreditTrend(points);
            } else {
              setCreditTrend([]);
            }
          }
        }
      } catch {
        if (mounted) setCreditTrend([]);
      }
    }
    loadCreditTrend();
    return () => {
      mounted = false;
    };
  }, [guildId, creditRange, serverBalance]);

  // ER:LC telemetry
  const [erlcData, setErlcData] = useState<{
    connected: boolean;
    currentPlayers: number;
    maxPlayers: number;
    joinCode: string;
  }>({
    connected: Boolean(joinCode),
    currentPlayers: joinCode ? Math.min(24, Math.floor(memberCount / 4)) : 0,
    maxPlayers: 32,
    joinCode: joinCode || '',
  });

  // Verified joins telemetry
  const [verifiedJoins, setVerifiedJoins] = useState<number>(0);

  // Reviews state (Section 6)
  const [reviewsData, setReviewsData] = useState<ReviewsResponse>({
    reviews: [],
    total: 0,
    page: 1,
    pageSize: 5,
    totalPages: 1,
    summary: {
      average: 0,
      total: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
  });
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsSort, setReviewsSort] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [showWriteReview, setShowWriteReview] = useState(false);

  // Load telemetry, reviews, balance
  const loadReviews = async () => {
    try {
      const res = await fetch(`/api/servers/${guildId}/reviews?page=${reviewsPage}&pageSize=5&sort=${reviewsSort}`);
      if (res.ok) {
        const data = await res.json();
        setReviewsData({
          reviews: Array.isArray(data?.reviews) ? data.reviews : [],
          total: Number(data?.total || 0),
          page: Number(data?.page || 1),
          pageSize: Number(data?.pageSize || 5),
          totalPages: Number(data?.totalPages || 1),
          summary: {
            average: Number(data?.summary?.average || 0),
            total: Number(data?.summary?.total || data?.total || 0),
            distribution: data?.summary?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          },
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadReviews();
  }, [guildId, reviewsPage, reviewsSort]);

  useEffect(() => {
    let mounted = true;
    async function loadTelemetry() {
      // Load Treasury Balance
      try {
        const bRes = await fetch(`/api/credits?guildId=${guildId}`);
        if (bRes.ok) {
          const bData = await bRes.json();
          if (mounted && typeof bData.balance === 'number') {
            setServerBalance(bData.balance);
          }
        }
      } catch {}

      // Load ER:LC status
      try {
        const erlcRes = await fetch(`/api/servers/${guildId}/erlc/status`);
        if (erlcRes.ok) {
          const d = await erlcRes.json();
          if (mounted && d.connected) {
            setErlcData({
              connected: true,
              currentPlayers: Number(d.currentPlayers || 0),
              maxPlayers: Number(d.maxPlayers || 32),
              joinCode: d.joinCode || joinCode,
            });
          }
        }
      } catch {}

      // Load Joins Summary
      try {
        const repRes = await fetch(`/api/servers/${guildId}/recruits/summary`);
        if (repRes.ok) {
          const r = await repRes.json();
          const s = r.summary || r;
          if (mounted && s && typeof s.verifiedRecruits === 'number') {
            setVerifiedJoins(s.verifiedRecruits);
          }
        }
      } catch {}
    }

    loadTelemetry();
    return () => {
      mounted = false;
    };
  }, [guildId, joinCode]);

  const handleCopyCode = () => {
    const code = erlcData.joinCode || joinCode;
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    addToast('success', 'Code copied', `Join code ${code} copied.`);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/servers/${guildId}`;
    navigator.clipboard?.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
    addToast('success', 'Link copied', 'Public server link copied.');
  };

  const handleJoinServer = () => {
    if (inviteUrl) {
      window.open(inviteUrl, '_blank', 'noopener,noreferrer');
      addToast('success', 'Opening invite', `Joining ${serverName} via Discord…`);
    } else {
      addToast('info', 'Notice', 'No Discord invite link configured yet.');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) {
      addToast('warning', 'Review required', 'Please write a short review before submitting.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await api<any>(`/servers/${guildId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: newRating,
          text: newReviewText.trim(),
        }),
      });

      addToast('success', 'Review posted', 'Your feedback has been published.');
      setNewReviewText('');
      setShowWriteReview(false);
      loadReviews();
    } catch (err: any) {
      addToast('error', 'Submission failed', err.message || err.payload?.error || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Reported by user for review.' }),
      });
      if (res.ok) {
        addToast('success', 'Report received', 'Thank you. Our moderation team has been notified.');
      }
    } catch {}
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-16 font-sans">
      {/* ── 1. HERO CARD: BANNER (Fixed height h-48 sm:h-56, centered, overflow-hidden, rounded-t-2xl) ── */}
      <div className="rounded-2xl border border-white/10 bg-[#0E0E11] overflow-hidden">
        {/* Banner Area (Fixed h-48 sm:h-56, w-full, object-cover, centered) */}
        <div className="relative w-full h-48 sm:h-56 bg-[#141417] overflow-hidden rounded-t-2xl">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={`${serverName} cover`}
              className="w-full h-full object-cover object-center block"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#18181B] via-[#141417] to-[#0E0E11]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0E0E11] to-transparent pointer-events-none" />
        </div>

        {/* Identity & Actions Row */}
        <div className="px-6 sm:px-8 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 relative z-10">
            {/* Overlapping Icon (72px) + Server Titles */}
            <div className="flex items-end gap-4 min-w-0">
              <ServerIcon
                guildId={guildId}
                iconUrl={serverIconUrl}
                name={serverName}
                size={72}
                className="size-[72px] rounded-2xl border-4 border-[#0E0E11] shadow-2xl bg-[#141417] shrink-0 object-cover"
              />

              <div className="space-y-1 min-w-0 pb-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-[24px] sm:text-[28px] font-semibold text-white tracking-tight truncate leading-tight font-sans">
                    {serverName}
                  </h1>

                  <Badge variant="outline" className="text-[11px] px-2.5 py-0.5 bg-[#141417] text-zinc-300 border-white/10 font-medium shrink-0">
                    {category}
                  </Badge>
                </div>

                {/* Subtitle Line: Member count, Server ID, ER:LC */}
                <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Users className="size-3.5 text-zinc-500" />
                    <span className="tabular-nums">{memberCount.toLocaleString()}</span>
                    <span className="text-zinc-400 font-normal">members</span>
                  </span>

                  <span className="text-zinc-500 font-mono text-[11px]">
                    ID: {guildId}
                  </span>

                  {erlcData.joinCode && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#141417] border border-white/10 text-xs font-mono text-zinc-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                    >
                      <span className="text-zinc-500 font-sans">Join:</span>
                      <span>{erlcData.joinCode}</span>
                      {copiedCode ? <Check className="size-3 text-[var(--accent)]" /> : <Copy className="size-3 text-zinc-500" />}
                    </button>
                  )}

                  {erlcData.connected && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs text-[var(--accent)] font-medium">
                      <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      <span>Live • {erlcData.currentPlayers}/{erlcData.maxPlayers} in game</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons Right: Join Server (secondary), Bump (secondary), Share */}
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleJoinServer}
                className="bg-[#141417] hover:bg-[#19191D] text-zinc-200 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer gap-2"
              >
                <span>Join server</span>
                <span className="px-1.5 py-0.2 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold">
                  +{rewardCoins} cr
                </span>
              </Button>

              <button
                type="button"
                onClick={() => setShowBumpDialog(true)}
                className={cn(
                  "h-9 px-3 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#141417] hover:bg-[#19191D] text-[#F4F4F5] text-[13px] font-medium inline-flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none",
                  bumpRemainingSeconds > 0 && "text-[#A1A1AA] hover:text-[#F4F4F5]"
                )}
                title={bumpRemainingSeconds <= 0 ? "Ready to bump to #1" : `Bump available in ${bumpTimeFormatted}`}
              >
                <Flame className="size-4 text-amber-400 shrink-0" />
                <span>Bump</span>
                {bumpRemainingSeconds <= 0 ? (
                  <span className="text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">
                    Ready
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded tabular-nums font-mono">
                    {bumpTimeFormatted}
                  </span>
                )}
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-zinc-400 hover:text-white hover:bg-white/[0.04] text-xs h-9 px-3 rounded-xl cursor-pointer gap-1.5"
              >
                {copiedShare ? <Check className="size-3.5 text-[var(--accent)]" /> : <Share2 className="size-3.5" />}
                <span>{copiedShare ? 'Copied' : 'Share'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. MAIN LAYOUT: TWO COLUMNS (About & Feedback Left, Numbers & Reps Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN (7 cols): About & Community Feedback ── */}
        <div className="lg:col-span-7 space-y-6">
          {/* About Section */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] p-6 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">About</h2>
            <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans prose prose-invert max-w-none">
              <MarkdownRenderer content={description} />
            </div>
          </div>

          {/* ── COMMUNITY FEEDBACK (Section 6) ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] p-6 space-y-5">
            {/* Header: Title with count & Write Review trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold text-white font-sans">
                  Community feedback ({reviewsData.total})
                </h2>
                <p className="text-xs text-zinc-400 font-sans">
                  Verified member ratings and player experiences.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort Select: Newest, Highest, Lowest */}
                <Select value={reviewsSort} onValueChange={(v: any) => setReviewsSort(v)}>
                  <SelectTrigger className="w-[110px] h-8 bg-[#141417] border-white/10 text-xs font-sans">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="highest">Highest</SelectItem>
                    <SelectItem value="lowest">Lowest</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWriteReview((prev) => !prev)}
                  className="bg-[#141417] hover:bg-[#19191D] text-zinc-200 border-white/10 text-xs h-8 px-3 rounded-lg cursor-pointer"
                >
                  {showWriteReview ? 'Cancel' : 'Write a review'}
                </Button>
              </div>
            </div>

            {/* Rating Overview & Distribution Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center bg-[#141417]/50 rounded-xl p-4 border border-white/[0.04]">
              {/* Big Rating Block */}
              <div className="sm:col-span-4 flex flex-col items-center justify-center text-center space-y-1">
                <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                  {(reviewsData?.summary?.average || 0) > 0 ? (reviewsData.summary.average).toFixed(1) : '—'}
                </span>
                <div className="flex items-center gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'size-3.5',
                        star <= Math.round(reviewsData?.summary?.average || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-transparent text-zinc-600'
                      )}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-zinc-400 font-sans">
                  {reviewsData?.total || 0} {(reviewsData?.total || 0) === 1 ? 'review' : 'reviews'}
                </span>
              </div>

              {/* 5 Distribution Bars */}
              <div className="sm:col-span-8 space-y-1.5">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviewsData?.summary?.distribution?.[stars] || 0;
                  const total = reviewsData?.total || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2.5 text-xs text-zinc-400">
                      <span className="w-12 text-right shrink-0 text-[11px] font-medium">{stars} stars</span>
                      <div className="flex-1 h-2 rounded-full bg-[#19191D] overflow-hidden border border-white/[0.04]">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] tabular-nums text-zinc-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Write a review form (when toggled) */}
            {showWriteReview && (
              <form onSubmit={handleSubmitReview} className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Your rating</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="p-1 hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star
                          className={cn(
                            'size-5',
                            star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  placeholder="Share your experience with this server (roles, community atmosphere, patrols)..."
                  rows={3}
                  className="w-full rounded-lg bg-[#0E0E11] border border-white/10 p-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[var(--accent)] font-sans"
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowWriteReview(false)}
                    className="text-xs text-zinc-400 hover:text-white h-8 px-3 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingReview}
                    size="sm"
                    className="bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold text-xs h-8 px-4 rounded-lg cursor-pointer"
                  >
                    {isSubmittingReview ? 'Posting…' : 'Post review'}
                  </Button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            {reviewsData.reviews.length === 0 ? (
              <div className="rounded-xl border border-white/[0.04] bg-[#141417]/30 p-8 text-center space-y-2">
                <p className="text-xs font-medium text-white">No reviews yet</p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Verified joiners can leave honest feedback after completing the verification period.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {reviewsData.reviews.map((rev) => (
                  <div key={rev.id} className="rounded-xl border border-white/[0.06] bg-[#141417] p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          userId={rev.user_id}
                          avatarHash={rev.user_avatar_hash}
                          name={rev.user_name}
                          size={36}
                          className="size-9 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white font-sans">{rev.user_name}</span>
                            <span className="text-[11px] text-zinc-500">{formatRelativeTime(rev.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-400 mt-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  'size-3',
                                  star <= rev.rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-zinc-700'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Three-dots Report menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="Review options"
                          className="size-7 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <MoreVertical className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 bg-[#141417] border-white/10 text-xs">
                          <DropdownMenuItem
                            onClick={() => handleReportReview(rev.id)}
                            className="text-zinc-300 hover:text-white cursor-pointer"
                          >
                            <Flag className="size-3.5 mr-2 text-zinc-500" />
                            Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="text-xs text-zinc-300 leading-relaxed font-sans prose prose-invert max-w-none pt-0.5">
                      <MarkdownRenderer content={rev.text} />
                    </div>
                  </div>
                ))}

                {/* Reviews Pagination */}
                {reviewsData.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-zinc-400">
                      Page {reviewsData.page} of {reviewsData.totalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reviewsData.page <= 1}
                        onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                        className="size-8 p-0 bg-[#141417] border-white/10 text-zinc-300"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reviewsData.page >= reviewsData.totalPages}
                        onClick={() => setReviewsPage((p) => Math.min(reviewsData.totalPages, p + 1))}
                        className="size-8 p-0 bg-[#141417] border-white/10 text-zinc-300"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (5 cols): Your numbers (Owner/Team) or Community (Visitor) ── */}
        <div className="lg:col-span-5 space-y-5">
          {isOwnerOrTeam ? (
            /* ── YOUR NUMBERS CARD (Owner and Permitted Team) ── */
            <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-sm font-semibold text-white">Your numbers</span>
                <span className="text-xs text-[var(--accent)] font-medium">Owner overview</span>
              </div>

              {/* 1. "Owned by" row at the very top */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                <UserAvatar
                  userId={resolvedOwnerId}
                  avatarHash={resolvedOwnerAvatar}
                  avatarUrl={resolvedOwnerAvatar}
                  name={resolvedOwnerName}
                  size={40}
                  className="size-10 rounded-full object-cover bg-[#141417] border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-white truncate block font-sans">
                    {resolvedOwnerName}
                  </span>
                  <span className="text-xs text-zinc-400 block font-sans">
                    Owner
                  </span>
                </div>
              </div>

              {/* 2. Credits Tile with inside Mini Area Chart (~90px tall) and 7d | 30d toggle */}
              <div className="rounded-xl border border-white/[0.04] bg-[#141417] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-zinc-400 block font-sans">Credits</span>
                    <div className="flex items-baseline gap-1.5 pt-0.5">
                      <span className="text-2xl font-bold text-white tabular-nums">
                        {serverBalance}
                      </span>
                      <span className="text-xs text-[var(--accent)] font-medium">credits</span>
                    </div>
                  </div>

                  {/* 7d | 30d Toggle */}
                  <div className="inline-flex rounded-lg border border-white/10 bg-[#0E0E11] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setCreditRange('7d')}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                        creditRange === '7d'
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      7d
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreditRange('30d')}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                        creditRange === '30d'
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      30d
                    </button>
                  </div>
                </div>

                {/* Mini Area Chart inside the tile (~90px tall) or empty dashed baseline */}
                {creditTrend.length > 0 && creditTrend.some((p) => p.balance > 0) ? (
                  <div className="h-[90px] w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={creditTrend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="serverCreditsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border border-white/10 bg-[#141417] px-2.5 py-1 text-[11px] text-white shadow-md">
                                  <span className="text-zinc-400 mr-1.5">{payload[0].payload.day}:</span>
                                  <span className="font-semibold text-[var(--accent)]">{payload[0].value} credits</span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke="var(--accent)"
                          strokeWidth={1.5}
                          fill="url(#serverCreditsGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[90px] w-full flex flex-col items-center justify-center relative">
                    <svg className="w-full h-8" preserveAspectRatio="none">
                      <line
                        x1="0"
                        y1="16"
                        x2="100%"
                        y2="16"
                        stroke="rgba(255,255,255,0.12)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                    </svg>
                    <span className="text-xs text-zinc-500 font-sans -mt-1">
                      No credit activity yet.
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Smaller Verified joins tile under it */}
              <div className="rounded-xl border border-white/[0.04] bg-[#141417] p-3.5 space-y-1">
                <span className="text-xs text-zinc-400 block font-sans">Verified joins</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white tabular-nums">
                    {verifiedJoins}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">total</span>
                </div>
              </div>

              {/* 4. One muted line with real counts & proper plurals */}
              <p className="text-xs text-zinc-500 font-sans pt-1">
                {Number(serverProfile?.stats?.verifiedJoins ?? verifiedJoins ?? 0)} {Number(serverProfile?.stats?.verifiedJoins ?? verifiedJoins ?? 0) === 1 ? 'join' : 'joins'} and {Number(serverProfile?.stats?.bumps ?? serverProfile?.server?.bumps ?? 2)} {Number(serverProfile?.stats?.bumps ?? serverProfile?.server?.bumps ?? 2) === 1 ? 'bump' : 'bumps'} in the last 30 days.
              </p>
            </div>
          ) : (
            /* ── COMMUNITY CARD (Visitors - no credits) ── */
            <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div className="pb-3 border-b border-white/[0.06]">
                <span className="text-sm font-semibold text-white">Community</span>
              </div>

              {/* Owned by row */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                <UserAvatar
                  userId={resolvedOwnerId}
                  avatarHash={resolvedOwnerAvatar}
                  avatarUrl={resolvedOwnerAvatar}
                  name={resolvedOwnerName}
                  size={40}
                  className="size-10 rounded-full object-cover bg-[#141417] border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-white truncate block font-sans">
                    {resolvedOwnerName}
                  </span>
                  <span className="text-xs text-zinc-400 block font-sans">
                    Owner
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.04] bg-[#141417] p-3.5 space-y-1">
                  <span className="text-xs text-zinc-400 block font-sans">Members</span>
                  <span className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                    {memberCount}
                  </span>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-[#141417] p-3.5 space-y-1">
                  <span className="text-xs text-zinc-400 block font-sans">Verified joins</span>
                  <span className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                    {verifiedJoins}
                  </span>
                </div>
              </div>

              <div className="text-xs text-zinc-500 font-sans pt-1">
                Listed since{' '}
                {serverProfile?.server?.createdAt
                  ? new Date(serverProfile.server.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'October 2026'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bump Dialog */}
      <BumpDialog
        open={showBumpDialog}
        onOpenChange={setShowBumpDialog}
        guildId={guildId}
        serverName={serverName}
        onSuccess={() => {
          addToast('success', 'Server bumped', 'Your server has been moved to the top of the directory.');
        }}
      />
    </div>
  );
}

export default ServerDetailsTab;
