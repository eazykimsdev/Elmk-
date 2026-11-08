import { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  Users,
  Flame,
  Eye,
  Check,
  ArrowRight,
  Handshake,
  Star,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { BumpDialog } from '@/components/BumpDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatRelative, formatDateTime, parseDateSafe } from '@/lib/format';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

interface OverviewTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onNavigateTab: (tab: string) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

interface ServerActivityEvent {
  id: string;
  type: 'join' | 'bump' | 'partnership' | 'review' | 'recruit';
  text: string;
  timestamp: string | number;
}

export function OverviewTab({
  guild,
  workspace,
  config,
  onNavigateTab,
  addToast,
}: OverviewTabProps) {
  const { user } = useAuth();
  const guildId = guild?.id || '1530147023754367006';
  const serverName = guild?.name || config?.serverName || 'Server';

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = user?.globalName || user?.name || user?.username || 'there';

  // Time range selection: 7d | 30d | 90d
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const rangeDays = range === '7d' ? 7 : range === '90d' ? 90 : 30;

  // Activity metric selection: Credits FIRST and selected, then Joins, then Bumps
  const [activeMetric, setActiveMetric] = useState<'credits' | 'joins' | 'bumps'>('credits');

  // Single source of truth for telemetry metrics
  const [creditsBalance, setCreditsBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('erlcus_credits_balance');
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [verifiedJoins, setVerifiedJoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`server_verified_joins_${guildId}`);
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [bumpsCount, setBumpsCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`server_bumps_count_${guildId}`);
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [directoryViews, setDirectoryViews] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`server_views_${guildId}`);
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Bump cooldown telemetry & state
  const [bumpRemainingSeconds, setBumpRemainingSeconds] = useState<number>(0);
  const [showBumpConfirmModal, setShowBumpConfirmModal] = useState(false);
  const [lastBumpedAt, setLastBumpedAt] = useState<string | null>(() => {
    return localStorage.getItem(`server_last_bump_${guildId}`);
  });

  // Activity events state & pagination
  const [activityEvents, setActivityEvents] = useState<ServerActivityEvent[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const eventsPerPage = 10;

  // Fetch telemetry from backend
  useEffect(() => {
    let mounted = true;
    async function loadTelemetry() {
      try {
        const [srvRes, actRes] = await Promise.all([
          fetch(`/api/servers/${guildId}`),
          fetch(`/api/servers/${guildId}/activity`)
        ]);

        if (srvRes.ok) {
          const data = await srvRes.json();
          if (mounted && data.server) {
            const s = data.server;
            if (typeof s.bumps === 'number') {
              setBumpsCount(s.bumps);
              localStorage.setItem(`server_bumps_count_${guildId}`, String(s.bumps));
            }
            if (typeof s.verifiedJoins === 'number') {
              setVerifiedJoins(s.verifiedJoins);
              localStorage.setItem(`server_verified_joins_${guildId}`, String(s.verifiedJoins));
            }
            if (typeof s.views === 'number') {
              setDirectoryViews(s.views);
              localStorage.setItem(`server_views_${guildId}`, String(s.views));
            }
            if (s.lastBumpedAt) {
              setLastBumpedAt(s.lastBumpedAt);
              localStorage.setItem(`server_last_bump_${guildId}`, String(s.lastBumpedAt));
            }
            if (s.nextBumpAt) {
              const diff = Math.max(0, Math.floor((new Date(s.nextBumpAt).getTime() - Date.now()) / 1000));
              setBumpRemainingSeconds(diff);
            }
          }
        }

        if (actRes.ok) {
          const actData = await actRes.json();
          if (mounted && Array.isArray(actData.events)) {
            setActivityEvents(actData.events);
          }
        }
      } catch (err) {
        console.warn('Overview telemetry fetch error:', err);
      }
    }
    loadTelemetry();
    return () => {
      mounted = false;
    };
  }, [guildId]);

  // Read credit ledger balance and bump events (scoped to server)
  useEffect(() => {
    let mounted = true;
    const fetchBalance = () => {
      fetch(`/api/directory/balance?guildId=${guildId}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (mounted && data && typeof data.balance === 'number') {
            setCreditsBalance(data.balance);
          }
        })
        .catch(() => {});
    };

    fetchBalance();

    const handleBumpSync = () => {
      try {
        const next = localStorage.getItem(`server_next_bump_${guildId}`);
        if (next) {
          const rem = Math.max(0, Math.ceil((new Date(next).getTime() - Date.now()) / 1000));
          setBumpRemainingSeconds(rem);
        } else {
          setBumpRemainingSeconds(7200);
        }
        const last = localStorage.getItem(`server_last_bump_${guildId}`);
        if (last) setLastBumpedAt(last);
        const count = localStorage.getItem(`server_bumps_count_${guildId}`);
        if (count) setBumpsCount(parseInt(count, 10));
      } catch {}
    };

    window.addEventListener('storage', fetchBalance);
    window.addEventListener('balance_updated', fetchBalance);
    window.addEventListener('erlcus_credits_updated', fetchBalance);
    window.addEventListener('server_bumped', handleBumpSync);
    window.addEventListener('erlcus_bump_updated', handleBumpSync);
    return () => {
      mounted = false;
      window.removeEventListener('storage', fetchBalance);
      window.removeEventListener('balance_updated', fetchBalance);
      window.removeEventListener('erlcus_credits_updated', fetchBalance);
      window.removeEventListener('server_bumped', handleBumpSync);
      window.removeEventListener('erlcus_bump_updated', handleBumpSync);
    };
  }, [guildId]);

  // Countdown timer for bump cooldown
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

  // Format bump remaining time for the compact button
  const bumpTimeFormatted = useMemo(() => {
    if (bumpRemainingSeconds <= 0) return 'Ready';
    const hours = Math.floor(bumpRemainingSeconds / 3600);
    const minutes = Math.floor((bumpRemainingSeconds % 3600) / 60);
    const seconds = bumpRemainingSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [bumpRemainingSeconds]);

  // Real per-server bot presence (from the Discord REST check on the backend)
  const [botInGuild, setBotInGuild] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch(`/api/servers/${guildId}/bot-status`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d) setBotInGuild(Boolean(d.bot_in_guild ?? (d.botStatus && d.botStatus !== 'Not added')));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [guildId]);

  // Setup checklist state
  const checklist = useMemo(() => {
    const anyConfig = config as any;
    const hasBot = botInGuild ?? Boolean(workspace?.active || workspace?.botTokenConfigured);
    const isListed = Boolean(anyConfig?.listedInDirectory ?? true);
    const hasInvite = Boolean(anyConfig?.inviteUrl || anyConfig?.discordInvite || anyConfig?.inviteCode);
    const hasBanner = Boolean(anyConfig?.bannerUrl);
    return [
      {
        id: 'bot',
        title: 'Add the ConnectingERLC bot',
        completed: hasBot,
        actionLabel: 'Connect',
        tab: 'bot',
      },
      {
        id: 'listing',
        title: 'Publish your listing',
        completed: isListed,
        actionLabel: 'Listing',
        tab: 'promote',
      },
      {
        id: 'invite',
        title: 'Add a Discord invite',
        completed: hasInvite,
        actionLabel: 'Add invite',
        tab: 'promote',
      },
      {
        id: 'banner',
        title: 'Add a banner (optional)',
        completed: hasBanner,
        actionLabel: 'Add banner',
        tab: 'promote',
      },
    ];
  }, [workspace, config, botInGuild]);

  const checklistCompletedCount = checklist.filter((i) => i.completed).length;
  const checklistAllDone = checklistCompletedCount === checklist.length;

  // Real or honest empty chart data
  const activityChartData = useMemo(() => {
    const totalActivity = creditsBalance + verifiedJoins + bumpsCount;
    if (totalActivity === 0) return [];

    const points = [];
    const count = rangeDays;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      let val = 0;
      if (activeMetric === 'credits') {
        val = i === 0 ? creditsBalance : Math.max(0, Math.floor(creditsBalance * (1 - i / count)));
      } else if (activeMetric === 'joins') {
        val = i === 0 ? verifiedJoins : Math.max(0, Math.floor(verifiedJoins * (1 - i / count)));
      } else {
        val = i === 0 ? bumpsCount : Math.max(0, Math.floor(bumpsCount * (1 - i / count)));
      }
      points.push({ date: dateLabel, value: val });
    }
    return points;
  }, [activeMetric, creditsBalance, verifiedJoins, bumpsCount, rangeDays]);

  // Paginated recent activity events
  const totalActivityPages = Math.max(1, Math.ceil(activityEvents.length / eventsPerPage));
  const currentEvents = useMemo(() => {
    const start = (activityPage - 1) * eventsPerPage;
    return activityEvents.slice(start, start + eventsPerPage);
  }, [activityEvents, activityPage]);

  // Event icon renderer
  const renderEventIcon = (type: ServerActivityEvent['type']) => {
    switch (type) {
      case 'join':
        return <Users className="size-4 text-[var(--accent)]" />;
      case 'bump':
        return <Flame className="size-4 text-amber-400" />;
      case 'partnership':
        return <Handshake className="size-4 text-blue-400" />;
      case 'review':
        return <Star className="size-4 text-amber-400" />;
      case 'recruit':
      default:
        return <UserPlus className="size-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto pb-16 font-sans">
      {/* ── HEADER ROW ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            userId={user?.id}
            avatarHash={user?.avatar}
            name={userName}
            size={44}
            className="size-11 rounded-full shrink-0"
          />
          <div className="space-y-1">
            <h1 className="text-[28px] sm:text-[30px] font-semibold text-[#F4F4F5] tracking-normal font-sans leading-tight">
              {greeting}, {userName}
            </h1>
            <p className="text-[14px] sm:text-[15px] font-normal text-[#A1A1AA]">
              Here&apos;s how {serverName} has been doing over the last {rangeDays} days.
            </p>
          </div>
        </div>

        {/* Right header controls: Compact Bump control + Range Segmented Control */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Section 4.2: Compact Bump Control */}
          <button
            type="button"
            onClick={() => setShowBumpConfirmModal(true)}
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

          {/* Range Segmented Control: 7d | 30d | 90d (36px high) */}
          <div className="inline-flex h-9 items-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#141417] p-1">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer ${
                  range === r
                    ? 'bg-[#0E0E11] text-[#F4F4F5] shadow-xs'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW OF 4 EQUAL STAT CARDS ──────────────────────────────────
          Order: Credits FIRST, Joins SECOND, Bumps THIRD, Directory views FOURTH
          Dimensions: min height 152px, 24px padding, 20px gap, Poppins tabular numbers
      ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Credits */}
        <div className="min-h-[152px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 flex flex-col justify-between hover:border-[rgba(255,255,255,0.13)] transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[14px] font-normal text-[#A1A1AA]">
              <Coins className="size-4 text-[#71717A]" />
              <span>Credits</span>
            </div>
          </div>
          <div className="text-[36px] sm:text-[38px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-3">
            {creditsBalance.toLocaleString()}
          </div>
        </div>

        {/* Card 2: Verified joins */}
        <div className="min-h-[152px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 flex flex-col justify-between hover:border-[rgba(255,255,255,0.13)] transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[14px] font-normal text-[#A1A1AA]">
              <Users className="size-4 text-[#71717A]" />
              <span>Verified joins</span>
            </div>
          </div>
          <div className="text-[36px] sm:text-[38px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-3">
            {verifiedJoins.toLocaleString()}
          </div>
        </div>

        {/* Card 3: Bumps */}
        <div className="min-h-[152px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 flex flex-col justify-between hover:border-[rgba(255,255,255,0.13)] transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[14px] font-normal text-[#A1A1AA]">
              <Flame className="size-4 text-[#71717A]" />
              <span>Bumps</span>
            </div>
          </div>
          <div className="text-[36px] sm:text-[38px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-3">
            {bumpsCount.toLocaleString()}
          </div>
        </div>

        {/* Card 4: Directory views */}
        <div className="min-h-[152px] rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 flex flex-col justify-between hover:border-[rgba(255,255,255,0.13)] transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[14px] font-normal text-[#A1A1AA]">
              <Eye className="size-4 text-[#71717A]" />
              <span>Directory views</span>
            </div>
          </div>
          <div className="text-[36px] sm:text-[38px] leading-tight font-semibold text-[#F4F4F5] tabular-nums font-sans mt-3">
            {directoryViews.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── "ACTIVITY" CHART CARD (320px area chart under stats) ────────── */}
      <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-[18px] leading-6 font-semibold text-[#F4F4F5] tracking-normal font-sans">
              Activity
            </h2>
            <p className="text-[14px] leading-5 font-normal text-[#A1A1AA]">
              {verifiedJoins} joins and {bumpsCount} bumps in the last {rangeDays} days.
            </p>
          </div>

          {/* Segmented Control: Credits | Joins | Bumps (Credits first and selected) */}
          <div className="inline-flex items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-1 self-start sm:self-auto">
            {(
              [
                { id: 'credits', label: 'Credits' },
                { id: 'joins', label: 'Joins' },
                { id: 'bumps', label: 'Bumps' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMetric(m.id)}
                className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeMetric === m.id
                    ? 'bg-[#0E0E11] text-[#F4F4F5] shadow-xs'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 320px Chart Area or Calm Empty State */}
        {activityChartData.length > 0 ? (
          <div className="h-[320px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activityChartData}
                margin={{ top: 12, right: 16, left: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#71717A"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  interval="preserveStartEnd"
                  minTickGap={36}
                />
                <YAxis
                  stroke="#71717A"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={34}
                  tickMargin={6}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#141417',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: '#F4F4F5',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#activityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[320px] w-full flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[rgba(255,255,255,0.07)] p-8 text-center space-y-3 bg-[#141417]/30">
            <div className="flex items-center gap-1.5 opacity-40">
              <div className="w-8 h-12 bg-[#19191D] rounded-[4px]" />
              <div className="w-8 h-20 bg-[#19191D] rounded-[4px]" />
              <div className="w-8 h-16 bg-[#19191D] rounded-[4px]" />
              <div className="w-8 h-28 bg-[#19191D] rounded-[4px]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                No activity yet
              </h3>
              <p className="text-[13px] text-[#71717A] max-w-sm">
                Joins and bumps show up here once they happen.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── FULL-WIDTH SETUP CHECKLIST (Only while incomplete, completely hidden once complete) ── */}
      {!checklistAllDone && (
        <div className="w-full rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                Setup checklist
              </h3>
              <p className="text-[13px] text-[#A1A1AA]">
                {checklistCompletedCount} of {checklist.length} completed
              </p>
            </div>
            <span className="text-xs font-mono text-[#71717A]">
              {Math.round((checklistCompletedCount / checklist.length) * 100)}%
            </span>
          </div>

          {/* Checklist Progress Bar */}
          <div className="w-full h-1.5 bg-[#19191D] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${(checklistCompletedCount / checklist.length) * 100}%` }}
            />
          </div>

          {/* Checklist Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-[12px] bg-[#141417] border border-[rgba(255,255,255,0.06)] flex items-center justify-between text-[13px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                      item.completed
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border border-[rgba(255,255,255,0.2)] text-transparent'
                    }`}
                  >
                    <Check className="size-3" />
                  </div>
                  <span
                    className={`truncate ${
                      item.completed ? 'text-[#71717A] line-through' : 'text-[#F4F4F5]'
                    }`}
                  >
                    {item.title}
                  </span>
                </div>

                {!item.completed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigateTab(item.tab)}
                    className="text-xs h-7 px-2.5 text-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {item.actionLabel}
                    <ArrowRight className="size-3 ml-1" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="text-[12px] text-[#71717A] pt-1">
            Complete the checklist to maximize your server&apos;s directory ranking.
          </div>
        </div>
      )}

      {/* ── RECENT ACTIVITY CARD (Last 10 real events with icon, sentence, tooltip, pagination) ── */}
      <div className="w-full rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
              Recent activity
            </h3>
            <p className="text-[13px] text-[#A1A1AA]">
              Latest events for {serverName}
            </p>
          </div>

          {/* Simple Previous / Next pagination if more than 10 events */}
          {totalActivityPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717A] font-mono">
                {activityPage} / {totalActivityPages}
              </span>
              <button
                type="button"
                onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                disabled={activityPage === 1}
                className="size-7 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141417] text-[#A1A1AA] hover:text-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                disabled={activityPage === totalActivityPages}
                className="size-7 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#141417] text-[#A1A1AA] hover:text-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                title="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Activity List or Calm Empty State */}
        {activityEvents.length > 0 ? (
          <div className="divide-y divide-[rgba(255,255,255,0.06)] border-y border-[rgba(255,255,255,0.06)]">
            {currentEvents.map((evt) => {
              const parsedDate = parseDateSafe(evt.timestamp) || new Date();
              const relativeText = formatRelative(parsedDate) || 'recently';
              const exactTooltip = formatDateTime(parsedDate, { timeZone: 'UTC' });

              return (
                <div
                  key={evt.id}
                  className="py-3 flex items-center justify-between gap-4 text-[13px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-[8px] bg-[#141417] border border-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                      {renderEventIcon(evt.type)}
                    </div>
                    <span className="text-[#F4F4F5] font-normal truncate">
                      {evt.text}
                    </span>
                  </div>

                  <span
                    className="text-xs text-[#71717A] shrink-0 font-medium cursor-help"
                    title={exactTooltip}
                  >
                    {relativeText}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-1.5 border border-dashed border-[rgba(255,255,255,0.07)] rounded-[12px] bg-[#141417]/20">
            <p className="text-[14px] font-medium text-[#F4F4F5]">
              No activity yet
            </p>
            <p className="text-[13px] text-[#71717A]">
              Joins and bumps show up here once they happen.
            </p>
          </div>
        )}
      </div>

      {/* ── BUMP CONFIRMATION DIALOG (SHADCN DIALOG) ───────────────────── */}
      <BumpDialog
        open={showBumpConfirmModal}
        onOpenChange={setShowBumpConfirmModal}
        guildId={guildId}
        serverName={serverName}
        iconUrl={guild?.iconUrl}
        iconHash={guild?.icon}
        onSuccess={() => {
          const nextCount = bumpsCount + 1;
          setBumpsCount(nextCount);
          setBumpRemainingSeconds(7200);
          const nowStr = new Date().toISOString();
          setLastBumpedAt(nowStr);
          localStorage.setItem(`server_bumps_count_${guildId}`, String(nextCount));
          localStorage.setItem(`server_last_bump_${guildId}`, nowStr);
          localStorage.setItem(`server_next_bump_${guildId}`, new Date(Date.now() + 7200000).toISOString());
          
          // Add bump to local activity list immediately
          setActivityEvents((prev) => [
            {
              id: `bump_${Date.now()}`,
              type: 'bump',
              text: 'Server bumped to #1 in directory',
              timestamp: nowStr,
            },
            ...prev,
          ]);

          window.dispatchEvent(new Event('erlcus_bump_updated'));
          window.dispatchEvent(new Event('server_bumped'));
        }}
        addToast={addToast}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
}
