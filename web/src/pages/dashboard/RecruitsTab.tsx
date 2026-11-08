import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Copy,
  Share2,
  Check,
  Clock,
  AlertTriangle,
  Users,
  Shield,
  Send,
  ExternalLink,
  ChevronRight,
  LogOut,
  Hash,
  Activity,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Search,
  MoreVertical,
  Download,
  Ban,
  UserX,
  RotateCcw,
  Pause,
  Play,
  KeyRound,
  FileText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { NumberField } from '@/components/ui/number-field';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface RecruitsTabProps {
  currentGuildId: string;
  serverName?: string;
  serverIcon?: string | null;
  isOwner?: boolean;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

interface RecruitItem {
  id: string;
  guild_id: string;
  recruiter_user_id: string;
  recruiter_name: string;
  joined_user_id: string;
  joined_user_name: string;
  joined_user_avatar?: string | null;
  joined_at: number;
  retention_target_hours?: number;
  retention_deadline?: number;
  status: 'pending' | 'verified' | 'left_early';
  verified_at?: number | null;
  credits_awarded: number;
  remainingHours?: number;
}

interface RecruiterEntry {
  rank: number;
  recruiter_id: string;
  recruiter_name: string;
  recruiter_avatar: string | null;
  totalJoined: number;
  verifiedCount: number;
  pendingCount: number;
  leftEarlyCount: number;
  retentionRate: number;
  creditsEarned: number;
}

interface RecruitSettings {
  guild_id: string;
  enabled: boolean;
  representatives_wanted: number;
  credits_per_recruit: number;
  approve_manually: boolean;
  retention_hours: number;
  log_channel_id: string | null;
  rep_role_id: string | null;
  recruit_role_id: string | null;
  dm_owner: boolean;
}

interface UserRecruitStats {
  inviteCode: string;
  inviteUrl: string;
  isMatched?: boolean;
  totalJoined: number;
  verifiedCount: number;
  pendingCount: number;
  leftEarlyCount: number;
  retentionRate: number;
  creditsEarned: number;
}

export function RecruitsTab({
  currentGuildId,
  serverName = 'Community Server',
  serverIcon = null,
  isOwner = true,
  addToast,
}: RecruitsTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'member' | 'owner'>(isOwner ? 'owner' : 'member');
  const [ownerTab, setOwnerTab] = useState<'representatives' | 'activity' | 'settings' | 'tools'>('representatives');

  // Summary State
  const [summary, setSummary] = useState<any>({
    totalRecruits: 0,
    verifiedRecruits: 0,
    pendingRecruits: 0,
    leftEarlyRecruits: 0,
    retentionRate: 0,
    creditsAwarded: 0,
    slotsFilled: 0,
    slotsWanted: 10,
    recruitsThisWeek: 0,
    serverOwner: null,
  });

  // User personal link & stats
  const [userStats, setUserStats] = useState<UserRecruitStats>({
    inviteCode: '',
    inviteUrl: '',
    isMatched: true,
    totalJoined: 0,
    verifiedCount: 0,
    pendingCount: 0,
    leftEarlyCount: 0,
    retentionRate: 0,
    creditsEarned: 0,
  });

  // 30-Day Trend State
  const [trendData, setTrendData] = useState<{ date: string; label: string; verified: number }[]>([]);

  // Representatives State
  const [repsItems, setRepsItems] = useState<RecruiterEntry[]>([]);
  const [repsTotal, setRepsTotal] = useState(0);
  const [repsPage, setRepsPage] = useState(1);
  const [repsTotalPages, setRepsTotalPages] = useState(1);

  // Recruits Table State
  const [recruitsItems, setRecruitsItems] = useState<RecruitItem[]>([]);
  const [recruitsTotal, setRecruitsTotal] = useState(0);
  const [recruitsPage, setRecruitsPage] = useState(1);
  const [recruitsTotalPages, setRecruitsTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'left_early'>('all');
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  // Owner Settings State
  const [settings, setSettings] = useState<RecruitSettings>({
    guild_id: currentGuildId,
    enabled: true,
    representatives_wanted: 10,
    credits_per_recruit: 2,
    approve_manually: false,
    retention_hours: 72,
    log_channel_id: null,
    rep_role_id: null,
    recruit_role_id: null,
    dm_owner: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSendingTestPanel, setIsSendingTestPanel] = useState(false);

  // Bot permissions check
  const [botPerms, setBotPerms] = useState<{
    hasKick: boolean;
    hasBan: boolean;
    hasCreateInvite: boolean;
  }>({
    hasKick: true,
    hasBan: true,
    hasCreateInvite: true,
  });

  // Activity Log State
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Discord channels & roles loaded from server
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; color?: number }[]>([]);

  // Step down & Copy state
  const [stepDownOpen, setStepDownOpen] = useState(false);
  const [isSteppingDown, setIsSteppingDown] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Owner Action Dialog State
  const [actionDialog, setActionDialog] = useState<{
    isOpen: boolean;
    type: 'kick' | 'ban' | 'block' | 'reverse' | 'remove_rep' | 'revoke_all';
    targetId: string;
    targetName: string;
    reason: string;
    deleteDays: number;
    isLoading: boolean;
  }>({
    isOpen: false,
    type: 'kick',
    targetId: '',
    targetName: '',
    reason: '',
    deleteDays: 0,
    isLoading: false,
  });

  // Load telemetry
  const loadData = async () => {
    try {
      const [sumRes, trendRes, repsRes, recRes, setRes, chRes, rRes, permRes, actRes] = await Promise.all([
        fetch(`/api/servers/${currentGuildId}/recruits/summary`).catch(() => null),
        fetch(`/api/servers/${currentGuildId}/recruits/trend`).catch(() => null),
        fetch(`/api/servers/${currentGuildId}/recruits/leaderboard?page=${repsPage}&pageSize=12`).catch(() => null),
        fetch(`/api/servers/${currentGuildId}/recruits?page=${recruitsPage}&pageSize=10&status=${statusFilter}&search=${encodeURIComponent(searchMemberQuery)}`).catch(() => null),
        fetch(`/api/servers/${currentGuildId}/recruits/settings`).catch(() => null),
        fetch(`/api/workspace/${currentGuildId}/channels`).catch(() => null),
        fetch(`/api/workspace/${currentGuildId}/roles`).catch(() => null),
        fetch(`/api/servers/${currentGuildId}/owner-tools/bot-perms`).catch(() => null),
        fetch(`/api/servers/${currentGuildId}/owner-tools/activity`).catch(() => null),
      ]);

      if (sumRes && sumRes.ok) {
        const d = await sumRes.json();
        if (d.summary) {
          setSummary(d.summary);
          if (d.summary.currentUserStats) {
            setUserStats(d.summary.currentUserStats);
          }
        }
      }

      if (trendRes && trendRes.ok) {
        const d = await trendRes.json();
        if (Array.isArray(d.trend)) setTrendData(d.trend);
      }

      if (repsRes && repsRes.ok) {
        const d = await repsRes.json();
        setRepsItems(d.items || []);
        setRepsTotal(d.total || 0);
        setRepsTotalPages(d.totalPages || 1);
      }

      if (recRes && recRes.ok) {
        const d = await recRes.json();
        setRecruitsItems(d.items || []);
        setRecruitsTotal(d.total || 0);
        setRecruitsTotalPages(d.totalPages || 1);
      }

      if (setRes && setRes.ok) {
        const d = await setRes.json();
        if (d.settings) setSettings(d.settings);
      }

      if (chRes && chRes.ok) {
        const d = await chRes.json();
        if (Array.isArray(d.channels)) setChannels(d.channels);
      }

      if (rRes && rRes.ok) {
        const d = await rRes.json();
        if (Array.isArray(d.roles)) setRoles(d.roles);
      }

      if (permRes && permRes.ok) {
        const d = await permRes.json();
        if (d.ok) setBotPerms(d);
      }

      if (actRes && actRes.ok) {
        const d = await actRes.json();
        if (Array.isArray(d.logs)) setActivityLogs(d.logs);
      }
    } catch (err) {
      console.warn('Failed to load recruit telemetry:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentGuildId, recruitsPage, statusFilter, repsPage, searchMemberQuery]);

  // Copy personal link
  const handleCopy = () => {
    const link = userStats.inviteUrl || `https://discord.gg/${userStats.inviteCode || 'central'}`;
    navigator.clipboard?.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    addToast?.('success', 'Link copied', 'Your invite link is copied to clipboard.');
  };

  // Share link
  const handleShare = () => {
    const link = userStats.inviteUrl || `https://discord.gg/${userStats.inviteCode || 'central'}`;
    navigator.clipboard?.writeText(link);
    addToast?.('success', 'Ready to share', `Invite link ready to share: ${link}`);
  };

  // Step down as representative
  const handleStepDownConfirm = async () => {
    setIsSteppingDown(true);
    try {
      const res = await fetch(`/api/servers/${currentGuildId}/recruits/step-down`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        addToast?.('info', 'Stepped down', 'You have stepped down as a representative.');
        setStepDownOpen(false);
        loadData();
      } else {
        addToast?.('error', 'Error', 'Failed to step down.');
      }
    } catch {
      addToast?.('error', 'Error', 'Failed to communicate with recruit server.');
    } finally {
      setIsSteppingDown(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (patch: Partial<RecruitSettings>) => {
    setIsSavingSettings(true);
    try {
      const next = { ...settings, ...patch };
      const res = await fetch(`/api/servers/${currentGuildId}/recruits/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        setSettings(next);
        addToast?.('success', 'Settings saved', 'Recruiting parameters updated successfully.');
      }
    } catch {
      addToast?.('error', 'Save error', 'Failed to save recruit settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Dispatch Discord Test Panel
  const handleSendTestPanel = async () => {
    setIsSendingTestPanel(false);
    try {
      setIsSendingTestPanel(true);
      const res = await fetch(`/api/servers/${currentGuildId}/recruits/test-panel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: settings.log_channel_id }),
      });
      if (res.ok) {
        addToast?.('success', 'Panel dispatched', 'Recruit components panel sent to your Discord channel.');
      } else {
        addToast?.('error', 'Failed to send', 'Check that ConnectingERLC bot has permissions in the selected channel.');
      }
    } catch {
      addToast?.('error', 'Delivery notice', 'Could not send test panel. Verify bot channel permissions.');
    } finally {
      setIsSendingTestPanel(false);
    }
  };

  // Owner Actions Execution
  const handleExecuteOwnerAction = async () => {
    if (!actionDialog.reason.trim()) {
      addToast?.('warning', 'Reason required', 'Please provide an administrative reason for this action.');
      return;
    }

    setActionDialog((prev) => ({ ...prev, isLoading: true }));
    try {
      const ownerId = summary.serverOwner?.userId || (isOwner ? user?.id : null);
      if (ownerId && actionDialog.targetId === ownerId && ['kick', 'ban', 'block', 'remove_rep'].includes(actionDialog.type)) {
        addToast?.('error', 'Action rejected', 'The server owner cannot be removed, kicked, banned, or blocked.');
        setActionDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        return;
      }

      let endpoint = '';
      let body: any = { reason: actionDialog.reason };

      if (actionDialog.type === 'kick') {
        endpoint = `/api/servers/${currentGuildId}/owner-tools/kick`;
        body.userId = actionDialog.targetId;
      } else if (actionDialog.type === 'ban') {
        endpoint = `/api/servers/${currentGuildId}/owner-tools/ban`;
        body.userId = actionDialog.targetId;
        body.deleteDays = actionDialog.deleteDays;
      } else if (actionDialog.type === 'block') {
        endpoint = `/api/servers/${currentGuildId}/owner-tools/block-recruiter`;
        body.userId = actionDialog.targetId;
      } else if (actionDialog.type === 'reverse') {
        endpoint = `/api/servers/${currentGuildId}/owner-tools/reverse`;
        body.recruitId = actionDialog.targetId;
      } else if (actionDialog.type === 'remove_rep') {
        endpoint = `/api/servers/${currentGuildId}/owner-tools/remove-rep`;
        body.userId = actionDialog.targetId;
      } else if (actionDialog.type === 'revoke_all') {
        endpoint = `/api/servers/${currentGuildId}/owner-tools/revoke-invites`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast?.('success', 'Action completed', `Administrative action successfully applied.`);
        setActionDialog({
          isOpen: false,
          type: 'kick',
          targetId: '',
          targetName: '',
          reason: '',
          deleteDays: 0,
          isLoading: false,
        });
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast?.('error', 'Action failed', err.error || 'Failed to complete action.');
      }
    } catch {
      addToast?.('error', 'Error', 'Failed to communicate with server.');
    } finally {
      setActionDialog((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Export recruits CSV
  const handleExportCsv = () => {
    window.open(`/api/servers/${currentGuildId}/owner-tools/export-csv`, '_blank');
  };

  // Filter recruits by search
  const filteredRecruits = useMemo(() => {
    if (!searchMemberQuery.trim()) return recruitsItems;
    const q = searchMemberQuery.toLowerCase().trim();
    return recruitsItems.filter(
      (r) =>
        r.joined_user_name.toLowerCase().includes(q) ||
        r.recruiter_name.toLowerCase().includes(q) ||
        r.joined_user_id.includes(q)
    );
  }, [recruitsItems, searchMemberQuery]);

  const isUserRepresentative = Boolean(userStats.inviteCode || userStats.inviteUrl || summary.slotsFilled > 0);

  return (
    <div className="w-full space-y-6 pb-12 font-sans animate-in fade-in duration-150">
      {/* ── BREADCRUMB & HEADER (Section 7.2: ServerIcon, ServerName, NO "Active" badge) ── */}
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-500 font-sans">
          <span>My joins</span>
          <ChevronRight className="size-3 text-zinc-600" />
          <span className="text-zinc-400 font-medium truncate max-w-[200px]">{serverName}</span>
          <ChevronRight className="size-3 text-zinc-600" />
          <span className="text-white font-medium">Recruit hub</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <ServerIcon
              guildId={currentGuildId}
              iconUrl={serverIcon}
              name={serverName}
              size={48}
              className="size-12 rounded-xl object-cover shrink-0"
            />
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-lg font-bold text-white tracking-tight truncate font-sans">
                {serverName}
              </h1>
              <p className="text-xs text-zinc-400 font-sans">
                Invite friends with your tracked link, verify retention, and earn credits.
              </p>
            </div>
          </div>

          {/* View switcher for server managers (Owner only) */}
          {isOwner && (
            <div className="flex items-center rounded-xl bg-[#141416] p-1 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('member')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans',
                  viewMode === 'member'
                    ? 'bg-[#272727] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                Member view
              </button>
              <button
                type="button"
                onClick={() => setViewMode('owner')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans',
                  viewMode === 'owner'
                    ? 'bg-[#272727] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                Owner view
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── 1. MEMBER VIEW ─────────────────────────────────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'member' && (
        <div className="space-y-6">
          {/* Empty state if user is not a representative anywhere (Section 7.1) */}
          {!isUserRepresentative && !isOwner ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E11] p-12 text-center space-y-4">
              <div className="size-12 rounded-full bg-[#141417] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                <Users className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white font-sans">
                  You are not a representative yet.
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sans">
                  Join a server that is recruiting to start earning credits by bringing active members.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard/1530147023754367006/earn')}
                className="bg-[#272727] hover:bg-[#323232] text-zinc-200 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Explore recruiting servers
              </Button>
            </div>
          ) : (
            <>
              {/* YOUR INVITE LINK CARD (Section 7.3: Icon + Name above link, Copy, Share) */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <ServerIcon
                    guildId={currentGuildId}
                    iconUrl={serverIcon}
                    name={serverName}
                    size={28}
                    className="size-7 rounded-lg object-cover shrink-0"
                  />
                  <div>
                    <h2 className="text-sm font-semibold text-white font-sans">{serverName}</h2>
                    <p className="text-xs text-zinc-400 font-sans">
                      Share this link with friends. If they join and stay, you earn credits.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex items-center h-10 px-3.5 rounded-xl bg-[#141417] border border-white/10 text-white font-mono text-xs flex-1 truncate select-all">
                    {userStats.inviteUrl || `https://discord.gg/${userStats.inviteCode || 'central'}`}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCopy}
                    className="bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold text-xs h-10 px-4 rounded-xl cursor-pointer shrink-0 gap-1.5"
                  >
                    {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="bg-[#272727] hover:bg-[#323232] text-zinc-200 border-white/10 text-xs h-10 px-4 rounded-xl cursor-pointer shrink-0 gap-1.5"
                  >
                    <Share2 className="size-3.5" />
                    <span>Share</span>
                  </Button>
                </div>

                {/* If bot cannot create tracked invites */}
                {userStats.isMatched === false && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      Joins through this link cannot be matched to you yet. Ask the owner to give the ConnectingERLC bot the Create Invite permission.
                    </span>
                  </div>
                )}
              </div>

              {/* YOUR PERFORMANCE TILES */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white font-sans">Your performance</h2>
                  <span className="text-xs text-zinc-400 font-sans">Past 30 days telemetry</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1">
                    <span className="text-xs text-zinc-400 block font-sans">Joined</span>
                    <span className="text-xl font-bold text-white tabular-nums">{userStats.totalJoined}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1">
                    <span className="text-xs text-zinc-400 block font-sans">Staying</span>
                    <span className="text-xl font-bold text-white tabular-nums">{userStats.pendingCount}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1">
                    <span className="text-xs text-zinc-400 block font-sans">Verified</span>
                    <span className="text-xl font-bold text-[var(--accent)] tabular-nums">{userStats.verifiedCount}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1">
                    <span className="text-xs text-zinc-400 block font-sans">Credits earned</span>
                    <span className="text-xl font-bold text-white tabular-nums">+{userStats.creditsEarned}</span>
                  </div>
                </div>

                {/* 30-Day Verified Recruits Chart */}
                {trendData.length > 0 && (
                  <div className="pt-2 space-y-1.5 border-t border-white/[0.06]">
                    <span className="text-xs text-zinc-400 font-sans">30-day verified recruits</span>
                    <div className="h-24 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="recruitTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="verified"
                            stroke="var(--accent)"
                            strokeWidth={1.5}
                            fill="url(#recruitTrend)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* RECRUITS LIST */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white font-sans">Your recruits</h3>
                  <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="w-[120px] h-8 bg-[#141417] border-white/10 text-xs font-sans">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="pending">Staying</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="left_early">Left early</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredRecruits.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-500 font-sans">
                    No recruits logged yet. Share your invite link to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-[#141417] text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">User</th>
                          <th className="py-2.5 px-3 font-medium">Joined</th>
                          <th className="py-2.5 px-3 font-medium">Status</th>
                          <th className="py-2.5 px-3 font-medium text-right">Reward</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {filteredRecruits.map((rec) => (
                          <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2.5 px-3 font-medium text-white">{rec.joined_user_name}</td>
                            <td className="py-2.5 px-3 text-zinc-400">{new Date(rec.joined_at).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3">
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                rec.status === 'verified' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' :
                                rec.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-rose-500/10 text-rose-400'
                              )}>
                                {rec.status === 'verified' ? 'Verified' : rec.status === 'pending' ? 'Staying' : 'Left early'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-zinc-300">
                              {rec.status === 'verified' ? `+${rec.credits_awarded || 2} cr` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Step Down Trigger */}
              <div className="pt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStepDownOpen(true)}
                  className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 text-xs h-8 px-3 rounded-lg cursor-pointer"
                >
                  Step down as representative
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── 2. OWNER VIEW ───────────────────────────────────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'owner' && (
        <div className="space-y-6">
          {/* Owner Telemetry 4-Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0E0E11] space-y-1">
              <span className="text-xs text-zinc-400 block font-sans">Representative slots</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white tabular-nums">{summary.slotsFilled}</span>
                <span className="text-xs text-zinc-500">/ {summary.slotsWanted}</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0E0E11] space-y-1">
              <span className="text-xs text-zinc-400 block font-sans">Verified recruits</span>
              <span className="text-xl font-bold text-[var(--accent)] tabular-nums">{summary.verifiedRecruits}</span>
            </div>
            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0E0E11] space-y-1">
              <span className="text-xs text-zinc-400 block font-sans">Retention rate</span>
              <span className="text-xl font-bold text-white tabular-nums">{summary.retentionRate}%</span>
            </div>
            <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0E0E11] space-y-1">
              <span className="text-xs text-zinc-400 block font-sans">Credits awarded</span>
              <span className="text-xl font-bold text-white tabular-nums">{summary.creditsAwarded}</span>
            </div>
          </div>

          {/* OWNER SUB-TABS */}
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] pb-2">
            <button
              type="button"
              onClick={() => setOwnerTab('representatives')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer font-sans',
                ownerTab === 'representatives' ? 'bg-[#272727] text-white' : 'text-zinc-400 hover:text-white'
              )}
            >
              Representatives
            </button>
            <button
              type="button"
              onClick={() => setOwnerTab('activity')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer font-sans',
                ownerTab === 'activity' ? 'bg-[#272727] text-white' : 'text-zinc-400 hover:text-white'
              )}
            >
              Activity log
            </button>
            <button
              type="button"
              onClick={() => setOwnerTab('settings')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer font-sans',
                ownerTab === 'settings' ? 'bg-[#272727] text-white' : 'text-zinc-400 hover:text-white'
              )}
            >
              Recruiting settings
            </button>
            <button
              type="button"
              onClick={() => setOwnerTab('tools')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer font-sans',
                ownerTab === 'tools' ? 'bg-[#272727] text-white' : 'text-zinc-400 hover:text-white'
              )}
            >
              Owner tools
            </button>
          </div>

          {/* OWNER TAB 1: REPRESENTATIVES (Section 8: Always starts with Owner) */}
          {ownerTab === 'representatives' && (
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white font-sans">Representatives</h3>
                  <p className="text-xs text-zinc-400 font-sans">
                    Approved server representatives recruiting members.
                  </p>
                </div>
                <span className="text-xs text-zinc-400 font-sans">{1 + repsItems.length} total</span>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {/* ALWAYS STARTS WITH THE OWNER (Section 8) */}
                <div className="py-3 px-1 flex items-center justify-between gap-3 text-xs font-sans hover:bg-white/[0.02] rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      userId={summary.serverOwner?.userId || user?.id}
                      avatarHash={summary.serverOwner?.avatarHash || user?.avatar}
                      name={summary.serverOwner?.userName || user?.globalName || user?.username || 'Server Owner'}
                      size={32}
                      className="size-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {summary.serverOwner?.userName || user?.globalName || user?.username || 'Server Owner'}
                      </span>
                      <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[10px] font-semibold text-[var(--accent)] tracking-wider uppercase shrink-0">
                        Owner
                      </span>
                    </div>
                  </div>
                  {/* Protected: NO Remove action for the owner */}
                </div>

                {/* Approved representatives */}
                {repsItems.map((rep) => (
                  <div
                    key={rep.recruiter_id}
                    className="py-3 px-1 flex items-center justify-between gap-3 text-xs font-sans hover:bg-white/[0.02] rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        userId={rep.recruiter_id}
                        avatarHash={rep.recruiter_avatar}
                        name={rep.recruiter_name}
                        size={32}
                        className="size-8 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-white truncate block">
                          {rep.recruiter_name}
                        </span>
                        <span className="text-[11px] text-zinc-400 block tabular-nums">
                          {rep.verifiedCount} {rep.verifiedCount === 1 ? 'recruit' : 'recruits'}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActionDialog({
                          isOpen: true,
                          type: 'remove_rep',
                          targetId: rep.recruiter_id,
                          targetName: rep.recruiter_name,
                          reason: 'Removed by owner',
                          deleteDays: 0,
                          isLoading: false,
                        });
                      }}
                      className="h-8 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {/* Empty state appears under owner row if no other reps exist */}
              {repsItems.length === 0 && (
                <div className="py-4 text-center text-xs text-zinc-500 font-sans">
                  No representatives yet.
                </div>
              )}
            </div>
          )}

          {/* OWNER TAB 2: ACTIVITY LOG */}
          {ownerTab === 'activity' && (
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white font-sans">Recruiting activity log</h3>
              {activityLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500 font-sans">
                  No recent recruiting activity logged.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {activityLogs.map((act) => (
                    <div key={act.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-medium text-white mr-2">
                          {act.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-zinc-400">
                          {act.user_name || act.user_id} {act.reason ? `— ${act.reason}` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* OWNER TAB 3: RECRUITING SETTINGS (Section 7.4 Rebuilt Grid Layout) */}
          {ownerTab === 'settings' && (
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-6 space-y-6">
              <div className="space-y-1 pb-2 border-b border-white/[0.06]">
                <h3 className="text-base font-bold text-white font-sans">Recruiting</h3>
                <p className="text-xs text-zinc-400 font-sans">
                  Rules, roles and notifications for your representatives.
                </p>
              </div>

              <div className="space-y-0 min-w-0">
                {/* 1. Representatives wanted */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Representatives wanted</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Number of slots open for community members to become representatives (0 to 50).
                    </p>
                  </div>
                  <div className="w-[120px] shrink-0">
                    <NumberField
                      min={0}
                      max={50}
                      value={settings.representatives_wanted}
                      onChange={(val) => handleSaveSettings({ representatives_wanted: val })}
                      suffix="slots"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* 2. Credits per recruit */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Credits per recruit</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Reward paid to representative from server treasury upon verified stay (0 to 10).
                    </p>
                  </div>
                  <div className="w-[120px] shrink-0">
                    <NumberField
                      min={0}
                      max={10}
                      value={settings.credits_per_recruit}
                      onChange={(val) => handleSaveSettings({ credits_per_recruit: val })}
                      suffix="credits"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* 3. Approve manually */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Approve manually</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Require manual review and approval before granting tracked representative links.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={settings.approve_manually}
                      onCheckedChange={(checked) => handleSaveSettings({ approve_manually: checked })}
                    />
                  </div>
                </div>

                {/* 4. Minimum stay */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Minimum stay</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      How long a new member must stay in your server for the join to count.
                    </p>
                  </div>
                  <div className="w-[220px] shrink-0">
                    <Select
                      value={String(settings.retention_hours)}
                      onValueChange={(val) => handleSaveSettings({ retention_hours: Number(val) })}
                    >
                      <SelectTrigger className="bg-[#141416] border-white/10 text-white text-xs h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161616] border-white/10 text-white">
                        <SelectItem value="72">3 days (72h)</SelectItem>
                        <SelectItem value="168">7 days (168h)</SelectItem>
                        <SelectItem value="336">14 days (336h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 5. Representative role */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Representative role</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Discord role automatically granted to active representatives.
                    </p>
                  </div>
                  <div className="w-[220px] shrink-0">
                    <Select
                      value={settings.rep_role_id || 'none'}
                      onValueChange={(val) => handleSaveSettings({ rep_role_id: val === 'none' ? null : val })}
                    >
                      <SelectTrigger className="bg-[#141416] border-white/10 text-white text-xs h-9 rounded-xl">
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161616] border-white/10 text-white">
                        <SelectItem value="none" className="text-zinc-400">None</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-white">
                            <span>{r.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 6. Recruit role */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Recruit role</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Discord role granted to new members who join through a representative link.
                    </p>
                  </div>
                  <div className="w-[220px] shrink-0">
                    <Select
                      value={settings.recruit_role_id || 'none'}
                      onValueChange={(val) => handleSaveSettings({ recruit_role_id: val === 'none' ? null : val })}
                    >
                      <SelectTrigger className="bg-[#141416] border-white/10 text-white text-xs h-9 rounded-xl">
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161616] border-white/10 text-white">
                        <SelectItem value="none" className="text-zinc-400">None</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-white">
                            <span>{r.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 7. Log channel */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Log channel</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Discord text channel where ConnectingERLC posts recruit verification notices.
                    </p>
                  </div>
                  <div className="w-[220px] shrink-0">
                    <Select
                      value={settings.log_channel_id || 'none'}
                      onValueChange={(val) => handleSaveSettings({ log_channel_id: val === 'none' ? null : val })}
                    >
                      <SelectTrigger className="bg-[#141416] border-white/10 text-white text-xs h-9 rounded-xl">
                        <SelectValue placeholder="Select channel..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161616] border-white/10 text-white">
                        <SelectItem value="none" className="text-zinc-400">None</SelectItem>
                        {channels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id} className="text-white">
                            <span>#{ch.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 8. DM me */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4 border-b border-white/[0.06]">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">DM me</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Receive private Discord DM advisories when new members join or retention completes.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={settings.dm_owner}
                      onCheckedChange={(checked) => handleSaveSettings({ dm_owner: checked })}
                    />
                  </div>
                </div>

                {/* 9. Send a test panel */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-6 items-center py-4">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[14px] font-medium text-white block font-sans">Send a test panel</label>
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">
                      Test bot channel permissions by dispatching a verification panel V2.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestPanel}
                      disabled={isSendingTestPanel || !settings.log_channel_id}
                      className="bg-[#141417] hover:bg-[#19191D] text-zinc-200 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
                    >
                      {isSendingTestPanel ? 'Dispatching…' : 'Send test panel'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OWNER TAB 4: OWNER TOOLS (Section 7.5 OWNER ONLY) */}
          {ownerTab === 'tools' && (
            <div className="space-y-6">
              {/* Bot Permissions Notice Bar */}
              {(!botPerms.hasKick || !botPerms.hasBan) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                    <span className="truncate">
                      ConnectingERLC bot is missing Kick Members or Ban Members permissions in your Discord server.
                    </span>
                  </div>
                  <a
                    href={`https://discord.com/oauth2/authorize?client_id=1448658055620165784&permissions=8&scope=bot`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-white font-medium hover:text-amber-200 shrink-0"
                  >
                    Fix permissions
                  </a>
                </div>
              )}

              {/* Toolbar: Pause recruiting, Revoke all invites, Export CSV */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const res = await fetch(`/api/servers/${currentGuildId}/owner-tools/pause`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paused: settings.enabled }),
                      });
                      if (res.ok) {
                        setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
                        addToast?.('success', 'Status updated', `Recruiting ${settings.enabled ? 'paused' : 'resumed'}.`);
                      }
                    }}
                    className="bg-[#141417] hover:bg-[#19191D] text-zinc-200 border-white/10 text-xs h-9 px-3.5 rounded-xl cursor-pointer gap-1.5"
                  >
                    {settings.enabled ? <Pause className="size-3.5 text-amber-400" /> : <Play className="size-3.5 text-[var(--accent)]" />}
                    <span>{settings.enabled ? 'Pause recruiting' : 'Resume recruiting'}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionDialog({
                        isOpen: true,
                        type: 'revoke_all',
                        targetId: 'all',
                        targetName: 'all active representative invites',
                        reason: '',
                        deleteDays: 0,
                        isLoading: false,
                      });
                    }}
                    className="bg-[#141417] hover:bg-[#19191D] text-zinc-200 border-white/10 text-xs h-9 px-3.5 rounded-xl cursor-pointer gap-1.5"
                  >
                    <KeyRound className="size-3.5 text-rose-400" />
                    <span>Revoke all representative invites</span>
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  className="bg-[#272727] hover:bg-[#323232] text-zinc-200 border-white/10 text-xs h-9 px-3.5 rounded-xl cursor-pointer gap-1.5"
                >
                  <Download className="size-3.5" />
                  <span>Export recruits (CSV)</span>
                </Button>
              </div>

              {/* Representatives in Owner View (Section 8) */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white font-sans">Representatives</h3>
                    <p className="text-xs text-zinc-400 font-sans">
                      Approved server representatives recruiting members.
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 font-sans">{1 + repsItems.length} total</span>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {/* ALWAYS STARTS WITH THE OWNER (Section 8) */}
                  <div className="py-3 px-1 flex items-center justify-between gap-3 text-xs font-sans hover:bg-white/[0.02] rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        userId={summary.serverOwner?.userId || (isOwner ? user?.id : undefined)}
                        avatarHash={summary.serverOwner?.avatarHash || (isOwner ? user?.avatar : undefined)}
                        name={summary.serverOwner?.userName || (isOwner ? (user?.globalName || user?.username) : 'Server Owner')}
                        size={32}
                        className="size-8 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {summary.serverOwner?.userName || (isOwner ? (user?.globalName || user?.username) : 'Server Owner')}
                        </span>
                        <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[10px] font-semibold text-[var(--accent)] tracking-wider uppercase shrink-0">
                          Owner
                        </span>
                      </div>
                    </div>
                    {/* Protected: NO Remove action for the owner */}
                  </div>

                  {repsItems.map((rep) => (
                    <div
                      key={rep.recruiter_id}
                      className="py-3 px-1 flex items-center justify-between gap-3 text-xs font-sans hover:bg-white/[0.02] rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          userId={rep.recruiter_id}
                          avatarHash={rep.recruiter_avatar}
                          name={rep.recruiter_name}
                          size={32}
                          className="size-8 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-medium text-white truncate block">
                            {rep.recruiter_name}
                          </span>
                          <span className="text-[11px] text-zinc-400 block tabular-nums">
                            {rep.verifiedCount} {rep.verifiedCount === 1 ? 'recruit' : 'recruits'}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActionDialog({
                            isOpen: true,
                            type: 'remove_rep',
                            targetId: rep.recruiter_id,
                            targetName: rep.recruiter_name,
                            reason: 'Removed by owner',
                            deleteDays: 0,
                            isLoading: false,
                          });
                        }}
                        className="h-8 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                {repsItems.length === 0 && (
                  <div className="py-4 text-center text-xs text-zinc-500 font-sans">
                    No representatives yet.
                  </div>
                )}
              </div>

              {/* Members Found Through ConnectingERLC (Searchable Table with 3-dots Menu) */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white font-sans">
                      Members found through ConnectingERLC ({filteredRecruits.length})
                    </h3>
                    <p className="text-xs text-zinc-400 font-sans">
                      Search and moderate members recruited through platform tracked invites.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchMemberQuery}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      placeholder="Search member or recruiter…"
                      className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#141417] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[var(--accent)] font-sans"
                    />
                  </div>
                </div>

                {filteredRecruits.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500 font-sans">
                    No members match your search.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-[#141417] text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Member</th>
                          <th className="py-2.5 px-3 font-medium">Joined</th>
                          <th className="py-2.5 px-3 font-medium">Invited by</th>
                          <th className="py-2.5 px-3 font-medium">Status</th>
                          <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {filteredRecruits.map((rec) => (
                          <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar
                                  userId={rec.joined_user_id}
                                  avatarHash={rec.joined_user_avatar}
                                  name={rec.joined_user_name}
                                  size={28}
                                  className="size-7 rounded-full object-cover shrink-0"
                                />
                                <div>
                                  <span className="font-medium text-white truncate block max-w-[140px] font-sans">
                                    {rec.joined_user_name}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono block">
                                    {rec.joined_user_id}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-zinc-300 tabular-nums">
                              {new Date(rec.joined_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 text-zinc-300">
                              {rec.recruiter_name}
                            </td>
                            <td className="py-3 px-3">
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                rec.status === 'verified' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' :
                                rec.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-rose-500/10 text-rose-400'
                              )}>
                                {rec.status === 'verified' ? 'Verified' : rec.status === 'pending' ? 'Staying' : 'Left early'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Member options"
                                    className="size-7 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <MoreVertical className="size-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-[#141417] border-white/10 text-xs">
                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({
                                      isOpen: true,
                                      type: 'kick',
                                      targetId: rec.joined_user_id,
                                      targetName: rec.joined_user_name,
                                      reason: '',
                                      deleteDays: 0,
                                      isLoading: false,
                                    })}
                                    className="text-zinc-200 hover:text-white cursor-pointer"
                                  >
                                    <UserX className="size-3.5 mr-2 text-amber-400" />
                                    Kick from server
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({
                                      isOpen: true,
                                      type: 'ban',
                                      targetId: rec.joined_user_id,
                                      targetName: rec.joined_user_name,
                                      reason: '',
                                      deleteDays: 1,
                                      isLoading: false,
                                    })}
                                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                                  >
                                    <Ban className="size-3.5 mr-2 text-rose-400" />
                                    Ban from server
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator className="bg-white/[0.06]" />

                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({
                                      isOpen: true,
                                      type: 'block',
                                      targetId: rec.recruiter_user_id,
                                      targetName: rec.recruiter_name,
                                      reason: '',
                                      deleteDays: 0,
                                      isLoading: false,
                                    })}
                                    className="text-zinc-200 hover:text-white cursor-pointer"
                                  >
                                    <Shield className="size-3.5 mr-2 text-zinc-400" />
                                    Block from recruiting
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({
                                      isOpen: true,
                                      type: 'reverse',
                                      targetId: rec.id,
                                      targetName: rec.joined_user_name,
                                      reason: '',
                                      deleteDays: 0,
                                      isLoading: false,
                                    })}
                                    className="text-zinc-200 hover:text-white cursor-pointer"
                                  >
                                    <RotateCcw className="size-3.5 mr-2 text-amber-400" />
                                    Reverse this recruit
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({
                                      isOpen: true,
                                      type: 'remove_rep',
                                      targetId: rec.recruiter_user_id,
                                      targetName: rec.recruiter_name,
                                      reason: '',
                                      deleteDays: 0,
                                      isLoading: false,
                                    })}
                                    className="text-zinc-200 hover:text-white cursor-pointer"
                                  >
                                    <UserX className="size-3.5 mr-2 text-zinc-400" />
                                    Remove representative
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP DOWN CONFIRMATION DIALOG ── */}
      <Dialog open={stepDownOpen} onOpenChange={setStepDownOpen}>
        <DialogContent className="max-w-md bg-[#0E0E11] border-white/10 text-white rounded-2xl p-6 font-sans">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-bold text-white font-sans">
              Step down as representative?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed font-sans">
              Your personal recruit link will be deactivated. Pending member retention clocks will continue, but you will stop receiving new recruit credit bounties.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStepDownOpen(false)}
              className="text-zinc-400 hover:text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSteppingDown}
              onClick={handleStepDownConfirm}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              {isSteppingDown ? 'Stepping down…' : 'Confirm step down'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── OWNER ACTION CONFIRMATION DIALOG (Kick, Ban, Block, Reverse, Revoke) ── */}
      <Dialog open={actionDialog.isOpen} onOpenChange={(open) => setActionDialog((prev) => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md bg-[#0E0E11] border-white/10 text-white rounded-2xl p-6 font-sans">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-bold text-white font-sans">
              {actionDialog.type === 'kick' && `Kick ${actionDialog.targetName}?`}
              {actionDialog.type === 'ban' && `Ban ${actionDialog.targetName}?`}
              {actionDialog.type === 'block' && `Block ${actionDialog.targetName} from recruiting?`}
              {actionDialog.type === 'reverse' && `Reverse recruit for ${actionDialog.targetName}?`}
              {actionDialog.type === 'remove_rep' && `Remove ${actionDialog.targetName} as representative?`}
              {actionDialog.type === 'revoke_all' && `Revoke all representative invites?`}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed font-sans">
              This administrative action requires an audit reason and will be logged to the server telemetry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 font-sans">Reason</label>
              <input
                type="text"
                value={actionDialog.reason}
                onChange={(e) => setActionDialog((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for this action…"
                className="w-full h-9 rounded-xl bg-[#141417] border border-white/10 px-3 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[var(--accent)] font-sans"
              />
            </div>

            {actionDialog.type === 'ban' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 font-sans">Delete message history</label>
                <Select
                  value={String(actionDialog.deleteDays)}
                  onValueChange={(val) => setActionDialog((prev) => ({ ...prev, deleteDays: Number(val) }))}
                >
                  <SelectTrigger className="bg-[#141416] border-white/10 text-white text-xs h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161616] border-white/10 text-white">
                    <SelectItem value="0">Don't delete any</SelectItem>
                    <SelectItem value="1">Previous 24 hours</SelectItem>
                    <SelectItem value="7">Previous 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActionDialog((prev) => ({ ...prev, isOpen: false }))}
              className="text-zinc-400 hover:text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionDialog.isLoading || !actionDialog.reason.trim()}
              onClick={handleExecuteOwnerAction}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              {actionDialog.isLoading ? 'Applying…' : 'Confirm action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RecruitsTab;
