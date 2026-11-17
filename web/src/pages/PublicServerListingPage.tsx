import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ExternalLink,
  Users,
  ShieldCheck,
  Crown,
  KeyRound,
  Check,
  Star,
  Flag,
  Globe,
  Share2,
  Copy,
  AlertCircle,
  Radio,
  Gamepad2,
  Clock,
  ArrowRight,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MarkdownRenderer, stripMarkdown } from '@/components/ui/markdown-renderer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';

interface ServerDetails {
  id: string;
  name: string;
  icon?: string | null;
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
  totalRanked?: number;
  serverLevel?: number;
  earnedBadges?: Array<{ id: string; label: string; description: string; color: string }>;
  erlc?: {
    connected: boolean;
    currentPlayers: number;
    maxPlayers: number;
    staffInGame?: number;
    queueSize?: number;
    joinCode?: string;
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
  staffList?: Array<{ role: string; username: string }>;
  showPartnerList?: boolean;
  partnerList?: Array<{ name: string; link?: string }>;
  customUrl?: string | null;
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

export function PublicServerListingPage() {
  const { slug, customSlug } = useParams<{ slug?: string; customSlug?: string }>();
  const activeSlug = customSlug || slug || '';
  const { user } = useAuth();

  const [server, setServer] = useState<ServerDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewEligibility, setReviewEligibility] = useState<{ canReview: boolean; message: string; status?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  // Load server details & reviews
  const fetchServer = async () => {
    if (!activeSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(activeSlug)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Server not found in directory.');
        } else {
          setError('Could not load server details.');
        }
        setServer(null);
        return;
      }
      const data = await res.json();
      const s = data.server || data;
      setServer(s);

      // Set meta tags for rich previews
      document.title = `${s.name} · ConnectingERLC`;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', stripMarkdown(s.description) || `Join ${s.name} on Discord.`);

      // Load reviews and eligibility
      if (data.reviews) {
        setReviews(data.reviews);
      }
      if (data.userState?.reviewEligibility) {
        setReviewEligibility(data.userState.reviewEligibility);
      }
    } catch {
      setError('Could not connect to server.');
      setServer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServer();
  }, [activeSlug]);

