import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ExternalLink,
  Users,
  Check,
  Star,
  Flag,
  Globe,
  Share2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Trophy,
  Shield,
  Coins,
  Copy,
  Award,
  Sparkles,
  Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ServerDetails {
  id: string;
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  category: string;
  description: string;
  memberCount: number;
  inviteUrl: string;
  joinCode?: string | null;
  tags?: string[];
  is_premium?: boolean;
  isVerified?: boolean;
  verified?: boolean;
  leaderboardRank?: number;
  serverLevel?: number;
  showCredits?: boolean;
  serverCredits?: number | null;
  rewardCoins?: number;
  earnedBadges?: Array<{ id: string; label: string; description: string; color?: string }>;
  erlc?: {
    connected: boolean;
    currentPlayers: number | null;
    maxPlayers: number | null;
    staffInGame?: number;
    queueSize?: number;
    joinCode?: string;
    lastCheckedAt?: string | null;
    status: string;
    error?: string | null;
  } | null;
  pageSections?: string[];
  sectionVisibility?: Record<string, boolean>;
  socialLinks?: {
    discord?: string;
    roblox?: string;
    twitter?: string;
    website?: string;
  };
  showStaffList?: boolean;
  staffList?: Array<{ id?: string; role: string; username: string; displayName?: string; avatarUrl?: string | null }>;
  showPartnerList?: boolean;
  partnerList?: Array<{ id?: string; name: string; iconUrl?: string | null; memberCount?: number; link?: string; category?: string }>;
  customUrl?: string | null;
  owner_discord_id?: string | null;
  owner_display_name?: string | null;
  ownerAvatar?: string | null;
}

interface OwnerInfo {
  id?: string | null;
  name?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  avatar_hash?: string | null;
}

interface Review {
  id: string;
  user_id: string;
  user_name: string;
  display_name?: string;
  user_avatar?: string | null;
  rating: number;
  text: string;
  created_at: string;
}

