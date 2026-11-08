import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { PublicIconRail } from '@/components/ui/PublicIconRail';
import { ServerProfileModal } from '@/components/ServerProfileModal';
import { type DirectoryServerData } from '@/components/ui/directory-card';
import { ServerMarquee } from '@/components/ui/logo-marquee';
import { cleanSqlReplace } from '@/components/ui/markdown-renderer';
import { FAQs } from '@/components/ui/faq-section';
import { getBotInviteUrl } from '@/lib/api';
import {
  Zap,
  Handshake,
  ShieldCheck,
  Radio,
  Plus,
  MoreHorizontal,
  Check,
  Smile,
  ArrowRight
} from 'lucide-react';

const LAUNCH_AT = new Date('2026-11-21T00:00:00Z');
const SUPPORT_INVITE_URL = 'https://discord.gg/central';

export function HomePage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<DirectoryServerData[]>([]);
  const [selectedServerSlug, setSelectedServerSlug] = useState<string | null>(null);
  const [selectedServerData, setSelectedServerData] = useState<DirectoryServerData | null>(null);
  const [botStats, setBotStats] = useState<{
    username: string;
    userTag: string;
    avatarUrl: string;
    guilds: number;
    activity: string;
    connected: boolean;
  }>({
    username: 'ConnectingERLC',
    userTag: 'ConnectingERLC#3200',
    avatarUrl: '/brand/discord_bot_avatar.png',
    guilds: 11,
    activity: '🦃 Happy Thanksgiving',
    connected: true
  });

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    document.title = 'ConnectingERLC — The growth platform for ER:LC communities';
  }, []);

  // Fetch real bot telemetry from status endpoint
  useEffect(() => {
    let mounted = true;
    fetch('/api/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data?.bot) return;
        const u = data.bot.user;
        const username = typeof u === 'object' && u?.username ? String(u.username) : 'ConnectingERLC';
        const disc = typeof u === 'object' && u?.discriminator ? String(u.discriminator) : '3200';
        const userTag = disc && disc !== '0' ? `${username}#${disc}` : `@${username}`;
        const avatarUrl =
          typeof u === 'object' && u?.id && u?.avatar
            ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
            : '/brand/discord_bot_avatar.png';
        const guilds = typeof data.bot.guildsCount === 'number'
          ? data.bot.guildsCount
          : typeof data.bot.guilds === 'number'
          ? data.bot.guilds
          : 11;

        setBotStats({
          username,
          userTag,
          avatarUrl,
          guilds,
          activity: '🦃 Happy Thanksgiving',
          connected: Boolean(data.bot.connected)
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Countdown calculation
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = LAUNCH_AT.getTime() - now;
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real promoted servers from public showcase endpoint (?limit=60)
  useEffect(() => {
    let mounted = true;
    fetch('/api/public/showcase?limit=60')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        const raw = Array.isArray(data.servers) ? data.servers : (Array.isArray(data.listings) ? data.listings : []);
        const sanitized = raw.map((s: any) => ({
          ...s,
          name: cleanSqlReplace(s.name || ''),
          summary: cleanSqlReplace(s.summary || s.description || ''),
          description: cleanSqlReplace(s.description || '')
        }));
        setServers(sanitized);
      })
      .catch(() => {
        // Fallback to directory endpoint
        fetch('/api/directory?pageSize=20&sort=members_desc')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (mounted && data?.servers) {
              setServers(data.servers);
            }
          })
          .catch(() => {});
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Extract up to 3 real banners from promoted servers for composite background
  const heroBanners = useMemo(() => {
    return servers.map((s) => s.bannerUrl).filter(Boolean).slice(0, 3) as string[];
  }, [servers]);

  const handleOpenServer = (server: DirectoryServerData) => {
    setSelectedServerSlug(server.id);
    setSelectedServerData(server);
  };

  const botInviteUrl = getBotInviteUrl();

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] font-sans selection:bg-[var(--accent)]/20 selection:text-[var(--accent)]">
      {/* ── LEFT ICON RAIL (No top nav, everything through rail or bottom bar) ── */}
      <PublicIconRail />

      {/* ── MAIN CONTENT AREA (Padded left for 64px desktop rail, padded bottom for 56px mobile bar) ── */}
      <main className="md:pl-16 pb-16 md:pb-0 flex flex-col">
        {/* ── HERO SECTION ── */}
        <section className="relative min-h-[100dvh] flex flex-col justify-between px-6 sm:px-10 lg:px-16 pt-10 sm:pt-14 pb-8 overflow-hidden">
          {/* Dark blurred composite of up to 3 real banners */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
            {heroBanners.length > 0 ? (
              <div className="absolute inset-0 grid grid-cols-1 sm:grid-cols-3 opacity-25 filter blur-2xl scale-110">
                {heroBanners.map((b, i) => (
                  <img
                    key={i}
                    src={b}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 bg-[#0C0C0F]" />
            )}
            {/* Dark vignette overlay */}
            <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_0%,#09090B_75%]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/80 via-transparent to-[#09090B]" />
          </div>

          <div className="relative z-10 max-w-6xl w-full mx-auto my-auto py-6 sm:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Column: Headline & Subhead (7 cols on desktop) */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-semibold text-white tracking-[-0.02em] leading-[1.08] font-sans">
                  The <span className="text-[var(--accent)]">growth platform:</span> for ER:LC communities.
                </h1>
                <p className="text-base sm:text-lg text-zinc-400 font-sans leading-relaxed max-w-xl">
                  Promote your server, automate cross-community partnerships, recruit active players, and verify membership with live Discord and ERLC server numbers.
                </p>
              </div>

              {/* Right Column: Actions & Countdown (5 cols on desktop) */}
              <div className="lg:col-span-5 space-y-8 lg:pl-6">
                {/* CTA Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    to={user ? '/dashboard' : '/login'}
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1C0A00] font-semibold text-sm transition-all shadow-md active:scale-98 font-sans"
                  >
                    Get started
                  </Link>
                  <Link
                    to="/directory"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-transparent hover:bg-white/[0.04] text-white border border-white/10 text-sm font-medium transition-all font-sans"
                  >
                    Browse directory
                  </Link>
                </div>

                {/* Launch Countdown (Enlarged prominent typography) */}
                <div className="pt-6 sm:pt-8 text-left">
                  <span className="text-[13px] sm:text-[14px] uppercase tracking-widest text-zinc-400 font-semibold block mb-4 font-sans">
                    Launching November 21
                  </span>
                  <div className="flex items-baseline gap-3 sm:gap-5">
                    <div>
                      <span className="text-[44px] sm:text-[54px] font-bold text-white tabular-nums tracking-tight font-sans leading-none">
                        {String(timeLeft.days).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-[12px] text-zinc-400 block uppercase tracking-wider font-medium mt-1.5 font-sans">
                        Days
                      </span>
                    </div>
                    <span className="text-2xl sm:text-3xl text-zinc-600 font-light select-none">:</span>
                    <div>
                      <span className="text-[44px] sm:text-[54px] font-bold text-white tabular-nums tracking-tight font-sans leading-none">
                        {String(timeLeft.hours).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-[12px] text-zinc-400 block uppercase tracking-wider font-medium mt-1.5 font-sans">
                        Hours
                      </span>
                    </div>
                    <span className="text-2xl sm:text-3xl text-zinc-600 font-light select-none">:</span>
                    <div>
                      <span className="text-[44px] sm:text-[54px] font-bold text-white tabular-nums tracking-tight font-sans leading-none">
                        {String(timeLeft.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-[12px] text-zinc-400 block uppercase tracking-wider font-medium mt-1.5 font-sans">
                        Minutes
                      </span>
                    </div>
                    <span className="text-2xl sm:text-3xl text-zinc-600 font-light select-none">:</span>
                    <div>
                      <span className="text-[44px] sm:text-[54px] font-bold text-[var(--accent)] tabular-nums tracking-tight font-sans leading-none">
                        {String(timeLeft.seconds).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] sm:text-[12px] text-zinc-400 block uppercase tracking-wider font-medium mt-1.5 font-sans">
                        Seconds
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TOP VERIFIED SECTION & COMPACT MARQUEE (Clean, small, near countdown) ── */}
            <div className="w-full mt-10 sm:mt-14 text-left">
              <div className="flex items-center justify-between text-xs tracking-wider text-white/50 uppercase mb-3 font-sans">
                <span>Top Verified ER:LC Communities</span>
                <span>Ranked by live member count</span>
              </div>

              <ServerMarquee
                servers={servers}
                onSelectServer={(s) => {
                  const fullServer = servers.find((item) => item.id === s.id);
                  if (fullServer) handleOpenServer(fullServer);
                }}
              />
            </div>
          </div>
        </section>

        {/* ── DIVIDER LINE BETWEEN HERO AND SHOWCASE ── */}
        <div className="w-full border-b border-white/[0.08]" />

        {/* ── DISCORD BOT & AUTOMATION SHOWCASE (WITH 3D TILTED BOT CARD) ── */}
        <section className="pt-16 pb-24 sm:py-28 px-6 sm:px-10 lg:px-16 border-b border-white/[0.06] bg-[#09090B] relative overflow-hidden">
          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Column: Feature highlights */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-300 font-sans">
                <span className="size-2 rounded-full bg-[#23A55A]" />
                ConnectingERLC Discord Network
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight leading-[1.15] font-sans">
                Automate your community growth directly inside Discord.
              </h2>

              <p className="text-base sm:text-lg text-zinc-400 font-sans leading-relaxed">
                ConnectingERLC links your Emergency Response: Liberty County server directly into a synchronized advertising network, automating bumps, cross-server alliances, and verified recruiting.
              </p>

              {/* Clean minimal feature list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-white font-medium text-sm font-sans">
                    <Zap className="size-4 text-[var(--accent)] shrink-0" />
                    <span>Single-Command Bumps</span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Run <code className="text-zinc-300 font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">/bump</code> every 2 hours to instantly elevate your community to the #1 spot across partner networks.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-white font-medium text-sm font-sans">
                    <Handshake className="size-4 text-[var(--accent)] shrink-0" />
                    <span>Cross-Community Partnerships</span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Automate partnership requests, verified invites, and mutual shoutout embeds without manual staff pinging.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-white font-medium text-sm font-sans">
                    <ShieldCheck className="size-4 text-[var(--accent)] shrink-0" />
                    <span>Anti-Raid & Churn Protection</span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Ensure legitimate joins with automated membership verification before bounties and credits are awarded.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-white font-medium text-sm font-sans">
                    <Radio className="size-4 text-[var(--accent)] shrink-0" />
                    <span>Live ER:LC Telemetry</span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Track in-game PRC status, player counts, and staff rosters with live real-time API synchronization.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <a
                  href={botInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1C0A00] font-semibold text-sm transition-all shadow-md active:scale-98 font-sans"
                >
                  <Plus className="size-4" />
                  Add to Discord
                </a>
                <Link
                  to="/directory"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#141417] hover:bg-[#1A1A1E] text-white border border-white/10 text-sm font-medium transition-all font-sans"
                >
                  Browse Directory
                  <ArrowRight className="size-4 text-zinc-400" />
                </Link>
              </div>
            </div>

            {/* Right Column: 3D-ish Tilted Discord Bot Profile Card */}
            <div className="lg:col-span-5 flex justify-center items-center py-4 [perspective:1200px]">
              <div
                className="relative w-full max-w-[280px] sm:max-w-[310px] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] transition-all duration-700 ease-out hover:rotate-0 hover:scale-[1.02] text-left select-none group"
                style={{
                  transform: 'rotateY(-10deg) rotateX(6deg) rotateZ(1.5deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Authentic single-icon Discord App Profile graphic with transparent background */}
                <img
                  src="/brand/discord_bot_popout.png"
                  alt="ConnectingERLC Discord Bot"
                  className="w-full h-auto object-cover rounded-2xl block"
                />

                {/* Interactive Clickable Overlay for "+ Add App" button */}
                <a
                  href={botInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-[42.8%] left-[5%] w-[90%] h-[6.8%] rounded-md z-30 cursor-pointer pointer-events-auto hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                  style={{
                    transform: 'translateZ(20px)',
                  }}
                  title="Add ConnectingERLC App to Discord"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQS SECTION ── */}
        <FAQs />

        {/* ── BOTTOM CTA ── */}
        <section className="py-20 px-6 border-t border-white/[0.06] bg-[#0A0A0C] text-center">
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-3xl font-semibold text-white tracking-tight font-sans">
              Ready to grow your community?
            </h2>
            <p className="text-sm text-zinc-400 font-sans leading-relaxed">
              Add your server to ConnectingERLC today. Build partnerships, increase member engagement, and track live in-game metrics.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to={user ? '/dashboard' : '/login'}
                className="px-6 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1C0A00] font-semibold text-sm transition-all shadow-md font-sans"
              >
                Get started
              </Link>
              <Link
                to="/directory"
                className="px-6 py-3 rounded-xl bg-[#141417] hover:bg-[#1A1A1E] text-white border border-white/10 text-sm font-medium transition-all font-sans"
              >
                Browse directory
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-white/[0.06] bg-[#09090B] py-12 px-6 sm:px-10 lg:px-16 text-left">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="space-y-3 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2">
                <img src="/brand/logo.png" alt="ConnectingERLC" className="size-6 rounded-md object-contain" />
                <span className="font-semibold text-sm text-white font-sans">ConnectingERLC</span>
              </div>
              <p className="text-xs text-zinc-500 font-sans leading-relaxed">
                The growth platform engineered for Emergency Response: Liberty County Discord servers and departments.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-sans">Product</h4>
              <ul className="space-y-1.5 text-xs text-zinc-500 font-sans">
                <li><Link to="/directory" className="hover:text-zinc-300 transition-colors">Directory</Link></li>
                <li><Link to="/leaderboard" className="hover:text-zinc-300 transition-colors">Leaderboard</Link></li>
                <li><Link to="/dashboard?tab=partnerships" className="hover:text-zinc-300 transition-colors">Partnerships</Link></li>
                <li><Link to="/dashboard?tab=recruits" className="hover:text-zinc-300 transition-colors">Recruiting</Link></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-sans">Resources</h4>
              <ul className="space-y-1.5 text-xs text-zinc-500 font-sans">
                <li><Link to="/docs" className="hover:text-zinc-300 transition-colors">Documentation</Link></li>
                <li><Link to="/status" className="hover:text-zinc-300 transition-colors">System Status</Link></li>
                <li><Link to="/changelog" className="hover:text-zinc-300 transition-colors">Changelog</Link></li>
                <li><a href={SUPPORT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Support Discord</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-sans">Legal</h4>
              <ul className="space-y-1.5 text-xs text-zinc-500 font-sans">
                <li><Link to="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link></li>
                <li className="pt-2 text-[11px] text-zinc-600 font-sans">© 2026 ConnectingERLC</li>
              </ul>
            </div>
          </div>
        </footer>
      </main>

      {/* ── SERVER PROFILE MODAL (Opened from clicking any card) ── */}
      {selectedServerSlug && (
        <ServerProfileModal
          serverSlug={selectedServerSlug}
          initialServer={selectedServerData as any}
          isOpen={Boolean(selectedServerSlug)}
          onClose={() => {
            setSelectedServerSlug(null);
            setSelectedServerData(null);
          }}
        />
      )}
    </div>
  );
}

export default HomePage;
