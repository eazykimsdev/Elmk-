import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Users,
  ExternalLink,
  Coins,
  Check,
  Share2,
  Star,
  MessageSquare,
  Send,
  ChevronLeft,
  ChevronRight,
  Flag,
  Globe,
  Calendar,
  Gamepad2,
  Clock,
  ShieldCheck,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MarkdownRenderer, cleanSqlReplace } from '@/components/ui/markdown-renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, claimDirectoryBounty } from '@/lib/api';

export interface ServerProfileModalProps {
  server?: any;
  serverSlug?: string;
  currentUserId?: string;
  isOwnServer?: boolean;
  isJoined?: boolean;
  isOpen?: boolean;
  initialServer?: any;
  onBump?: () => void;
  onClose: () => void;
  onJoin?: () => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

export function openServerProfile(serverId: string, initialData?: any) {
  if (initialData && typeof window !== 'undefined') {
    try {
      (window as any).__erlcus_cached_server_profile = initialData;
    } catch {}
  }
  const url = new URL(window.location.href);
  url.searchParams.set('server', serverId);
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(new Event('erlcus_open_server_modal'));
}

interface ReviewItem {
  id: string;
  user_id: string;
  author_name: string;
  avatar_hash?: string | null;
  rating: number;
  text: string;
  created_at: string;
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

export function ServerProfileModal({
  server: initialServerProp,
  initialServer: initialServerProp2,
  serverSlug,
  isOwnServer: initialIsOwnServer = false,
  isOpen = true,
  onClose,
  onJoin,
  addToast,
}: ServerProfileModalProps) {
  const initialServer = initialServerProp || initialServerProp2;
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!initialServer);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Reviews state (Section 4.2 & 6)
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
  const [reviewEligibility, setReviewEligibility] = useState<any>(null);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Report state (Section 6.3)
  const [reportTarget, setReportTarget] = useState<{
    type: 'server' | 'owner' | 'review';
    id: string;
    name: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState<string>('Scam or fraud');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const REPORT_REASONS = [
    'Scam or fraud',
    'Impersonation',
    'Inappropriate content',
    'Spam or misleading ad',
    'Broken or fake invite',
    'Other'
  ];

  const activeSlug = serverSlug || initialServer?.id || '';

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Fetch server profile details
  useEffect(() => {
    if (!activeSlug) return;
    let isSubscribed = true;

    async function loadData() {
      try {
        const res = await fetch(`/api/servers/${activeSlug}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setProfileData(data);
            if (data?.userState?.reviewEligibility) {
              setReviewEligibility(data.userState.reviewEligibility);
              if (data.userState.reviewEligibility.status === 'already_reviewed' && data.userState.reviewEligibility.review) {
                setNewRating(data.userState.reviewEligibility.review.rating || 5);
                setNewReviewText(data.userState.reviewEligibility.review.text || '');
              }
            }
            setLoadError(null);
          }
        } else {
          if (isSubscribed) setLoadError('Server profile not found in directory.');
        }
      } catch (err) {
        console.error('[ServerProfileModal] Failed to load server profile:', err);
        if (isSubscribed) setLoadError('Failed to load server profile. Please try again.');
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadData();
    return () => {
      isSubscribed = false;
    };
  }, [activeSlug]);

  // Load reviews pagination and sort
  const loadReviews = async () => {
    if (!activeSlug) return;
    try {
      const [res, eligRes] = await Promise.all([
        fetch(`/api/servers/${activeSlug}/reviews?page=${reviewsPage}&pageSize=5&sort=${reviewsSort}`),
        fetch(`/api/servers/${activeSlug}/review-eligibility`)
      ]);
      if (res.ok) {
        const data = await res.json();
        setReviewsData(data);
      }
      if (eligRes.ok) {
        const elig = await eligRes.json();
        setReviewEligibility(elig);
        if (elig.status === 'already_reviewed' && elig.review && !isEditingReview) {
          setNewRating(elig.review.rating || 5);
          setNewReviewText(elig.review.text || '');
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadReviews();
  }, [activeSlug, reviewsPage, reviewsSort]);

  const cachedWindowServer = typeof window !== 'undefined' ? (window as any).__erlcus_cached_server_profile : null;
  const effectiveServer = profileData?.server || initialServer || (cachedWindowServer && (cachedWindowServer.id === activeSlug || cachedWindowServer.guildId === activeSlug) ? cachedWindowServer : null);

  if (loading && !profileData && !effectiveServer) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Loading server profile"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-50 duration-200"
      >
        <div className="relative w-full max-w-[920px] rounded-2xl bg-[#0E0E11] border border-white/10 p-12 flex flex-col items-center justify-center min-h-[420px] space-y-4 shadow-2xl">
          <div className="size-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-zinc-400 font-sans">Loading server profile...</p>
        </div>
      </div>
    );
  }

  if (loadError && !effectiveServer) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Server Profile Error"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-50 duration-200 font-sans"
      >
        <div className="relative w-full max-w-md rounded-2xl bg-[#0E0E11] border border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl">
          <div className="size-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-white font-sans">Server Profile Unavailable</h3>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed">{loadError}</p>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-white/10 mt-2">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const server = effectiveServer || {};
  const serverName = server.name || 'Server';
  const rawOwnerName = profileData?.owner?.name || profileData?.owner?.display_name || server.owner_display_name || server.ownerUsername || server.ownerName || '';
  const isBotOwner = rawOwnerName.toLowerCase() === 'connectingerlc' || profileData?.owner?.id === '1560767279191302215' || server.owner_discord_id === '1560767279191302215' || server.ownerId === '1560767279191302215';

  const hasOwnerSignedIn = !isBotOwner && Boolean(
    rawOwnerName &&
    rawOwnerName.toLowerCase() !== 'owner' &&
    rawOwnerName.toLowerCase() !== 'unclaimed' &&
    !rawOwnerName.toLowerCase().includes('founder')
  );

  const ownerNameResolved = hasOwnerSignedIn ? rawOwnerName : null;
  const ownerAvatarResolved = hasOwnerSignedIn
    ? (profileData?.owner?.avatar || profileData?.owner?.avatar_hash || server.owner_avatar_hash || server.ownerAvatar || null)
    : null;
  const ownerIdResolved = hasOwnerSignedIn
    ? (profileData?.owner?.id || server.owner_discord_id || server.ownerId || '')
    : '';

  const owner = {
    hasSignedIn: hasOwnerSignedIn,
    name: ownerNameResolved,
    avatar: ownerAvatarResolved,
    id: ownerIdResolved,
  };
  const stats = profileData?.stats || {
    memberCount: server.memberCount || 0,
    bumps: server.bumps || 0,
    verifiedJoins: server.verifiedJoins || 0,
    views: server.views || 0,
    rewardCoins: server.rewardCoins || 2,
  };
  const userState = profileData?.userState || {
    isOwner: initialIsOwnServer,
    joined: false,
    canReview: false,
  };

  const rawCategory = server.category || 'Roleplay server';
  const category = rawCategory.toLowerCase() === 'cots'
    ? 'COTS'
    : rawCategory.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase());
  const description = cleanSqlReplace(
    server.description || server.summary || 'This community has not added a description yet.'
  );
  const memberCount = Number(stats.memberCount || server.memberCount || 0);
  const reward = Number(stats.rewardCoins || server.rewardCoins || 2);
  const bannerUrl = server.bannerUrl || null;
  const isVerified = Boolean(server.verified || server.isVerified);
  const isOwnServer = initialIsOwnServer || userState.isOwner;

  const rawTags = server.tags;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === 'string'
    ? rawTags
        .split(',')
        .map((t: string) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
    : [];

  const minStayMinutes = Number(server.retentionMinutes || (server.retentionHours ? Math.round(server.retentionHours * 60) : 2));
  const minStayDisplay = minStayMinutes < 60 ? `${minStayMinutes} minutes` : `${Math.round(minStayMinutes / 60)} hours`;
  const language = server.language || 'English';
  const listedSince = server.createdAt
    ? new Date(server.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const erlc = server.erlc;

  const handleShare = () => {
    const url = window.location.origin + `/servers/${server.id || activeSlug}`;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    addToast?.('success', 'Link copied', 'Server profile link copied to clipboard.');
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleJoinClick = async () => {
    if (onJoin) {
      onJoin();
    } else if (server.inviteUrl) {
      window.open(server.inviteUrl, '_blank', 'noopener,noreferrer');
      try {
        await claimDirectoryBounty(server.id);
      } catch {}
      addToast?.('success', 'Verification started', `Joined ${serverName}. Retention clock started.`);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;
    setIsSubmittingReview(true);
    try {
      await api<any>(`/servers/${activeSlug}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: newRating,
          text: newReviewText.trim(),
        }),
      });
      addToast?.('success', isEditingReview ? 'Review updated' : 'Review posted', 'Your honest feedback was saved.');
      setIsEditingReview(false);
      loadReviews();
    } catch (err: any) {
      addToast?.('error', 'Submission failed', err.message || err.payload?.error || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId?: string) => {
    const id = reviewId || reviewEligibility?.review?.id;
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    try {
      await api<any>(`/servers/${activeSlug}/reviews/${id}`, {
        method: 'DELETE',
      });
      addToast?.('success', 'Review deleted', 'Your review has been removed.');
      setIsEditingReview(false);
      setNewReviewText('');
      setNewRating(5);
      loadReviews();
    } catch (err: any) {
      addToast?.('error', 'Delete failed', err.message || 'Failed to delete review.');
    }
  };

  const handleReportReview = (reviewId: string, authorName?: string) => {
    setReportTarget({
      type: 'review',
      id: reviewId,
      name: authorName ? `Review by ${authorName}` : 'Review',
    });
  };

  const handleOpenFullPage = () => {
    onClose();
    const slug = server.slug || (server.name && server.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) || server.id || activeSlug;
    navigate(`/s/${slug}`);
  };

  const handleSendReport = async () => {
    if (!reportTarget) return;
    if (reportReason === 'Other' && !reportDetails.trim()) {
      addToast?.('warning', 'Details required', 'Please provide additional details when selecting Other.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          serverId: server.id || activeSlug,
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast?.('success', 'Report submitted', 'Thank you. Reports go to the ConnectingERLC team.');
        setReportTarget(null);
        setReportDetails('');
        setReportReason('Scam or fraud');
      } else {
        addToast?.('error', 'Report failed', data.error || 'Failed to submit report.');
      }
    } catch {
      addToast?.('error', 'Network error', 'Failed to communicate with report service.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(1040px,96vw)] max-h-[92dvh] flex flex-col rounded-2xl border border-white/10 bg-[#0E0E11] text-zinc-100 shadow-2xl overflow-hidden font-sans"
      >
        {/* ── UNIFIED HEADER BLOCK (300px tall: banner blends behind title) ── */}
        <div className="relative w-full h-[290px] sm:h-[300px] shrink-0 overflow-hidden bg-[#0E0E11]">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 size-full object-cover object-center block"
            />
          ) : (
            <div className="absolute inset-0 size-full bg-gradient-to-br from-white/[0.05] via-[#141417] to-[#0E0E11]" />
          )}

          {/* Smooth vertical scrim fading from transparent to surface color (#0E0E11) - no visible line */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent 60%, rgba(14, 14, 17, 0.7) 85%, #0E0E11 100%)',
            }}
          />

          {/* Header actions top right: Three-dots menu & Close button */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHeaderMenu((prev) => !prev)}
                aria-label="More options"
                className="size-8 rounded-full bg-black/60 hover:bg-black/85 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 backdrop-blur-xs"
              >
                <MoreVertical className="size-4" />
              </button>

              {showHeaderMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#141417] border border-white/10 p-1.5 shadow-2xl text-xs z-50 space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setReportTarget({
                        type: 'server',
                        id: String(server.id || activeSlug),
                        name: serverName,
                      });
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer font-sans"
                  >
                    <Flag className="size-3.5 text-rose-400" />
                    <span>Report server</span>
                  </button>

                  {owner.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setReportTarget({
                          type: 'owner',
                          id: String(owner.id),
                          name: owner.name || 'Server Owner',
                        });
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer font-sans"
                    >
                      <Flag className="size-3.5 text-rose-400" />
                      <span>Report owner</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="size-8 rounded-full bg-black/60 hover:bg-black/85 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 backdrop-blur-xs"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Header content sitting INSIDE faded area at bottom */}
          <div className="absolute bottom-0 inset-x-0 p-6 sm:p-7 z-20 flex flex-col sm:flex-row sm:items-end gap-5 min-w-0">
            <div className="size-24 rounded-2xl border-4 border-[#0E0E11] bg-[#141417] shadow-2xl overflow-hidden shrink-0 flex items-center justify-center">
              <ServerIcon
                guildId={server.id}
                iconHash={server.icon_hash || server.iconHash || server.icon}
                iconUrl={server.iconUrl || server.icon}
                name={serverName}
                size={96}
                className="size-full rounded-xl object-cover"
              />
            </div>

            <div className="space-y-1.5 min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--accent)] tracking-wider">
                  {category}
                </span>
                {isVerified && (
                  <Badge className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                    Verified
                  </Badge>
                )}
              </div>
              <h2
                id="server-details-title"
                className="text-2xl sm:text-[32px] font-semibold text-white tracking-tight leading-tight truncate font-sans drop-shadow-xs"
              >
                {serverName}
              </h2>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-md bg-[#19191D]/90 backdrop-blur-xs border border-white/[0.08] text-xs text-zinc-300 font-sans font-medium"
                    >
                      {tag.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE MODAL BODY ── */}
        <div className="overflow-y-auto flex-1 min-h-0 text-xs font-sans bg-[#0E0E11]">
          {/* ── TWO-COLUMN GRID (60 / 40) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
            {/* ── LEFT COLUMN (60%): About & Reviews ── */}
            <div className="lg:col-span-7 space-y-6">
              {/* About Section */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  About
                </h3>
                <div className="text-sm text-zinc-300 leading-relaxed font-sans prose prose-invert max-w-none">
                  <MarkdownRenderer content={description} />
                </div>
              </div>

              {/* Reviews Section */}
              <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-[var(--accent)] shrink-0" />
                    <h3 className="text-sm font-semibold text-white font-sans">
                      Community feedback
                    </h3>
                    <span className="text-[11px] font-medium text-zinc-400 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full tabular-nums">
                      {reviewsData.total}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {reviewsData.total >= 2 && (
                      <Select value={reviewsSort} onValueChange={(val: any) => setReviewsSort(val)}>
                        <SelectTrigger className="h-9 w-[120px] rounded-[10px] text-xs bg-[#141417] border-white/10 text-zinc-200">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#141417] border-white/10 text-xs text-zinc-200">
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="highest">Highest</SelectItem>
                          <SelectItem value="lowest">Lowest</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Rating summary box */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-white/[0.06] bg-[#141417]/60">
                  <div className="text-center sm:text-left shrink-0">
                    <div className="text-4xl font-bold text-white tabular-nums tracking-tight">
                      {reviewsData.summary.average.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-1 justify-center sm:justify-start my-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`size-3.5 ${
                            s <= Math.round(reviewsData.summary.average)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-zinc-600'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {reviewsData.total} {reviewsData.total === 1 ? 'review' : 'reviews'}
                    </div>
                  </div>

                  {/* 5 Distribution Bars */}
                  <div className="flex-1 w-full space-y-1.5">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = reviewsData.summary.distribution[stars] || 0;
                      const pct =
                        reviewsData.total > 0
                          ? Math.round((count / reviewsData.total) * 100)
                          : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2.5 text-xs text-zinc-400">
                          <span className="w-12 text-right shrink-0 text-[11px] font-medium">
                            {stars} stars
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-[#19191D] overflow-hidden border border-white/[0.04]">
                            <div
                              className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right shrink-0 text-[11px] tabular-nums font-mono">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Review Composer - Always visible with 6 distinct states */}
                {(() => {
                  const currentEligibility = reviewEligibility || profileData?.userState?.reviewEligibility;
                  const eligibilityStatus = currentEligibility?.status || (
                    !profileData?.userState ? 'not_signed_in' :
                    profileData.userState.isOwner ? 'own_server' :
                    profileData.userState.canReview ? 'eligible' :
                    !profileData.userState.joined ? 'not_joined' :
                    'stay_pending'
                  );

                  return (
                    <div className="rounded-xl border border-white/[0.06] bg-[#141417] p-4 space-y-3">
                      {eligibilityStatus === 'not_signed_in' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-white font-sans">Community review</div>
                            <div className="text-xs text-zinc-400 mt-0.5 font-sans">Sign in to leave a review for this server.</div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => navigate('/login')}
                            className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs h-8 px-4 rounded-lg self-start sm:self-center cursor-pointer font-sans"
                          >
                            Sign in to review
                          </Button>
                        </div>
                      )}

                      {eligibilityStatus === 'own_server' && (
                        <div className="flex items-center gap-2.5 text-zinc-400 text-xs font-sans">
                          <ShieldCheck className="size-4 text-zinc-500 shrink-0" />
                          <span>You can't review your own server.</span>
                        </div>
                      )}

                      {eligibilityStatus === 'not_joined' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-white font-sans">Verified community review</div>
                            <div className="text-xs text-zinc-400 mt-0.5 font-sans">
                              Join this server and stay for {currentEligibility?.minimumStay || '3 days'} to leave a review.
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={handleJoinClick}
                            className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs h-8 px-4 rounded-lg self-start sm:self-center cursor-pointer font-sans"
                          >
                            Join server
                          </Button>
                        </div>
                      )}

                      {eligibilityStatus === 'stay_pending' && (
                        <div className="flex items-center gap-2.5 text-zinc-400 text-xs font-sans">
                          <Clock className="size-4 text-amber-500 shrink-0" />
                          <span>You can review after your stay ends in {currentEligibility?.timeRemaining || '2 days'}.</span>
                        </div>
                      )}

                      {eligibilityStatus === 'already_reviewed' && !isEditingReview && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white font-sans">Your review</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] font-medium">
                                Published
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsEditingReview(true);
                                  if (currentEligibility?.review) {
                                    setNewRating(currentEligibility.review.rating || 5);
                                    setNewReviewText(currentEligibility.review.text || '');
                                  }
                                }}
                                className="text-xs text-zinc-300 hover:text-white h-7 px-2.5 cursor-pointer font-sans"
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReview(currentEligibility?.review?.id)}
                                className="text-xs text-red-400 hover:text-red-300 h-7 px-2.5 cursor-pointer font-sans"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-amber-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`size-3.5 ${
                                  s <= (currentEligibility?.review?.rating || 5)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-600'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                            {currentEligibility?.review?.text}
                          </p>
                        </div>
                      )}

                      {(eligibilityStatus === 'eligible' || isEditingReview) && (
                        <form onSubmit={handleSubmitReview} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white block font-sans">
                              {isEditingReview ? 'Edit your review' : 'Share your community experience'}
                            </span>
                            {isEditingReview && (
                              <button
                                type="button"
                                onClick={() => setIsEditingReview(false)}
                                className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer font-sans"
                              >
                                Cancel
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-xs text-zinc-300 mr-2 font-sans">Your rating:</span>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setNewRating(s)}
                                className="p-1 cursor-pointer transition-transform hover:scale-110"
                              >
                                <Star
                                  className={`size-5 ${
                                    s <= newRating
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-zinc-600'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>

                          <textarea
                            value={newReviewText}
                            onChange={(e) => setNewReviewText(e.target.value)}
                            placeholder="Write your honest feedback about roleplay quality, server staff, or events..."
                            rows={3}
                            className="w-full rounded-lg bg-[#0E0E11] border border-white/10 p-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[var(--accent)] font-sans"
                          />

                          <div className="flex items-center justify-end gap-2">
                            {isEditingReview && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsEditingReview(false)}
                                className="text-xs text-zinc-400 hover:text-white h-8 font-sans"
                              >
                                Cancel
                              </Button>
                            )}
                            <Button
                              type="submit"
                              size="sm"
                              disabled={isSubmittingReview || newReviewText.trim().length < 5}
                              className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs h-8 px-4 rounded-lg cursor-pointer font-sans"
                            >
                              <Send className="size-3 mr-1.5" />
                              <span>
                                {isSubmittingReview
                                  ? 'Saving...'
                                  : isEditingReview
                                  ? 'Update review'
                                  : 'Post review'}
                              </span>
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })()}

                {/* Reviews List */}
                {reviewsData.reviews.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.04] bg-[#141417]/30 p-8 text-center space-y-2">
                    <p className="text-xs font-medium text-white">No reviews yet</p>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      Verified joiners can leave honest feedback after completing the verification period.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewsData.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-xl border border-white/[0.06] bg-[#141417] p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              userId={rev.user_id}
                              avatarHash={rev.avatar_hash}
                              name={rev.author_name}
                              size={32}
                            />
                            <div>
                              <span className="text-xs font-semibold text-white block">
                                {rev.author_name}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                                <div className="flex items-center gap-0.5 text-amber-400">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`size-3 ${
                                        s <= rev.rating
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-zinc-600'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span>·</span>
                                <span>
                                  {new Date(rev.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReportReview(rev.id, rev.author_name)}
                            title="Report review"
                            className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer transition-colors"
                          >
                            <Flag className="size-3.5" />
                          </button>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                          {rev.text}
                        </p>
                      </div>
                    ))}

                    {/* Pagination */}
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
                            className="size-8 p-0 bg-[#141417] border-white/10 text-zinc-300 cursor-pointer"
                          >
                            <ChevronLeft className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reviewsData.page >= reviewsData.totalPages}
                            onClick={() =>
                              setReviewsPage((p) => Math.min(reviewsData.totalPages, p + 1))
                            }
                            className="size-8 p-0 bg-[#141417] border-white/10 text-zinc-300 cursor-pointer"
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

            {/* ── RIGHT COLUMN (40%): Owned by, Member count, Stats rows, Join & Share ── */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-white/[0.06] bg-[#141417] p-5 space-y-5 sticky top-6">
                {/* Owned by (Section 6.1) */}
                <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                  {owner.hasSignedIn && owner.name ? (
                    <>
                      <UserAvatar
                        userId={owner.id}
                        avatarHash={owner.avatar}
                        name={owner.name}
                        size={40}
                        className="size-10 rounded-full"
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-medium">
                          Owned by
                        </span>
                        <span className="text-sm font-semibold text-white truncate block">
                          {owner.name}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="size-10 rounded-full bg-[#18181B] border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
                        <Users className="size-4 text-zinc-400" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-medium">
                          Owned by
                        </span>
                        <span className="text-xs text-zinc-300 block">
                          Owner has not signed in yet
                        </span>
                        <a
                          href="/login"
                          className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          Is this your server? Claim it
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {/* Big member count */}
                <div className="flex items-baseline gap-2 pb-4 border-b border-white/[0.06]">
                  <Users className="size-5 text-zinc-400 self-center" />
                  <span className="text-3xl font-bold text-white tabular-nums">
                    {memberCount.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400">members</span>
                </div>

                {/* Telemetry Rows with Dividers */}
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <ShieldCheck className="size-3.5 text-zinc-500" />
                      <span>Verified joins</span>
                    </span>
                    <span className="text-white font-medium tabular-nums">
                      {stats.verifiedJoins || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Coins className="size-3.5 text-[var(--accent)]" />
                      <span>Join reward</span>
                    </span>
                    <span className="text-[var(--accent)] font-semibold">
                      +{reward} credits
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Clock className="size-3.5 text-zinc-500" />
                      <span>Minimum stay</span>
                    </span>
                    <span className="text-zinc-200 font-medium">
                      {minStayDisplay}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-400">Category</span>
                    <span className="text-zinc-200 font-medium">{category}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Globe className="size-3.5 text-zinc-500" />
                      <span>Language</span>
                    </span>
                    <span className="text-zinc-200 font-medium">{language}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Calendar className="size-3.5 text-zinc-500" />
                      <span>Listed since</span>
                    </span>
                    <span className="text-zinc-300">{listedSince}</span>
                  </div>

                  {erlc?.connected && (
                    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-zinc-400 flex items-center gap-2">
                        <Gamepad2 className="size-3.5 text-zinc-500" />
                        <span>In game</span>
                      </span>
                      <span className="text-zinc-200 font-medium tabular-nums">
                        {erlc.currentPlayers} / {erlc.maxPlayers}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions: Join & Share */}
                <div className="pt-2 space-y-2">
                  {isOwnServer ? (
                    <div className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-center text-xs font-medium text-zinc-400">
                      Your server
                    </div>
                  ) : (
                    <Button
                      size="default"
                      onClick={handleJoinClick}
                      className="w-full h-11 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] font-semibold text-sm rounded-xl cursor-pointer shadow-md"
                    >
                      <Coins className="size-4 mr-2" />
                      <span>Join server (+{reward} cr)</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleShare}
                    className="w-full h-10 bg-[#19191D] hover:bg-[#222227] text-zinc-200 border-white/10 text-xs rounded-xl cursor-pointer flex items-center justify-center gap-2"
                  >
                    {copiedShare ? (
                      <>
                        <Check className="size-3.5 text-[var(--accent)]" />
                        <span>Link copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="size-3.5 text-zinc-400" />
                        <span>Share server</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER: Open full page ghost link on left, Close on right ── */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0E0E11] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenFullPage}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0"
          >
            <span>Open full page</span>
            <ExternalLink className="size-3.5" />
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="bg-[#272727] hover:bg-[#323232] text-zinc-200 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>

      {/* ── REPORT DIALOG (Section 6.3: 420px shadcn Dialog) ── */}
      {reportTarget && (
        <Dialog open={true} onOpenChange={(open) => !open && setReportTarget(null)}>
          <DialogContent className="w-[min(420px,94vw)] rounded-[16px] bg-[#0E0E11] border border-white/10 p-6 text-zinc-100 font-sans shadow-2xl z-[60]">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base font-semibold text-white">
                Report {reportTarget.type}
              </DialogTitle>
              <p className="text-xs text-zinc-400">
                Tell us why you are reporting <span className="text-white font-medium">{reportTarget.name}</span>.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Reason radio list */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 block">
                  Reason
                </label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors',
                        reportReason === r
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-white'
                          : 'border-white/[0.06] bg-[#141417] text-zinc-300 hover:bg-white/[0.04]'
                      )}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={r}
                        checked={reportReason === r}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="accent-[#F97316] size-3.5"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Details textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-zinc-300">
                    Additional details {reportReason === 'Other' && <span className="text-rose-400">*</span>}
                  </label>
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    {reportDetails.length} / 500
                  </span>
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value.slice(0, 500))}
                  placeholder="Provide context or evidence to help our review..."
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg bg-[#141417] border border-white/10 p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[var(--accent)] resize-none"
                />
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Reports go to the ConnectingERLC team.
              </p>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReportTarget(null)}
                className="text-xs text-zinc-400 hover:text-white h-9 px-3 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmittingReport || (reportReason === 'Other' && !reportDetails.trim())}
                onClick={handleSendReport}
                className="bg-[var(--accent)] hover:brightness-110 text-[var(--accent-foreground)] font-semibold text-xs h-9 px-4 rounded-lg cursor-pointer"
              >
                {isSubmittingReport ? 'Sending...' : 'Send report'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ServerProfileModal;