function formatSecondsAgo(isoOrMs?: string | number | null): string {
  if (!isoOrMs) return 'updated just now';
  const ts = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 'updated just now';
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `updated ${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `updated ${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  return `updated ${Math.floor(diffMin / 60)} hour${Math.floor(diffMin / 60) === 1 ? '' : 's'} ago`;
}

export function PublicServerListingPage() {
  const { slug, customSlug } = useParams<{ slug?: string; customSlug?: string }>();
  const activeSlug = customSlug || slug || '';
  const { user } = useAuth();

  const [server, setServer] = useState<ServerDetails | null>(null);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'staff' | 'partners'>('overview');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<{ canReview: boolean; message?: string } | null>(null);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedSlug, setCopiedSlug] = useState<boolean>(false);
  const [badgesDialogOpen, setBadgesDialogOpen] = useState<boolean>(false);

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  const fetchServer = async () => {
    if (!activeSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(activeSlug)}`, { credentials: 'include' });
      if (!res.ok) {
        setError('Server not found in directory.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data?.server) {
        setError('Server not found in directory.');
        setLoading(false);
        return;
      }
      setServer(data.server);
      setOwner(data.owner || null);
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      if (data.ratingSummary) {
        setRatingSummary({
          average: Number(data.ratingSummary.average || 0),
          count: Number(data.ratingSummary.count || 0)
        });
      }
      if (data.userState?.reviewEligibility) {
        setReviewEligibility(data.userState.reviewEligibility);
      }
    } catch {
      setError('Could not load server page. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServer();
  }, [activeSlug]);

  const handleJoinServer = () => {
    if (!server) return;
    window.open(`/join/${encodeURIComponent(server.id)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShare = () => {
    const shareUrl = server?.customUrl
      ? `${window.location.origin}/${server.customUrl}`
      : `${window.location.origin}/servers/${server?.id || activeSlug}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySlug = () => {
    if (!server?.customUrl) return;
    const shareUrl = `${window.location.origin}/${server.customUrl}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server || !reviewText.trim()) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await apiFetch(`/api/servers/${encodeURIComponent(server.id)}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, text: reviewText.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit review.');
      }
      setReviewText('');
      fetchServer();
    } catch (err: any) {
      setReviewError(err.message || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!server || !reportReason.trim()) return;
    setSubmittingReport(true);
    try {
      const res = await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'server',
          targetId: server.id,
          serverName: server.name,
          reason: reportReason.trim()
        })
      });
      if (res.ok) {
        setReportSuccess(true);
        setReportReason('');
      }
    } catch {} finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background,#09090B)] text-[var(--foreground,#F4F4F5)] font-sans">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="w-full aspect-[3/1] max-h-[300px] rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="size-[112px] -mt-[40px] rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-7 w-64 rounded bg-[var(--surface,#121215)] animate-pulse" />
              <div className="h-4 w-40 rounded bg-[var(--surface,#121215)] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-[var(--background,#09090B)] text-[var(--foreground,#F4F4F5)] flex flex-col items-center justify-center px-4 font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="size-8 text-zinc-500 mx-auto" />
          <h1 className="text-xl font-bold text-[var(--foreground,#F4F4F5)]">Server not found</h1>
          <p className="text-sm text-zinc-400">
            {error || 'This community page does not exist or is not listed in the public directory.'}
          </p>
          <div className="pt-2">
            <Link
              to="/servers"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Browse Directory</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isVerified = Boolean(server.isVerified || server.verified);
  const isPremium = Boolean(server.is_premium);
  const joinReward = Number(server.rewardCoins) || (isPremium ? 5 : 2);
  const badges = Array.isArray(server.earnedBadges) ? server.earnedBadges : [];
  const tags = Array.isArray(server.tags) ? server.tags.filter(Boolean) : [];
  const vis = server.sectionVisibility || { about: true, erlc: true, reviews: true, badges: true, staff: true, partners: true };

  const ownerName = owner?.username || owner?.display_name || owner?.name || server.owner_display_name || null;
  const ownerId = owner?.id || server.owner_discord_id || null;
  const ownerAvatar = owner?.avatar || server.ownerAvatar || null;

  const hasStaff = Boolean(server.showStaffList && Array.isArray(server.staffList) && server.staffList.length > 0);
  const hasPartners = Boolean(server.showPartnerList && Array.isArray(server.partnerList) && server.partnerList.length > 0);
  const hasReviews = vis.reviews !== false;

  const officialLinks = [
    server.socialLinks?.discord || server.inviteUrl ? { label: 'Discord Server', url: server.socialLinks?.discord || server.inviteUrl } : null,
    server.socialLinks?.roblox ? { label: 'Roblox Group', url: server.socialLinks.roblox } : null,
    server.socialLinks?.website ? { label: 'Website', url: server.socialLinks.website } : null,
    server.socialLinks?.twitter ? { label: 'X / Twitter', url: server.socialLinks.twitter } : null
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  const showCreditsStat = server.showCredits !== false && server.serverCredits !== null && server.serverCredits !== undefined;

  return (
    <div className="min-h-screen bg-[var(--background,#09090B)] text-[var(--foreground,#F4F4F5)] font-sans pb-16">
      {/* Centered 1200px Container with Equal Side Padding */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6">
        {/* Top Breadcrumb Bar */}
        <div className="flex items-center justify-between gap-4 mb-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/servers" className="hover:text-white transition-colors inline-flex items-center gap-1.5 shrink-0">
              <ArrowLeft className="size-3.5" />
              <span>Directory</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 truncate max-w-[280px]">{server.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-[#121215] text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setReportSuccess(false);
                setReportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-[#121215] text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-colors cursor-pointer"
            >
              <Flag className="size-3.5" />
              <span>Report</span>
            </button>
          </div>
        </div>

        {/* Banner: Inside Page Width, Rounded Corners, 3:1 Ratio Capped at 300px High, Object-fit Cover */}
        <div className="w-full aspect-[3/1] max-h-[300px] rounded-2xl overflow-hidden bg-[#121215] border border-white/[0.08] relative">
          {server.bannerUrl ? (
            <img
              src={server.bannerUrl}
              alt={`${server.name} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#121215] flex items-center justify-center">
              <span className="text-xs text-zinc-600 select-none uppercase tracking-wider font-semibold">
                {server.category || 'ConnectingERLC Community'}
              </span>
            </div>
          )}
        </div>

        {/* Identity Row: Icon Overlaps Banner Bottom Edge by 40px, Always in Front */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2 sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 min-w-0 flex-1">
            {/* 112px Server Icon: rounded-2xl, object-fit cover, fully inside its frame */}
            <div className="size-[112px] -mt-[40px] relative z-20 shrink-0 rounded-2xl ring-4 ring-[var(--background,#09090B)] bg-[#121215] overflow-hidden shadow-xl flex items-center justify-center">
              <ServerIcon
                guildId={server.id}
                name={server.name}
                iconUrl={server.iconUrl || server.icon}
                size={112}
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>

            <div className="pt-2 sm:pt-4 min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white break-words leading-tight">
                  {server.name}
                </h1>
                {isVerified && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.08] border border-white/15 text-zinc-200">
                    Verified
                  </span>
                )}
                {isPremium && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
                    Premium
                  </span>
                )}
                {server.customUrl && (
                  <button
                    type="button"
                    onClick={handleCopySlug}
                    title="Click to copy custom short link"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                  >
                    <Link2 className="size-3 text-zinc-500" />
                    <span>/{server.customUrl}</span>
                    {copiedSlug ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-zinc-500" />}
                  </button>
                )}
              </div>

              {/* Chips: Category + Tags */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-zinc-300 font-medium">
                  {server.category || 'Roleplay Server'}
                </span>
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Join Button on the Right */}
          <div className="shrink-0 pt-2 sm:pt-0 flex items-center gap-3">
            <Button
              type="button"
              onClick={handleJoinServer}
              className="h-11 px-6 rounded-xl bg-[var(--accent,#F97316)] hover:opacity-95 text-white font-semibold text-sm inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Join Server</span>
              <span className="px-2 py-0.5 rounded-md bg-black/25 text-xs font-medium">
                +{joinReward} cr
              </span>
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats Strip Under Header: Four Large Numbers with Tabular Numerals & Small Line Icons */}
        <div
          className={cn(
            'grid gap-3.5 mt-8',
            showCreditsStat ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'
          )}
        >
          {/* 1. Members */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E11] p-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Members</span>
              <Users className="size-4 text-zinc-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
              {Number(server.memberCount || 0).toLocaleString()}
            </div>
          </div>

          {/* 2. Directory Rank */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E11] p-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Directory Rank</span>
              <Trophy className="size-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
              {server.leaderboardRank ? `#${server.leaderboardRank}` : '—'}
            </div>
          </div>

          {/* 3. Community Level */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E11] p-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Community Level</span>
              <Shield className="size-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
              Level {server.serverLevel || 1}
            </div>
          </div>

          {/* 4. Server Credits (only if enabled) */}
          {showCreditsStat && (
            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E11] p-4 space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium">Server Credits</span>
                <Coins className="size-4 text-[var(--accent)]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
                {Number(server.serverCredits).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Tabs Strip Under Stats Strip */}
        <div className="flex items-center gap-1 border-b border-white/[0.08] mt-8 pb-px overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-t',
              activeTab === 'overview'
                ? 'border-[var(--accent,#F97316)] text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            )}
          >
            Overview
          </button>

          {hasReviews && (
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-t',
                activeTab === 'reviews'
                  ? 'border-[var(--accent,#F97316)] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              Reviews {ratingSummary.count > 0 && `(${ratingSummary.count})`}
            </button>
          )}

          {hasStaff && (
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-t',
                activeTab === 'staff'
                  ? 'border-[var(--accent,#F97316)] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              Staff ({server.staffList?.length || 0})
            </button>
          )}

          {hasPartners && (
            <button
              type="button"
              onClick={() => setActiveTab('partners')}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-t',
                activeTab === 'partners'
                  ? 'border-[var(--accent,#F97316)] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              Partners ({server.partnerList?.length || 0})
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: OVERVIEW
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start mt-6 animate-in fade-in-50 duration-150">
            {/* ── MAIN COLUMN ── */}
            <div className="space-y-6 min-w-0">
              {/* About Section */}
              {vis.about !== false && (
                <section className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-6 space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">About</h2>
                  {server.description ? (
                    <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert max-w-none">
                      <MarkdownRenderer content={server.description} />
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No description provided.</p>
                  )}
                </section>
              )}

              {/* Badges Row: Small shield shapes with line icons & tooltip (no emojis, max 6 + View all) */}
              {vis.badges !== false && badges.length > 0 && (
                <section className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                      Earned Badges
                    </h2>
                    {badges.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setBadgesDialogOpen(true)}
                        className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        View all ({badges.length})
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {badges.slice(0, 6).map((b) => (
                      <div
                        key={b.id}
                        title={b.description}
                        className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#141418] hover:border-white/20 transition-colors select-none"
                      >
                        <Shield className="size-3.5 text-[var(--accent)] shrink-0" />
                        <span className="text-xs font-medium text-zinc-200">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Live In-Game Block (Only when an ER:LC key is saved) */}
              {server.erlc && vis.erlc !== false && (
                <section className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                      Live In-Game Status
                    </h2>
                    {server.erlc.status === 'connected' && server.erlc.currentPlayers !== null && (
                      <span className="text-xs text-zinc-400 inline-flex items-center gap-1">
                        <Clock className="size-3 text-zinc-500" />
                        <span>{formatSecondsAgo(server.erlc.lastCheckedAt)}</span>
                      </span>
                    )}
                  </div>

                  {server.erlc.status === 'connected' && server.erlc.currentPlayers !== null ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                            {server.erlc.currentPlayers}
                            <span className="text-base font-normal text-zinc-500">
                              {' '}/ {server.erlc.maxPlayers || 40}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">Players in game</div>
                        </div>

                        <div>
                          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                            {Number(server.erlc.staffInGame || 0)}
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">Staff in game</div>
                        </div>

                        <div>
                          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                            {Number(server.erlc.queueSize || 0)}
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">Queue size</div>
                        </div>
                      </div>

                      {/* Thin Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent,#F97316)] rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((Number(server.erlc.currentPlayers) || 0) /
                                  Math.max(1, Number(server.erlc.maxPlayers) || 40)) *
                                  100
                              )
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-xs text-zinc-400">
                      Live status unavailable
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* ── SIDE COLUMN (340px) ── */}
            <aside className="w-full lg:w-[340px] space-y-6">
              {/* Owner Card */}
              <div className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Server Owner
                </h3>
                {ownerName || ownerId ? (
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      userId={ownerId || undefined}
                      avatarUrl={ownerAvatar}
                      name={ownerName || 'Owner'}
                      size={44}
                      className="rounded-full shrink-0 ring-2 ring-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {ownerName || `User ${String(ownerId).slice(0, 6)}`}
                      </div>
                      <div className="text-xs text-zinc-400">Community Founder</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Owner information unavailable</p>
                )}
              </div>

              {/* Official Links */}
              {officialLinks.length > 0 && (
                <div className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Official Links
                  </h3>
                  <div className="space-y-2">
                    {officialLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.06] bg-[#141418] hover:border-white/20 transition-colors text-xs text-zinc-300 hover:text-white"
                      >
                        <span className="font-medium">{link.label}</span>
                        <ExternalLink className="size-3 text-zinc-500" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: REVIEWS
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'reviews' && hasReviews && (
          <div className="mt-6 space-y-6 animate-in fade-in-50 duration-150">
            <section className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Community Reviews</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Real feedback from verified Discord members</p>
                </div>
                {ratingSummary.count > 0 && (
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-white">
                      {ratingSummary.average.toFixed(1)} / 5.0
                    </div>
                    <div className="text-xs text-zinc-400">{ratingSummary.count} reviews</div>
                  </div>
                )}
              </div>

              {/* Review Form for eligible signed-in users */}
              {user && reviewEligibility?.canReview && (
                <form onSubmit={handleSubmitReview} className="space-y-3 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300">Your rating</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 cursor-pointer"
                          aria-label={`Rate ${star} stars`}
                        >
                          <Star
                            className={cn(
                              'size-4',
                              star <= reviewRating
                                ? 'fill-current text-[var(--accent,#F97316)]'
                                : 'text-zinc-600'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Share your experience in this community..."
                    className="w-full rounded-xl bg-[#09090B] border border-white/[0.08] p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={submittingReview || !reviewText.trim()}
                      className="h-9 px-4 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 cursor-pointer"
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <p className="text-sm font-medium text-zinc-300">No reviews yet</p>
                  <p className="text-xs text-zinc-500">
                    Members who join and stay in this server can leave a verified review.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-white/[0.06]">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            userId={rev.user_id}
                            avatarUrl={rev.user_avatar}
                            name={rev.display_name || rev.user_name}
                            size={32}
                            className="rounded-full shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {rev.display_name || rev.user_name}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {new Date(rev.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={cn(
                                'size-3.5',
                                idx < rev.rating
                                  ? 'fill-current text-[var(--accent,#F97316)]'
                                  : 'text-zinc-700'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed break-words">{rev.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 3: STAFF
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'staff' && hasStaff && (
          <div className="mt-6 animate-in fade-in-50 duration-150">
            <section className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">Staff Team</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Verified server management and administration</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {server.staffList!.map((member, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/[0.06] bg-[#141418] flex items-center gap-3"
                  >
                    <UserAvatar
                      userId={member.id}
                      avatarUrl={member.avatarUrl}
                      name={member.displayName || member.username}
                      size={36}
                      className="rounded-full shrink-0 ring-1 ring-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">
                        {member.displayName || member.username}
                      </div>
                      <div className="text-[11px] text-[var(--accent)] font-medium truncate">
                        {member.role || 'Staff'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 4: PARTNERS
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'partners' && hasPartners && (
          <div className="mt-6 animate-in fade-in-50 duration-150">
            <section className="rounded-2xl bg-[#0E0E11] border border-white/[0.08] p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">Affiliated Communities</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Official server alliances and mutual partners</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {server.partnerList!.map((partner, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/[0.06] bg-[#141418] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ServerIcon
                        serverId={partner.id}
                        name={partner.name}
                        iconUrl={partner.iconUrl}
                        size={36}
                        className="rounded-xl shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{partner.name}</div>
                        {partner.memberCount ? (
                          <div className="text-[11px] text-zinc-400">
                            {partner.memberCount.toLocaleString()} members
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {partner.link && (
                      <a
                        href={partner.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[11px] font-medium text-zinc-300 hover:text-white hover:border-white/20 transition-colors shrink-0"
                      >
                        Visit
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Badges Dialog: "View all" */}
      <Dialog open={badgesDialogOpen} onOpenChange={setBadgesDialogOpen}>
        <DialogContent className="max-w-[480px] bg-[#0E0E11] border border-white/[0.1] rounded-2xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="size-4 text-[var(--accent)]" />
              <span>Earned Community Badges</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Verified badges awarded to {server.name} based on platform activity and achievements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            {badges.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl border border-white/[0.06] bg-[#141418] flex items-start gap-3"
              >
                <div className="size-8 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="size-4 text-[var(--accent)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white">{b.label}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{b.description}</div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBadgesDialogOpen(false)}
              className="text-xs border-white/10 text-zinc-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-[420px] bg-[#0E0E11] border border-white/[0.1] rounded-2xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Flag className="size-4 text-red-400" />
              <span>Report Community</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Help keep the directory safe. Reports are audited by staff.
            </DialogDescription>
          </DialogHeader>

          {reportSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              Thank you. Your report has been submitted for administrative review.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Reason</label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe the issue (e.g. invalid invite, inappropriate content, fake community)..."
                  className="w-full rounded-xl bg-[#09090B] border border-white/[0.08] p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReportModalOpen(false)}
              className="text-xs border-white/10 text-zinc-300"
            >
              {reportSuccess ? 'Close' : 'Cancel'}
            </Button>
            {!reportSuccess && (
              <Button
                type="button"
                disabled={submittingReport || !reportReason.trim()}
                onClick={handleSubmitReport}
                className="text-xs bg-red-600 hover:bg-red-500 text-white font-semibold"
              >
                {submittingReport ? 'Submitting...' : 'Send Report'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PublicServerListingPage;