  const handleJoin = async () => {
    if (!server) return;
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(server.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const url = data?.inviteUrl || server.inviteUrl;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
      }
    } catch {}
    if (server.inviteUrl) {
      window.open(server.inviteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Submit Review Form
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server || submittingReview || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(server.id)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rating: reviewRating,
          text: reviewText.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review.');
      }
      setReviewText('');
      fetchServer();
    } catch (err: any) {
      alert(err.message || 'Could not post review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Report Review Handler
  const handleOpenReport = (reviewId: string) => {
    setReportingReviewId(reviewId);
    setReportReason('');
    setReportSuccess(false);
    setReportModalOpen(true);
  };

  const handleConfirmReport = async () => {
    if (!reportingReviewId || !reportReason.trim()) return;
    setSubmittingReport(true);
    try {
      const res = await fetch(`/api/reviews/${reportingReviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reportReason.trim() })
      });
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setReportModalOpen(false);
        }, 1500);
      }
    } catch {
      alert('Could not submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center gap-3 text-xs text-zinc-400 font-sans">
        <div className="size-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <span>Loading server details…</span>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-200 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md space-y-4">
          <div className="text-4xl font-bold text-zinc-100 font-mono">404</div>
          <h1 className="text-lg font-semibold text-zinc-100">Server Not Found</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {error || 'This community server does not exist or has been removed from discovery.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link to="/">
              <Button size="sm" className="text-xs bg-white text-zinc-950 hover:bg-zinc-200">
                Go home
              </Button>
            </Link>
            <Link to="/servers">
              <Button size="sm" variant="outline" className="text-xs border-white/[0.08] hover:bg-white/[0.04]">
                Browse directory
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Average Rating
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  const isOwner = Boolean(user && user.id && server.id && String(server.id) === String(user.id));
  const showErlcBlock = Boolean(server.erlc && server.erlc.connected && server.sectionVisibility?.erlc !== false);
  const showAboutBlock = server.sectionVisibility?.about !== false;
  const showBadgesBlock = server.sectionVisibility?.badges !== false;
  const showReviewsBlock = server.sectionVisibility?.reviews !== false;
  const showStaffBlock = Boolean(server.showStaffList && server.staffList && server.staffList.length > 0 && server.sectionVisibility?.staff !== false);
  const showPartnerBlock = Boolean(server.showPartnerList && server.partnerList && server.partnerList.length > 0 && server.sectionVisibility?.partners !== false);

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-200 font-sans selection:bg-[var(--accent)]/20 selection:text-[var(--accent)] pb-24">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/[0.06] bg-[#0E0E11]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-zinc-200 hover:text-white transition-colors">
            <span className="font-semibold text-sm tracking-tight">ConnectingERLC</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyShareLink}
              className="text-xs h-8 px-3 border-white/[0.08] hover:bg-white/[0.04] text-zinc-300 flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </Button>
            <Button
              onClick={handleJoin}
              size="sm"
              className="text-xs h-8 px-4 bg-[var(--accent)] text-white hover:opacity-90 flex items-center gap-1.5"
            >
              <span>Join Server</span>
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* ── BIG HERO HEADER ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] overflow-hidden">
          {/* Banner Container */}
          <div className="h-48 sm:h-64 md:h-80 w-full overflow-hidden bg-zinc-950 border-b border-white/[0.06] relative">
            {server.bannerUrl ? (
              <img
                src={server.bannerUrl}
                alt={`${server.name} banner`}
                className="w-full h-full object-cover object-center block"
              />
            ) : (
              <div className="w-full h-full bg-[#121216] flex items-center justify-center text-zinc-600">
                <span className="text-xs tracking-wider uppercase font-mono">ConnectingERLC Community</span>
              </div>
            )}
          </div>

          {/* Profile Overview Bar */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-16 sm:-mt-20">
              {/* Server Icon & Identity */}
              <div className="flex items-end gap-5">
                <div className="size-20 sm:size-24 rounded-2xl bg-zinc-900 border-2 border-[#0E0E11] shadow-xl overflow-hidden shrink-0">
                  <ServerIcon
                    guildId={server.id}
                    iconUrl={server.icon}
                    name={server.name}
                    size={96}
                    className="size-full object-cover"
                  />
                </div>
                <div className="space-y-1.5 pb-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 leading-tight">
                      {server.name}
                    </h1>
                    {server.isVerified && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        title="Verified Community"
                      >
                        <ShieldCheck className="size-3.5" />
                        <span>Verified</span>
                      </span>
                    )}
                    {server.is_premium && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        title="Premium Community"
                      >
                        <Crown className="size-3.5" />
                        <span>Premium</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                    <span className="text-zinc-300 font-medium">{server.category}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-zinc-500" />
                      <span>{Number(server.memberCount || 0).toLocaleString()} members</span>
                    </span>
                    {avgRating && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <Star className="size-3.5 fill-current" />
                          <span>{avgRating}</span>
                          <span className="text-zinc-500 font-normal">({reviews.length})</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Call to Action */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleJoin}
                  size="lg"
                  className="h-11 px-7 text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <span>Join Discord Community</span>
                  <ExternalLink className="size-4" />
                </Button>
              </div>
            </div>

            {/* Tags row */}
            {server.tags && server.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.04]">
                {server.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-white/[0.06] text-zinc-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── LIVE IN-GAME ER:LC TELEMETRY BLOCK (F2) ──────────────────────── */}
        {showErlcBlock && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Gamepad2 className="size-4 text-emerald-400" />
                  Live Emergency Response: Liberty County Server
                </h2>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                PRC API Live Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/[0.06] space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Users className="size-3.5 text-zinc-500" />
                  In-Game Players
                </div>
                <div className="text-2xl font-bold text-zinc-100 font-mono">
                  {server.erlc?.currentPlayers} <span className="text-sm text-zinc-500 font-normal">/ {server.erlc?.maxPlayers}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/[0.06] space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Shield className="size-3.5 text-zinc-500" />
                  Staff on Duty
                </div>
                <div className="text-2xl font-bold text-zinc-100 font-mono">
                  {server.erlc?.staffInGame || 0}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/[0.06] space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-zinc-500" />
                  Queue Size
                </div>
                <div className="text-2xl font-bold text-zinc-100 font-mono">
                  {server.erlc?.queueSize || 0}
                </div>
              </div>
            </div>

            {server.erlc?.joinCode && (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-400">
                  <KeyRound className="size-4 text-zinc-500" />
                  <span>Server Join Code:</span>
                  <span className="font-mono text-zinc-200 font-semibold">{server.erlc.joinCode}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TWO-COLUMN GRID: MAIN CONTENT (LEFT) & SIDEBAR (RIGHT) ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* LEFT 2 COLUMNS */}
          <div className="lg:col-span-2 space-y-8">
            {/* About Community */}
            {showAboutBlock && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 sm:p-7 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider text-[12px]">
                  About Community
                </h2>
                <div className="text-sm leading-relaxed text-zinc-300 font-sans space-y-3">
                  <MarkdownRenderer content={server.description || 'This community has not provided a description yet.'} />
                </div>
              </div>
            )}

            {/* Staff List (Only if turned on by owner) */}
            {showStaffBlock && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider text-[12px] flex items-center gap-2">
                  <Shield className="size-4 text-zinc-400" />
                  Staff Team
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {server.staffList!.map((member, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-zinc-950/60 border border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{member.username}</span>
                      <span className="text-[11px] text-zinc-400 px-2 py-0.5 rounded bg-white/[0.04]">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partner Communities (Only if turned on by owner) */}
            {showPartnerBlock && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider text-[12px] flex items-center gap-2">
                  <Users className="size-4 text-zinc-400" />
                  Partner Communities
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {server.partnerList!.map((partner, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-zinc-950/60 border border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{partner.name}</span>
                      {partner.link ? (
                        <a
                          href={partner.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1"
                        >
                          <span>Visit</span>
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Community Reviews Area (F2) */}
            {showReviewsBlock && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 sm:p-7 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                      <Star className="size-4 text-amber-400 fill-current" />
                      Community Reviews
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Authentic ratings and feedback from verified community members.
                    </p>
                  </div>
                  {avgRating && (
                    <div className="text-right">
                      <div className="text-xl font-bold text-zinc-100">{avgRating} / 5</div>
                      <div className="text-[11px] text-zinc-500">{reviews.length} reviews</div>
                    </div>
                  )}
                </div>

                {/* Review Submission Form */}
                <div className="p-5 rounded-xl bg-zinc-950/60 border border-white/[0.06] space-y-4">
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                    Leave a Review
                  </h3>

                  {!user ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-zinc-400">Sign in with Discord to review this community.</p>
                      <Link to="/login">
                        <Button size="sm" variant="outline" className="text-xs border-white/[0.08]">
                          Sign in
                        </Button>
                      </Link>
                    </div>
                  ) : reviewEligibility && !reviewEligibility.canReview ? (
                    <div className="p-3 text-xs text-zinc-400 bg-white/[0.02] border border-white/[0.04] rounded-lg flex items-center gap-2">
                      <AlertCircle className="size-4 text-zinc-500 shrink-0" />
                      <span>{reviewEligibility.message}</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-3">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1.5">Rating (1 to 5 stars)</label>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="p-1 focus:outline-none"
                              aria-label={`Select ${star} stars`}
                            >
                              <Star
                                className={`size-5 transition-colors ${
                                  star <= reviewRating
                                    ? 'text-amber-400 fill-current'
                                    : 'text-zinc-700 hover:text-zinc-500'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1.5">Your Feedback</label>
                        <textarea
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          rows={3}
                          placeholder="Share your experience with this server…"
                          className="w-full text-xs p-3 bg-zinc-900/60 border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none focus:border-white/[0.2] resize-y"
                          required
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={submittingReview || !reviewText.trim()}
                          size="sm"
                          className="text-xs px-4 bg-[var(--accent)] text-white hover:opacity-90"
                        >
                          {submittingReview ? 'Posting…' : 'Submit Review'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Reviews List */}
                <div className="space-y-3 pt-2">
                  {reviews.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic text-center py-6">
                      No reviews have been written yet. Be the first to share your experience!
                    </p>
                  ) : (
                    reviews.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 rounded-xl bg-zinc-950/40 border border-white/[0.04] space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-zinc-800 border border-white/[0.08] overflow-hidden shrink-0">
                              {r.user_avatar ? (
                                <img src={r.user_avatar} alt={r.user_name} className="size-full object-cover" />
                              ) : (
                                <div className="size-full flex items-center justify-center text-[10px] text-zinc-400">
                                  {r.user_name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-zinc-200">
                                {r.display_name || r.user_name}
                              </div>
                              <div className="flex items-center gap-1 text-amber-400 mt-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`size-3 ${
                                      star <= r.rating ? 'fill-current' : 'text-zinc-700'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-zinc-500">
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleOpenReport(r.id)}
                                className="text-zinc-600 hover:text-zinc-400"
                                title="Report review to staff"
                              >
                                <Flag className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed pl-9">
                          {r.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR (1 COLUMN) */}
          <div className="space-y-6">
            {/* Badges & Stats Block (F2) */}
            {showBadgesBlock && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider text-[11px]">
                  Community Telemetry
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
                    <span className="text-xs text-zinc-400">Directory Rank</span>
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      #{server.leaderboardRank || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
                    <span className="text-xs text-zinc-400">Community Level</span>
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      Level {server.serverLevel || 1}
                    </span>
                  </div>
                </div>

                {server.earnedBadges && server.earnedBadges.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06] space-y-2">
                    <h4 className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                      Earned Badges
                    </h4>
                    <div className="space-y-2">
                      {server.earnedBadges.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.04] flex items-center gap-2.5"
                        >
                          <div className="size-2 rounded-full bg-amber-400" />
                          <div>
                            <div className="text-xs font-medium text-zinc-200">{b.label}</div>
                            <div className="text-[10px] text-zinc-500">{b.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Official Links */}
            {server.socialLinks && Object.values(server.socialLinks).some(Boolean) && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 space-y-3">
                <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider text-[11px]">
                  Official Links
                </h3>
                <div className="space-y-2 text-xs">
                  {server.socialLinks.discord && (
                    <a
                      href={server.socialLinks.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/[0.04] flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Discord Server</span>
                      <ExternalLink className="size-3.5 text-zinc-500" />
                    </a>
                  )}
                  {server.socialLinks.roblox && (
                    <a
                      href={server.socialLinks.roblox}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/[0.04] flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Roblox Group</span>
                      <ExternalLink className="size-3.5 text-zinc-500" />
                    </a>
                  )}
                  {server.socialLinks.twitter && (
                    <a
                      href={server.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/[0.04] flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Twitter / X</span>
                      <ExternalLink className="size-3.5 text-zinc-500" />
                    </a>
                  )}
                  {server.socialLinks.website && (
                    <a
                      href={server.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/[0.04] flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Official Website</span>
                      <ExternalLink className="size-3.5 text-zinc-500" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Report Review Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-md bg-[#0E0E11] border border-white/[0.08] text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-base text-zinc-100">Report Review to Staff</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Submit this review for staff moderation if it violates platform guidelines.
            </DialogDescription>
          </DialogHeader>

          {reportSuccess ? (
            <div className="py-6 text-center text-xs text-emerald-400">
              Report received. Our moderation team will investigate.
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <label className="text-xs text-zinc-400 block">Reason for Report</label>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
                placeholder="Explain why this review violates guidelines…"
                className="w-full text-xs p-3 bg-zinc-900/60 border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none focus:border-white/[0.2] resize-none"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportModalOpen(false)}
              className="text-xs border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReport}
              disabled={submittingReport || !reportReason.trim() || reportSuccess}
              size="sm"
              className="text-xs bg-red-600 hover:bg-red-500 text-white"
            >
              {submittingReport ? 'Reporting…' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PublicServerListingPage;
