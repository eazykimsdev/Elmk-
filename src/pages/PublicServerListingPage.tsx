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
  ArrowLeft
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
  partnerList?: Array<{ id?: string; name: string; iconUrl?: string | null; memberCount?: number; link?: string }>;
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

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<{ canReview: boolean; message?: string } | null>(null);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showAllBadges, setShowAllBadges] = useState<boolean>(false);

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
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="w-full aspect-[3/1] max-h-[280px] rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="size-[88px] -mt-8 rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] animate-pulse" />
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
  const visibleBadges = showAllBadges ? badges : badges.slice(0, 4);
  const tags = Array.isArray(server.tags) ? server.tags.filter(Boolean) : [];
  const vis = server.sectionVisibility || { about: true, erlc: true, reviews: true, badges: true, staff: true, partners: true };

  const ownerName = owner?.username || owner?.display_name || owner?.name || server.owner_display_name || null;
  const ownerId = owner?.id || server.owner_discord_id || null;
  const ownerAvatar = owner?.avatar || server.ownerAvatar || null;

  const officialLinks = [
    server.socialLinks?.discord || server.inviteUrl ? { label: 'Discord Community', url: server.socialLinks?.discord || server.inviteUrl } : null,
    server.socialLinks?.roblox ? { label: 'Roblox Group', url: server.socialLinks.roblox } : null,
    server.socialLinks?.website ? { label: 'Official Website', url: server.socialLinks.website } : null,
    server.socialLinks?.twitter ? { label: 'X / Social', url: server.socialLinks.twitter } : null
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  return (
    <div className="min-h-screen bg-[var(--background,#09090B)] text-[var(--foreground,#F4F4F5)] font-sans pb-16">
      {/* Centered 1100px Container with Equal Side Padding */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6">
        {/* Top Breadcrumb Bar */}
        <div className="flex items-center justify-between gap-4 mb-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Link to="/servers" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
              <ArrowLeft className="size-3.5" />
              <span>Directory</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 truncate max-w-[240px]">{server.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border,#27272A)] bg-[var(--surface,#121215)] text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
              <span>{copiedLink ? 'Copied link' : 'Share'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setReportSuccess(false);
                setReportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border,#27272A)] bg-[var(--surface,#121215)] text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Flag className="size-3.5" />
              <span>Report</span>
            </button>
          </div>
        </div>

        {/* Banner: Inside Page Width, Rounded Corners, 3:1 Ratio Capped at 280px High */}
        <div className="w-full aspect-[3/1] max-h-[280px] rounded-2xl overflow-hidden bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] relative">
          {server.bannerUrl ? (
            <img
              src={server.bannerUrl}
              alt={`${server.name} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#121215] flex items-center justify-center">
              <span className="text-xs text-zinc-600 select-none">{server.category || 'Community'}</span>
            </div>
          )}
        </div>

        {/* Identity Row: Directly Below Banner in Normal Flow, 88px Icon Overlaps Bottom Edge by 32px */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2 sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0 flex-1">
            <div className="size-[88px] -mt-8 relative z-20 shrink-0 rounded-2xl ring-4 ring-[var(--background,#09090B)] bg-[var(--surface,#121215)] overflow-hidden">
              <ServerIcon
                name={server.name}
                iconUrl={server.iconUrl || server.icon}
                size="xl"
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>

            <div className="pt-2 sm:pt-3 min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground,#F4F4F5)] break-words leading-tight">
                  {server.name}
                </h1>
                {isVerified && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface,#18181B)] border border-[var(--border,#27272A)] text-zinc-200">
                    Verified
                  </span>
                )}
                {isPremium && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
                    Premium
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-400">
                <span>{server.category || 'Roleplay Server'}</span>
                <span className="text-zinc-600">•</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5 text-zinc-500" />
                  <span>{Number(server.memberCount || 0).toLocaleString()} members</span>
                </span>
                {ratingSummary.count > 0 && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="inline-flex items-center gap-1 text-zinc-300">
                      <Star className="size-3.5 fill-current text-[var(--accent)]" />
                      <span>{ratingSummary.average.toFixed(1)} ({ratingSummary.count})</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Join Button on the Right */}
          <div className="shrink-0 pt-2 sm:pt-0">
            <Button
              type="button"
              onClick={handleJoinServer}
              className="h-11 px-6 rounded-full bg-[var(--accent,#F97316)] hover:opacity-95 text-white font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Join Server</span>
              <span className="px-2 py-0.5 rounded-full bg-black/20 text-xs font-medium">
                +{joinReward} credits
              </span>
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Tags Under Identity Row */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4 px-2 sm:px-4">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-full text-xs bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Two Columns on Desktop (Main Column + 340px Side Column), One Column on Phone, 24px Gaps */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start mt-6">
          {/* ── MAIN COLUMN ── */}
          <div className="space-y-6 min-w-0">
            {/* 1. About Section */}
            {vis.about !== false && (
              <section className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-6 space-y-3">
                <h2 className="text-base font-semibold text-[var(--foreground,#F4F4F5)]">About</h2>
                {server.description ? (
                  <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert max-w-none">
                    <MarkdownRenderer content={server.description} />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No description provided.</p>
                )}
              </section>
            )}

            {/* 2. Live In-Game Block (Only when an ER:LC key is saved) */}
            {server.erlc && vis.erlc !== false && (
              <section className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--foreground,#F4F4F5)]">
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
                        <div className="text-2xl sm:text-3xl font-bold text-[var(--foreground,#F4F4F5)] tabular-nums">
                          {server.erlc.currentPlayers}
                          <span className="text-base font-normal text-zinc-500">
                            {' '}/ {server.erlc.maxPlayers || 40}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">Players in game</div>
                      </div>

                      <div>
                        <div className="text-2xl sm:text-3xl font-bold text-[var(--foreground,#F4F4F5)] tabular-nums">
                          {Number(server.erlc.staffInGame || 0)}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">Staff in game</div>
                      </div>

                      <div>
                        <div className="text-2xl sm:text-3xl font-bold text-[var(--foreground,#F4F4F5)] tabular-nums">
                          {Number(server.erlc.queueSize || 0)}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">Queue size</div>
                      </div>
                    </div>

                    {/* Thin Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent,#F97316)] rounded-full"
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
                  <div className="py-4 text-sm text-zinc-400">
                    Live status unavailable
                  </div>
                )}
              </section>
            )}

            {/* 3. Reviews Section */}
            {vis.reviews !== false && (
              <section className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--foreground,#F4F4F5)]">
                      Community Reviews
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Real feedback from verified Discord members
                    </p>
                  </div>
                  {ratingSummary.count > 0 && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-[var(--foreground,#F4F4F5)]">
                        {ratingSummary.average.toFixed(1)} / 5.0
                      </div>
                      <div className="text-xs text-zinc-400">{ratingSummary.count} reviews</div>
                    </div>
                  )}
                </div>

                {/* Review Form for eligible signed-in users */}
                {user && reviewEligibility?.canReview && (
                  <form onSubmit={handleSubmitReview} className="space-y-3 pt-2 border-t border-[var(--border,#27272A)]">
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
                              className={`size-4 ${
                                star <= reviewRating
                                  ? 'fill-current text-[var(--accent,#F97316)]'
                                  : 'text-zinc-600'
                              }`}
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
                      className="w-full rounded-xl bg-[#09090B] border border-[var(--border,#27272A)] p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={submittingReview || !reviewText.trim()}
                        className="h-9 px-4 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200 cursor-pointer"
                      >
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <div className="py-6 text-center space-y-1">
                    <p className="text-sm font-medium text-zinc-300">No reviews yet</p>
                    <p className="text-xs text-zinc-500">
                      Members who join and stay in this server can leave a verified review.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 divide-y divide-[var(--border,#27272A)]">
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
                                className={`size-3.5 ${
                                  idx < rev.rating
                                    ? 'fill-current text-[var(--accent,#F97316)]'
                                    : 'text-zinc-700'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed break-words">
                          {rev.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ── SIDE COLUMN (340px on Desktop) ── */}
          <aside className="w-full lg:w-[340px] space-y-6">
            {/* 1. Owner Card */}
            <div className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Server Owner
              </h3>
              {ownerName || ownerId ? (
                <div className="flex items-center gap-3">
                  <UserAvatar
                    userId={ownerId || undefined}
                    avatarUrl={ownerAvatar}
                    name={ownerName || 'Owner'}
                    size={40}
                    className="rounded-full shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {ownerName || `User ${String(ownerId).slice(0, 6)}`}
                    </div>
                    {owner?.username && (
                      <div className="text-xs text-zinc-400 truncate">@{owner.username}</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Owner information unavailable</p>
              )}
            </div>

            {/* 2. Stats Card (Directory Rank, Community Level, Server Total Credits if enabled) */}
            <div className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Community Stats
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Directory rank</span>
                  <span className="font-semibold text-white tabular-nums">
                    #{server.leaderboardRank || 1}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Community level</span>
                  <span className="font-semibold text-white tabular-nums">
                    Level {server.serverLevel || 1}
                  </span>
                </div>
                {server.showCredits !== false && server.serverCredits !== null && server.serverCredits !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Server credits</span>
                    <span className="font-semibold text-white tabular-nums">
                      {Number(server.serverCredits).toLocaleString()} credits
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Badges Card (Plain text chips, no emojis, max 4 with View all) */}
            {vis.badges !== false && badges.length > 0 && (
              <div className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Badges
                  </h3>
                  {badges.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setShowAllBadges((v) => !v)}
                      className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      {showAllBadges ? 'Show less' : `View all (${badges.length})`}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleBadges.map((b) => (
                    <span
                      key={b.id}
                      title={b.description}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#18181B] border border-[var(--border,#27272A)] text-zinc-200"
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Official Links */}
            {officialLinks.length > 0 && (
              <div className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Official Links
                </h3>
                <div className="space-y-2">
                  {officialLinks.map((lnk, idx) => (
                    <a
                      key={idx}
                      href={lnk.url.startsWith('http') ? lnk.url : `https://${lnk.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#09090B] border border-[var(--border,#27272A)] text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Globe className="size-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{lnk.label}</span>
                      </span>
                      <ExternalLink className="size-3 text-zinc-500 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Staff Team (If owner turned it on) */}
            {server.showStaffList && Array.isArray(server.staffList) && server.staffList.length > 0 && (
              <div className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Staff Team
                </h3>
                <div className="space-y-2.5">
                  {server.staffList.map((st, idx) => (
                    <div key={st.id || idx} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          userId={st.id}
                          avatarUrl={st.avatarUrl}
                          name={st.displayName || st.username}
                          size={28}
                          className="rounded-full shrink-0"
                        />
                        <span className="text-xs font-medium text-white truncate">
                          {st.displayName || st.username}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0">{st.role || 'Staff'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Partners (If owner turned it on) */}
            {server.showPartnerList && Array.isArray(server.partnerList) && server.partnerList.length > 0 && (
              <div className="rounded-2xl bg-[var(--surface,#121215)] border border-[var(--border,#27272A)] p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Partners
                </h3>
                <div className="space-y-2.5">
                  {server.partnerList.map((pt, idx) => (
                    <div key={pt.id || idx} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ServerIcon
                          name={pt.name}
                          iconUrl={pt.iconUrl}
                          size="sm"
                          className="size-7 rounded-lg shrink-0"
                        />
                        <span className="text-xs font-medium text-white truncate">{pt.name}</span>
                      </div>
                      {pt.link && (
                        <a
                          href={pt.link.startsWith('http') || pt.link.startsWith('/') ? pt.link : `https://${pt.link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-400 hover:text-white shrink-0"
                        >
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Report Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="bg-[#121215] border-[var(--border,#27272A)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Report Server</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Submit a report for staff review regarding {server.name}.
            </DialogDescription>
          </DialogHeader>
          {reportSuccess ? (
            <div className="py-4 text-sm text-zinc-300">
              Thank you. Your report has been submitted to platform staff.
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={4}
                placeholder="Describe the issue clearly..."
                className="w-full rounded-xl bg-[#09090B] border border-[var(--border,#27272A)] p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReportModalOpen(false)}
                  className="text-xs text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={submittingReport || !reportReason.trim()}
                  onClick={handleSubmitReport}
                  className="text-xs bg-white text-black hover:bg-zinc-200 rounded-full px-4"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PublicServerListingPage;
