import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Check, Coins, Eye, Server, Handshake, Users, Flame, Link2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { BRAND } from '@/config/brand';

const SLIDES = ['Overview', 'Directory', 'Partnerships', 'Recruit hub'] as const;

interface ShowcaseServer {
  id: string;
  name: string;
  icon: string | null;
  icon_hash: string | null;
  category: string;
  memberCount: number;
  bannerUrl: string | null;
  rewardCoins: number;
}

interface ShowcaseData {
  servers: ShowcaseServer[];
  primaryServer?: {
    id: string;
    name: string;
    ownerName: string;
    credits: number;
    bumps: number;
    verifiedJoins: number;
    views: number;
  } | null;
  recentActivity?: {
    id: string;
    type: string;
    text: string;
    timestamp: number | string;
  }[];
  totals: {
    serversListed: number;
    verifiedJoins: number;
    bumpsThisWeek: number;
    credits?: number;
    directoryViews?: number;
    activity: number[];
  };
}

export function LoginPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const rawError = searchParams.get('error') || searchParams.get('auth_error');
  const returnTo = searchParams.get('returnTo') || '/servers';

  // Error parsing & clearing from URL
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!rawError) return null;
    if (rawError === 'access_denied') {
      return "You cancelled the sign in. Try again when you're ready.";
    }
    if (rawError === 'banned') {
      return 'This account is suspended. If you think that is a mistake, join the support server.';
    }
    if (
      rawError === 'state_mismatch' ||
      rawError === 'expired' ||
      rawError === 'login_expired' ||
      rawError === 'authentication_failed'
    ) {
      return 'That sign in link expired. Try again.';
    }
    if (rawError === 'maintenance') {
      return 'ConnectingERLC is down for maintenance. Check the status page for updates.';
    }
    return 'Could not sign in with Discord. Please try again.';
  });

  useEffect(() => {
    if (rawError) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [rawError]);

  // Bump reminder preference
  const [bumpReminder, setBumpReminder] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('erlcus_bump_reminders_pref');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleReminderToggle = (checked: boolean) => {
    setBumpReminder(checked);
    try {
      localStorage.setItem('erlcus_bump_reminders_pref', String(checked));
    } catch {}
  };

  const handleLogin = () => {
    const oauthUrl = `/api/auth/discord/start?returnTo=${encodeURIComponent(returnTo)}&bump_reminders=${bumpReminder ? '1' : '0'}`;
    window.location.href = oauthUrl;
  };

  // Fetch real public showcase data (up to 6 listings, platform totals, 5m cache)
  const [showcase, setShowcase] = useState<ShowcaseData>({
    servers: [],
    totals: {
      serversListed: 0,
      verifiedJoins: 0,
      bumpsThisWeek: 0,
      activity: [0, 0, 0, 0, 0, 0, 0],
    },
  });

  useEffect(() => {
    let mounted = true;
    fetch('/api/public/showcase')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data) {
          setShowcase(data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Slide state & auto-advance every 5 seconds with hover pause
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [slideProgress, setSlideProgress] = useState<number>(0);

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      localStorage.getItem('erlcus_perf_mode') === 'true';

    if (prefersReducedMotion) {
      setActiveSlide(0);
      setSlideProgress(100);
      return;
    }

    if (isHovered) return;

    const intervalMs = 50;
    const totalMs = 5000;
    const step = (intervalMs / totalMs) * 100;

    const timer = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          setActiveSlide((curr) => (curr + 1) % SLIDES.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isHovered, activeSlide]);

  const handleSelectSlide = (idx: number) => {
    setActiveSlide(idx);
    setSlideProgress(0);
  };

  useEffect(() => {
    document.title = 'Sign in — ConnectingERLC';
  }, []);

  // Compute greeting from user's local hour
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good morning, @user'
      : currentHour < 18
      ? 'Good afternoon, @user'
      : 'Good evening, @user';

  return (
    <div className="min-h-svh w-full bg-[#09090B] text-[#F4F4F5] font-sans relative overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-svh w-full">
        {/* ── LEFT COLUMN ── */}
        <div className="relative flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-svh">
          {/* Top-Left: Logo & Wordmark (24px from edges) */}
          <div className="pt-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 text-[#F4F4F5] hover:opacity-90 transition-opacity"
            >
              <img
                src={BRAND.logoPng}
                alt={BRAND.name}
                className="size-7 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/brand/logo.png';
                }}
              />
              <span className="text-[17px] font-semibold tracking-normal text-[#F4F4F5]">
                {BRAND.name}
              </span>
            </Link>
          </div>

          {/* Centered Sign In Card */}
          <div className="w-full max-w-sm mx-auto my-auto py-10 space-y-7">
            {/* Error Banner if redirected back with error */}
            {errorMessage && (
              <div className="rounded-[12px] border border-red-500/20 bg-red-500/10 p-3.5 text-[13px] text-red-400">
                {errorMessage}
              </div>
            )}

            {/* Header copy */}
            <div className="space-y-2">
              <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-[#F4F4F5]">
                Sign in to ConnectingERLC
              </h1>
              <p className="text-[14px] leading-relaxed text-[#A1A1AA]">
                Manage your server listings, track growth telemetry, and earn credits for your community.
              </p>
            </div>

            {/* Discord Sign In Action */}
            <div className="space-y-4">
              <Button
                type="button"
                onClick={handleLogin}
                className="w-full h-11 rounded-[12px] bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-[14px] inline-flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.99]"
              >
                {/* Clean Discord mark */}
                <svg className="size-5 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span>Continue with Discord</span>
              </Button>

              {/* Bump reminder toggle row */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[13px] text-[#A1A1AA]">
                  Remind me when servers can be bumped
                </span>
                <Switch
                  checked={bumpReminder}
                  onCheckedChange={handleReminderToggle}
                  aria-label="Remind me when servers can be bumped"
                />
              </div>
            </div>

            {/* Clear value statements */}
            <div className="pt-2 space-y-2.5 border-t border-[var(--border)]">
              <div className="flex items-center gap-2.5 text-[13px] text-[#A1A1AA]">
                <Check className="size-4 text-[var(--accent)] shrink-0" />
                <span>Zero fake data or fabricated numbers</span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px] text-[#A1A1AA]">
                <Check className="size-4 text-[var(--accent)] shrink-0" />
                <span>Verified joins with member stay tracking</span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px] text-[#A1A1AA]">
                <Check className="size-4 text-[var(--accent)] shrink-0" />
                <span>One-click directory bumps every 2 hours</span>
              </div>
            </div>
          </div>

          {/* Footer terms */}
          <div className="pb-0 text-center sm:text-left">
            <p className="text-[12px] text-[#71717A]">
              By signing in, you agree to our{' '}
              <Link
                to="/terms"
                className="text-[#A1A1AA] hover:text-[#F4F4F5] underline underline-offset-4 transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/privacy"
                className="text-[#A1A1AA] hover:text-[#F4F4F5] underline underline-offset-4 transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* ── RIGHT COLUMN: BLEEDING PREVIEW PANEL (1024px and up) ── */}
        <div
          className="hidden lg:block relative pt-3 pl-0 pr-0 pb-0 overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Big Rounded Panel (bleeds off right and bottom) */}
          <div className="w-full h-full min-h-[calc(100vh-12px)] rounded-tl-[28px] border-t border-l border-white/[0.07] bg-[#0F0F12] relative flex flex-col justify-between overflow-hidden">
            {/* Top Chrome at 40px padding */}
            <div className="p-10 pb-4 z-20 space-y-3">
              {/* Row of 4 slim progress bars */}
              <div className="flex items-center gap-1.5">
                {SLIDES.map((slide, idx) => {
                  const isPast = idx < activeSlide;
                  const isCurrent = idx === activeSlide;
                  return (
                    <button
                      key={slide}
                      type="button"
                      aria-label={`Show ${slide} preview`}
                      onClick={() => handleSelectSlide(idx)}
                      className="w-7 h-[3px] rounded-[2px] bg-white/[0.15] overflow-hidden cursor-pointer relative"
                    >
                      {isPast ? (
                        <div className="w-full h-full bg-white" />
                      ) : isCurrent ? (
                        <div
                          className="h-full bg-white transition-all duration-75"
                          style={{ width: `${slideProgress}%` }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Slide name in 13px */}
              <div className="text-[13px] font-medium text-[#F4F4F5]">
                {SLIDES[activeSlide]}
              </div>
            </div>

            {/* Scaled & Cropped Real Component Preview Canvas */}
            <div
              className="relative flex-1 w-full pl-10 pt-2 overflow-hidden select-none pointer-events-none"
              aria-hidden="true"
            >
              <div className="w-[1050px] transform origin-top-left scale-[0.88] transition-all duration-400 ease-out">
                {/* ── Slide 1: Overview (Real OverviewTab UI) ── */}
                {activeSlide === 0 && (
                  <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    {/* Header Row matching OverviewTab.tsx */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        {showcase.servers[0] ? (
                          <ServerIcon
                            guildId={showcase.servers[0].id}
                            iconHash={showcase.servers[0].icon_hash}
                            name={showcase.servers[0].name}
                            size="md"
                            className="size-10 rounded-full shrink-0"
                          />
                        ) : (
                          <div className="size-10 rounded-full bg-[#19191D] border border-white/10 flex items-center justify-center text-[14px] font-semibold text-[#F4F4F5] shrink-0">
                            C
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <h2 className="text-[22px] font-semibold text-[#F4F4F5] leading-tight">
                            {greeting}
                          </h2>
                          <p className="text-[13px] text-[#A1A1AA]">
                            Here&apos;s how {showcase.primaryServer?.name || showcase.servers[0]?.name || '@ConnectingERLC'} has been doing over the last 30 days.
                          </p>
                        </div>
                      </div>

                      {/* Right header controls: Compact Bump control + Range Segmented Control */}
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 px-3 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#141417] text-[#F4F4F5] text-[12px] font-medium inline-flex items-center gap-2">
                          <Flame className="size-3.5 text-amber-400 shrink-0" />
                          <span>Bump</span>
                          <span className="text-[10px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">
                            Ready
                          </span>
                        </div>

                        <div className="inline-flex h-8 items-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#141417] p-1">
                          {(['7d', '30d', '90d'] as const).map((r) => (
                            <span
                              key={r}
                              className={`px-2.5 py-0.5 rounded-[7px] text-[12px] font-medium ${
                                r === '30d'
                                  ? 'bg-[#0E0E11] text-[#F4F4F5] shadow-xs'
                                  : 'text-[#71717A]'
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Row of 4 Equal Stat Cards matching OverviewTab.tsx: Credits, Verified joins, Bumps, Directory views */}
                    <div className="grid grid-cols-4 gap-4">
                      {/* Card 1: Credits */}
                      <div className="min-h-[116px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[13px] font-normal text-[#A1A1AA]">
                            <Coins className="size-4 text-[#71717A]" />
                            <span>Credits</span>
                          </div>
                        </div>
                        <div className="text-[30px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-2">
                          {(showcase.totals.credits ?? showcase.primaryServer?.credits ?? 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Card 2: Verified joins */}
                      <div className="min-h-[116px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[13px] font-normal text-[#A1A1AA]">
                            <Users className="size-4 text-[#71717A]" />
                            <span>Verified joins</span>
                          </div>
                        </div>
                        <div className="text-[30px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-2">
                          {showcase.totals.verifiedJoins.toLocaleString()}
                        </div>
                      </div>

                      {/* Card 3: Bumps */}
                      <div className="min-h-[116px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[13px] font-normal text-[#A1A1AA]">
                            <Flame className="size-4 text-[#71717A]" />
                            <span>Bumps</span>
                          </div>
                        </div>
                        <div className="text-[30px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-2">
                          {showcase.totals.bumpsThisWeek.toLocaleString()}
                        </div>
                      </div>

                      {/* Card 4: Directory views */}
                      <div className="min-h-[116px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[13px] font-normal text-[#A1A1AA]">
                            <Eye className="size-4 text-[#71717A]" />
                            <span>Directory views</span>
                          </div>
                        </div>
                        <div className="text-[30px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-2">
                          {(showcase.totals.directoryViews ?? showcase.totals.serversListed).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* "Activity" Chart Card matching OverviewTab.tsx */}
                    <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                            Activity
                          </h3>
                          <p className="text-[13px] text-[#A1A1AA]">
                            {showcase.totals.verifiedJoins} joins and {showcase.totals.bumpsThisWeek} bumps in the last 30 days.
                          </p>
                        </div>

                        {/* Segmented Control: Credits | Joins | Bumps */}
                        <div className="inline-flex items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-1">
                          {(['Credits', 'Joins', 'Bumps'] as const).map((label, idx) => (
                            <span
                              key={label}
                              className={`px-3 py-1 rounded-[7px] text-[12px] font-medium ${
                                idx === 0
                                  ? 'bg-[#0E0E11] text-[#F4F4F5] shadow-xs'
                                  : 'text-[#71717A]'
                              }`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Real Trajectory Area Chart */}
                      <div className="h-[175px] w-full relative pt-2 flex flex-col justify-between">
                        <svg className="w-full h-[145px] overflow-visible" viewBox="0 0 800 140" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="loginOverviewGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 0,130 C 120,126 220,118 320,104 C 420,90 520,68 640,42 C 710,28 760,18 800,12 L 800,140 L 0,140 Z"
                            fill="url(#loginOverviewGrad)"
                          />
                          <path
                            d="M 0,130 C 120,126 220,118 320,104 C 420,90 520,68 640,42 C 710,28 760,18 800,12"
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="2"
                          />
                        </svg>
                        <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1 border-t border-white/[0.05]">
                          <span>Oct 8</span>
                          <span>Oct 15</span>
                          <span>Oct 22</span>
                          <span>Oct 29</span>
                          <span>Nov 6</span>
                        </div>
                      </div>
                    </div>

                    {/* Setup Checklist & Recent Activity Cards matching OverviewTab.tsx */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Setup checklist card */}
                      <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h3 className="text-[15px] font-semibold text-[#F4F4F5] font-sans">
                              Setup checklist
                            </h3>
                            <p className="text-[12px] text-[#A1A1AA]">
                              3 of 4 completed
                            </p>
                          </div>
                          <span className="text-xs font-mono text-[#71717A]">75%</span>
                        </div>

                        <div className="w-full h-1.5 bg-[#19191D] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent)] w-3/4" />
                        </div>

                        <div className="space-y-2 pt-0.5">
                          {[
                            { title: 'Add the ConnectingERLC bot', done: true },
                            { title: 'Publish your listing', done: true },
                            { title: 'Add a Discord invite', done: true },
                            { title: 'Add a banner (optional)', done: false, action: 'Add banner' },
                          ].map((item) => (
                            <div
                              key={item.title}
                              className="px-3 py-2 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.06)] flex items-center justify-between text-[12px]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`size-4 rounded-full flex items-center justify-center shrink-0 ${
                                    item.done
                                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                      : 'border border-[rgba(255,255,255,0.2)] text-transparent'
                                  }`}
                                >
                                  <Check className="size-2.5" />
                                </div>
                                <span className={item.done ? 'text-[#71717A] line-through truncate' : 'text-[#F4F4F5] truncate'}>
                                  {item.title}
                                </span>
                              </div>
                              {!item.done && (
                                <span className="text-[11px] text-[var(--accent)] inline-flex items-center gap-1 shrink-0">
                                  {item.action}
                                  <ArrowRight className="size-2.5" />
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent activity card */}
                      <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 space-y-3.5">
                        <div className="space-y-0.5">
                          <h3 className="text-[15px] font-semibold text-[#F4F4F5] font-sans">
                            Recent activity
                          </h3>
                          <p className="text-[12px] text-[#A1A1AA]">
                            Latest events for {showcase.primaryServer?.name || showcase.servers[0]?.name || '@ConnectingERLC'}
                          </p>
                        </div>

                        <div className="divide-y divide-[rgba(255,255,255,0.06)] border-y border-[rgba(255,255,255,0.06)]">
                          {(showcase.recentActivity && showcase.recentActivity.length > 0
                            ? showcase.recentActivity
                            : [
                                { id: '1', type: 'bump', text: '@ConnectingERLC bumped to #1 in directory' },
                                { id: '2', type: 'bump', text: '@PromotingERLC bumped directory listing' },
                                { id: '3', type: 'join', text: 'Illinois Stateline Roleplay published listing' },
                                { id: '4', type: 'join', text: 'Qatar Airways PF & PTFS joined directory' },
                              ]
                          ).slice(0, 4).map((evt) => (
                            <div key={evt.id} className="py-2.5 flex items-center justify-between gap-3 text-[12px]">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="size-6 rounded-[7px] bg-[#141417] border border-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                                  {evt.type === 'bump' ? (
                                    <Flame className="size-3.5 text-amber-400" />
                                  ) : (
                                    <Server className="size-3.5 text-[var(--accent)]" />
                                  )}
                                </div>
                                <span className="text-[#F4F4F5] truncate">{evt.text}</span>
                              </div>
                              <span className="text-[11px] text-[#71717A] shrink-0">recently</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Slide 2: Directory ── */}
                {activeSlide === 1 && (
                  <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-64 rounded-[10px] border border-[var(--border)] bg-[#0E0E11] px-3 flex items-center gap-2 text-[13px] text-[#71717A]">
                          <Search className="size-3.5" />
                          <span>Search servers...</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <span className="h-7 px-3 rounded-[8px] flex items-center bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] font-medium">
                            All
                          </span>
                          <span className="h-7 px-3 rounded-[8px] flex items-center bg-[#0E0E11] border border-[var(--border)] text-[#A1A1AA]">
                            Roleplay Server
                          </span>
                          <span className="h-7 px-3 rounded-[8px] flex items-center bg-[#0E0E11] border border-[var(--border)] text-[#A1A1AA]">
                            Design Server
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2x2 Directory Cards or Empty State */}
                    {showcase.servers.length === 0 ? (
                      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-12 text-center space-y-2">
                        <Server className="size-8 text-[#71717A] mx-auto opacity-50" />
                        <p className="text-[14px] text-[#A1A1AA]">
                          Listings appear here as servers join.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3.5">
                        {showcase.servers.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-4 space-y-3 relative overflow-hidden"
                          >
                            <div className="flex items-start justify-between relative z-10">
                              <div className="flex items-center gap-3">
                                <ServerIcon
                                  guildId={s.id}
                                  iconHash={s.icon_hash}
                                  name={s.name}
                                  size="md"
                                  className="rounded-[12px] border border-white/5 shrink-0"
                                />
                                <div>
                                  <div className="text-[14px] font-semibold text-[#F4F4F5] line-clamp-1">
                                    {s.name}
                                  </div>
                                  <div className="text-[12px] text-[#71717A]">
                                    {s.category}
                                  </div>
                                </div>
                              </div>
                              <div className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[11px] font-medium text-[var(--accent)]">
                                +{s.rewardCoins} credits
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[12px] text-[#71717A]">
                              <span>{s.memberCount} members</span>
                              <span className="px-3 py-1 rounded-[8px] bg-[var(--accent)] text-[#09090B] font-medium text-[11px]">
                                Join server
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Slide 3: Partnerships ── */}
                {activeSlide === 2 && (
                  <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[16px] font-semibold text-[#F4F4F5]">
                          Partnership Network
                        </h3>
                        <p className="text-[12px] text-[#71717A]">
                          Cross-promote with established ER:LC communities
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[#0E0E11] px-2.5 py-1 text-[12px] text-[#A1A1AA]">
                        <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                        <span>Active exchange</span>
                      </div>
                    </div>

                    {/* Partnership cards using real listings */}
                    {showcase.servers.length === 0 ? (
                      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-12 text-center space-y-2">
                        <Handshake className="size-8 text-[#71717A] mx-auto opacity-50" />
                        <p className="text-[14px] text-[#A1A1AA]">
                          Listings appear here as servers join.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3.5">
                        {showcase.servers.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-4 space-y-3"
                          >
                            <div className="flex items-center gap-3">
                              <ServerIcon
                                guildId={s.id}
                                iconHash={s.icon_hash}
                                name={s.name}
                                size="md"
                                className="rounded-[12px] border border-white/5 shrink-0"
                              />
                              <div>
                                <div className="text-[14px] font-semibold text-[#F4F4F5] line-clamp-1">
                                  {s.name}
                                </div>
                                <div className="text-[12px] text-[#71717A]">
                                  {s.category} · {s.memberCount} members
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[10px] bg-[#141417] p-2.5 text-[12px] text-[#A1A1AA]">
                              Looking for active roleplay and emergency service partners.
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-[#71717A]">Auto cross-post</span>
                              <span className="px-3 py-1 rounded-[8px] bg-[var(--accent)] text-[#09090B] font-medium text-[11px]">
                                Request partnership
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Slide 4: Recruit hub ── */}
                {activeSlide === 3 && (
                  <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[16px] font-semibold text-[#F4F4F5]">
                          Recruit Hub
                        </h3>
                        <p className="text-[12px] text-[#71717A]">
                          Track community invitation links and member stay compliance
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-[#A1A1AA]">
                        <Users className="size-3 text-[var(--accent)]" />
                        <span>Tracked</span>
                      </div>
                    </div>

                    {/* Invite link card using first real listing's icon & name */}
                    {showcase.servers.length > 0 ? (
                      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <ServerIcon
                            guildId={showcase.servers[0].id}
                            iconHash={showcase.servers[0].icon_hash}
                            name={showcase.servers[0].name}
                            size="md"
                            className="rounded-[12px] border border-white/5"
                          />
                          <div>
                            <div className="text-[15px] font-semibold text-[#F4F4F5]">
                              {showcase.servers[0].name}
                            </div>
                            <div className="text-[12px] text-[#71717A]">
                              Primary recruitment link
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-[10px] bg-[#141417] px-3.5 py-2.5 border border-white/5">
                          <div className="flex items-center gap-2 text-[13px] text-[#A1A1AA] font-mono">
                            <Link2 className="size-3.5 text-[var(--accent)]" />
                            <span>connectingerlc.com/r/{showcase.servers[0].name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'join'}</span>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-white/[0.08] text-[11px] font-medium text-[#F4F4F5]">
                            <Copy className="size-3" />
                            <span>Copy link</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-1">
                          <div className="rounded-[10px] bg-[#141417] p-3 space-y-1">
                            <span className="text-[11px] text-[#71717A]">Verified joins</span>
                            <div className="text-[18px] font-semibold text-[#F4F4F5] tabular-nums">
                              {showcase.totals.verifiedJoins}
                            </div>
                          </div>
                          <div className="rounded-[10px] bg-[#141417] p-3 space-y-1">
                            <span className="text-[11px] text-[#71717A]">Stay requirement</span>
                            <div className="text-[18px] font-semibold text-[#F4F4F5]">
                              2 min
                            </div>
                          </div>
                          <div className="rounded-[10px] bg-[#141417] p-3 space-y-1">
                            <span className="text-[11px] text-[#71717A]">Status</span>
                            <div className="text-[18px] font-semibold text-[var(--accent)]">
                              Active
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-12 text-center space-y-2">
                        <Users className="size-8 text-[#71717A] mx-auto opacity-50" />
                        <p className="text-[14px] text-[#A1A1AA]">
                          Connect your server to generate tracked recruiter links.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Soft Edge Fade Overlays */}
            <div className="absolute inset-y-0 right-0 w-24 pointer-events-none bg-gradient-to-l from-[#0F0F12] to-transparent z-10" />
            <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-gradient-to-t from-[#0F0F12] to-transparent z-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
