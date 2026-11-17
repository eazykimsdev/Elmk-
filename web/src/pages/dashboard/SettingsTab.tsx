import React, { useState, useEffect } from 'react';
import {
  User,
  Bell,
  KeyRound,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Send,
  Hash,
  Shield,
  ShieldAlert,
  Radio,
  Sliders,
  Bot,
  Trash2,
  AlertTriangle,
  Palette,
  MessageSquare,
  Server,
  X,
  Volume2,
  Sparkles,
  Wrench
} from 'lucide-react';

import { useTheme } from '@/components/library/theme-provider';
import { ThemeSetting } from '@/components/ThemeSetting';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { updateWorkspaceCredentials, sendTestNotification } from '@/lib/api';
import { ServerIcon } from '@/components/ui/ServerIcon';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

interface SettingsTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onChangeConfig: (updates: Partial<WorkspaceCustomizations>) => void;
  onSaveConfig: () => Promise<void>;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

// Danger Zone Component (Server & Account Deletion)
function DangerZone({
  serverName,
  guildId,
  isOwner,
  user,
  addToast,
}: {
  serverName: string;
  guildId: string;
  isOwner: boolean;
  user: any;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}) {
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [confirmServerName, setConfirmServerName] = useState('');
  const [isDeletingServer, setIsDeletingServer] = useState(false);

  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteServer = async () => {
    if (confirmServerName.trim() !== serverName.trim()) return;
    setIsDeletingServer(true);
    try {
      const res = await fetch(`/api/servers/${guildId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: confirmServerName.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 && data.requireReauth) {
        addToast('error', 'Re-authentication required', 'Please sign out and sign in again before deleting a server.');
        setShowServerDialog(false);
        return;
      }

      if (res.status === 204 || res.ok) {
        addToast('success', 'Server deleted', `${serverName} was permanently deleted.`);
        setShowServerDialog(false);
        try {
          const promoRaw = localStorage.getItem('erlcus_promoted_servers');
          if (promoRaw) {
            const list = JSON.parse(promoRaw).filter((s: any) => s.id !== guildId);
            localStorage.setItem('erlcus_promoted_servers', JSON.stringify(list));
          }
          const knownRaw = localStorage.getItem('erlcus_known_guilds');
          if (knownRaw) {
            const list = JSON.parse(knownRaw).filter((s: any) => s.id !== guildId);
            localStorage.setItem('erlcus_known_guilds', JSON.stringify(list));
          }
          localStorage.removeItem(`erlcus_workspace_${guildId}`);
          localStorage.removeItem(`erlcus_credits_balance_${guildId}`);
        } catch {}

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1200);
      } else {
        addToast('error', 'Deletion failed', data.error || 'Could not delete server.');
      }
    } catch {
      addToast('error', 'Network error', 'Failed to connect to server.');
    } finally {
      setIsDeletingServer(false);
    }
  };

  const handleDeleteAccount = async () => {
    const expected = user?.username || '';
    if (confirmUsername.trim().toLowerCase() !== expected.trim().toLowerCase()) return;
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmUsername: confirmUsername.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 && data.requireReauth) {
        addToast('error', 'Re-authentication required', 'Please sign out and sign in again before deleting your account.');
        setShowAccountDialog(false);
        return;
      }

      if (res.ok) {
        addToast('success', 'Account deleted', 'Your account and all owned servers were permanently wiped.');
        setShowAccountDialog(false);
        try {
          localStorage.clear();
        } catch {}
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      } else {
        addToast('error', 'Deletion failed', data.error || 'Could not delete account.');
      }
    } catch {
      addToast('error', 'Network error', 'Failed to connect to server.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const deleteItems = [
    'Listing and banner files',
    'Reviews and ratings',
    'Team roles & staff links',
    'API keys and webhooks',
    'ER:LC credentials',
    'Representatives',
    'Recruit logs & referrals',
    'Tracked invites',
    'Partnerships',
    'Bump reminders',
    'Workspace customizations',
    'Analytics & telemetry',
  ];

  return (
    <div className="mt-6">
      {/* Combined Danger Zone Card (Point 6) */}
      <div className="rounded-2xl border border-[#F97316]/25 bg-[#0E0E11] p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white font-sans tracking-tight">
            Danger zone
          </h3>
          <p className="text-xs text-zinc-400 font-sans">
            Irreversible actions for this community server and your ConnectingERLC account.
          </p>
        </div>

        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {/* Row 1: Delete server from ConnectingERLC */}
          {isOwner && (
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-white font-sans">
                  Delete server from ConnectingERLC
                </h4>
                <p className="text-xs text-zinc-400 font-sans">
                  Permanently removes the directory listing, settings, and all telemetry for {serverName}. This cannot be undone.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmServerName('');
                  setShowServerDialog(true);
                }}
                className="bg-transparent hover:bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/40 text-xs font-semibold h-9 px-4 rounded-xl cursor-pointer shrink-0"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                <span>Delete server</span>
              </Button>
            </div>
          )}

          {/* Row 2: Delete my account and all my servers */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-white font-sans">
                Delete my account and all my servers
              </h4>
              <p className="text-xs text-zinc-400 font-sans">
                Permanently wipes your account identity, all servers you own, listings, and configurations. Irreversible.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmUsername('');
                setShowAccountDialog(true);
              }}
              className="bg-transparent hover:bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/40 text-xs font-semibold h-9 px-4 rounded-xl cursor-pointer shrink-0"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              <span>Delete account</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Server Delete Modal */}
      {showServerDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-[#F97316]/30 bg-[#0E0E11] text-zinc-100 shadow-2xl p-6 space-y-5 font-sans"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-[#F97316] shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Delete {serverName}?
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    This action is permanent and cannot be reversed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowServerDialog(false)}
                className="size-7 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center hover:bg-white/[0.05] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-300 block">
                The following data will be permanently wiped:
              </span>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#141417] border border-white/[0.06] text-xs text-zinc-300">
                {deleteItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-[#F97316] shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#F97316]/25 bg-[#F97316]/10 p-3.5 flex items-start gap-3 text-xs text-zinc-200">
              <AlertTriangle className="size-4 text-[#F97316] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Active partnerships will end. Pending join and recruit rewards will be cancelled.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs text-zinc-300 block">
                To confirm deletion, type <strong className="text-white font-semibold select-all font-mono">"{serverName}"</strong> below:
              </label>
              <Input
                value={confirmServerName}
                onChange={(e) => setConfirmServerName(e.target.value)}
                placeholder={`Type "${serverName}" to confirm...`}
                className="bg-[#141416] border-white/10 text-xs text-white rounded-xl h-10 font-sans focus:border-[#F97316]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowServerDialog(false)}
                className="bg-[#19191D] hover:bg-[#222227] text-zinc-300 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={confirmServerName.trim() !== serverName.trim() || isDeletingServer}
                onClick={handleDeleteServer}
                className="bg-transparent hover:bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/50 text-xs font-semibold h-9 px-4 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingServer ? 'Deleting server...' : 'Delete server'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Account Delete Modal */}
      {showAccountDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-[#F97316]/30 bg-[#0E0E11] text-zinc-100 shadow-2xl p-6 space-y-5 font-sans"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-[#F97316] shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Delete Account & All Servers?
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    This hard deletes your user record and every server you own on ConnectingERLC.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountDialog(false)}
                className="size-7 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center hover:bg-white/[0.05] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-xl border border-[#F97316]/25 bg-[#F97316]/10 p-3.5 text-xs text-zinc-200 leading-relaxed">
              Your reviews will be anonymized to "Deleted user". All active server listings and webhooks will be deleted. A final confirmation summary will be sent to your Discord DM before logout.
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs text-zinc-300 block">
                To confirm account deletion, type your Discord username <strong className="text-white font-semibold select-all font-mono">"{user?.username}"</strong> below:
              </label>
              <Input
                value={confirmUsername}
                onChange={(e) => setConfirmUsername(e.target.value)}
                placeholder={`Type "${user?.username}" to confirm...`}
                className="bg-[#141416] border-white/10 text-xs text-white rounded-xl h-10 font-sans focus:border-[#F97316]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAccountDialog(false)}
                className="bg-[#19191D] hover:bg-[#222227] text-zinc-300 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={confirmUsername.trim().toLowerCase() !== (user?.username || '').trim().toLowerCase() || isDeletingAccount}
                onClick={handleDeleteAccount}
                className="bg-transparent hover:bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/50 text-xs font-semibold h-9 px-4 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingAccount ? 'Deleting account...' : 'Delete account and all servers'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsTab({
  guild,
  workspace,
  config,
  onChangeConfig,
  onSaveConfig,
  addToast,
}: SettingsTabProps) {
  const { user } = useAuth();

  const guildId = guild?.id || workspace?.guildId || '';
  const serverName = guild?.name || config.serverName || 'Community Server';

  const isOwner = Boolean(
    user?.role === 'Owner' ||
    guild?.owner === true ||
    (guild as any)?.owner === true ||
    guild?.ownerId === user?.id ||
    workspace?.ownerUserId === user?.id ||
    (user as any)?.isOwner
  );

  // Credentials State
  const [erlcKey, setErlcKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  // User isolated preferences (saved to /api/user/settings) - Section 9.1: NO email notifications
  const [inAppNotifs, setInAppNotifs] = useState(true);
  const [directoryJoinAlerts, setDirectoryJoinAlerts] = useState(true);
  const [partnershipRequestAlerts, setPartnershipRequestAlerts] = useState(true);
  const [discordDmNotifs, setDiscordDmNotifs] = useState(true);
  const [discordDmWeeklyDigest, setDiscordDmWeeklyDigest] = useState(true);
  const [discordDmSecurityAlerts, setDiscordDmSecurityAlerts] = useState(true);

  const [defaultServerMode, setDefaultServerMode] = useState<string>(() => {
    return localStorage.getItem('erlcus_default_guild_mode') || 'last_active';
  });

  useEffect(() => {
    let mounted = true;
    async function loadUserSettings() {
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data?.settings) {
            if (data.settings.inAppNotifs !== undefined) setInAppNotifs(data.settings.inAppNotifs);
            if (data.settings.directoryJoinAlerts !== undefined) setDirectoryJoinAlerts(data.settings.directoryJoinAlerts);
            if (data.settings.partnershipRequestAlerts !== undefined) setPartnershipRequestAlerts(data.settings.partnershipRequestAlerts);
            if (data.settings.discordDmNotifs !== undefined) setDiscordDmNotifs(data.settings.discordDmNotifs);
            if (data.settings.discordDmWeeklyDigest !== undefined) setDiscordDmWeeklyDigest(data.settings.discordDmWeeklyDigest);
            if (data.settings.discordDmSecurityAlerts !== undefined) setDiscordDmSecurityAlerts(data.settings.discordDmSecurityAlerts);
            if (data.settings.defaultServerMode) setDefaultServerMode(data.settings.defaultServerMode);
          }
        }
      } catch {}
    }
    loadUserSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdateUserSetting = async (updates: Record<string, any>) => {
    try {
      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {}
  };

  // Local switch states for server-level defense
  const [bumpThanks, setBumpThanks] = useState<boolean>(() => {
    return localStorage.getItem(`erlcus_bump_enabled_${guildId}`) !== 'false';
  });
  const [antiRaidAlerts, setAntiRaidAlerts] = useState<boolean>(true);
  const [streakAlerts, setStreakAlerts] = useState<boolean>(true);
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  const handleSendTestNotification = async (type: 'bump' | 'streak' | 'partnership' | 'review') => {
    if (!guildId) return;
    setSendingTest(type);
    try {
      await sendTestNotification(guildId, type);
      addToast('success', 'Test notification sent', 'Check your Discord direct messages.');
    } catch (err: any) {
      addToast('error', 'Could not send test notification', err?.message || 'Failed to dispatch notification.');
    } finally {
      setSendingTest(null);
    }
  };

  // Real Discord channels & roles loaded from server
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; color?: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadGuildData() {
      try {
        const res = await fetch(`/api/workspace/${guildId}/discord-channels-and-roles`).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (mounted) {
            if (Array.isArray(data.channels)) setChannels(data.channels);
            if (Array.isArray(data.roles)) setRoles(data.roles);
          }
        }
      } catch (err) {
        console.warn('[SETTINGS] Could not load live guild telemetry:', err);
      }
    }

    if (guildId) loadGuildData();
    return () => {
      mounted = false;
    };
  }, [guildId]);

  // Giveaway code redemption state
  const [promoInputCode, setPromoInputCode] = useState('');
  const [promoTargetServerId, setPromoTargetServerId] = useState('');
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [redemptionSuccessDialog, setRedemptionSuccessDialog] = useState<{ open: boolean; amount: number; newBalance: number; serverName: string; code: string } | null>(null);
  const [userServers, setUserServers] = useState<Array<{ id: string; name: string; iconUrl?: string | null }>>([]);

  useEffect(() => {
    const list: Array<{ id: string; name: string; iconUrl?: string | null }> = [];
    if (guildId) {
      list.push({ id: guildId, name: serverName, iconUrl: guild?.iconUrl || null });
    }
    try {
      const stored = localStorage.getItem('erlcus_known_guilds');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((g: any) => {
            if (g && g.id && !list.some((x) => x.id === String(g.id))) {
              list.push({
                id: String(g.id),
                name: g.name || 'Server',
                iconUrl: g.iconUrl || (g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null),
              });
            }
          });
        }
      }
    } catch {}
    setUserServers(list);
  }, [guildId, serverName, guild?.iconUrl]);

  const handleRedeemPromo = async () => {
    if (!promoInputCode.trim()) return;
    const targetSid = (promoTargetServerId && promoTargetServerId !== 'wallet') ? promoTargetServerId : (guildId || null);

    setRedeemingPromo(true);
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInputCode.trim(),
          serverId: targetSid,
          requestId
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const amt = Number(data.amount || data.credits || 100);
        const newBal = Number(data.newBalance || 0);
        const sName = data.serverName || (targetSid ? (serverName || 'your server') : 'your community treasury');
        setRedemptionSuccessDialog({
          open: true,
          amount: amt,
          newBalance: newBal,
          serverName: sName,
          code: data.code || promoInputCode.trim()
        });
        setPromoInputCode('');
        window.dispatchEvent(new CustomEvent('credits_awarded', { detail: { amount: amt } }));
        window.dispatchEvent(new Event('balance_updated'));
      } else {
        addToast('error', 'Redemption failed', data.error || 'Invalid or expired giveaway code.');
      }
    } catch {
      addToast('error', 'Network error', 'Could not redeem code. Try again in a moment.');
    } finally {
      setRedeemingPromo(false);
    }
  };

  // Test notice state
  const [sendingTestNotice, setSendingTestNotice] = useState(false);

  const handleSendTestNotice = async () => {
    if (!config.bumpChannelId) {
      addToast('warning', 'Channel required', 'Please select a bump channel first.');
      return;
    }
    setSendingTestNotice(true);
    try {
      const res = await fetch(`/api/workspace/${guildId}/bump-notices/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: config.bumpChannelId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        addToast('success', 'Test notice posted', 'Check your Discord server channel for the test notice panel.');
      } else {
        addToast('error', 'Test delivery failed', data.error || 'Bot could not send messages to that channel.');
      }
    } catch {
      addToast('error', 'Network error', 'Failed to dispatch test notice.');
    } finally {
      setSendingTestNotice(false);
    }
  };

  const handleSaveErlcKey = async () => {
    if (!erlcKey.trim()) {
      addToast('warning', 'Missing key', 'Please enter your ER:LC API key.');
      return;
    }
    setSavingKey(true);
    try {
      await updateWorkspaceCredentials(guildId, { erlcApiKey: erlcKey.trim() });
      addToast('success', 'Credentials saved', 'ER:LC API credentials updated and securely stored.');
      setErlcKey('');
    } catch (err: any) {
      addToast('error', 'Update failed', err.message || 'Could not save API credentials.');
    } finally {
      setSavingKey(false);
    }
  };

  const userAvatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : (user as any)?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png';

  const displayName = user?.global_name || user?.username || 'Community Member';
  const userSnowflake = user?.id || '';

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-150 font-sans">
      <div className="w-full">
        <Tabs defaultValue="general" className="flex flex-col w-full">
          <div className="no-scrollbar mb-6 min-w-0 overflow-x-auto overflow-y-hidden pb-3">
            <TabsList className="bg-[#141416] p-1 border border-white/[0.06] rounded-xl h-auto gap-1">
              <TabsTrigger
                value="general"
                className="data-[state=active]:bg-[#272727] data-[state=active]:text-white text-zinc-400 text-xs font-medium rounded-lg px-3.5 py-1.5 gap-2 transition-all cursor-pointer"
              >
                <User className="size-3.5" />
                General
              </TabsTrigger>

              <TabsTrigger
                value="notifications"
                className="data-[state=active]:bg-[#272727] data-[state=active]:text-white text-zinc-400 text-xs font-medium rounded-lg px-3.5 py-1.5 gap-2 transition-all cursor-pointer"
              >
                <Bell className="size-3.5" />
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="billing"
                className="data-[state=active]:bg-[#272727] data-[state=active]:text-white text-zinc-400 text-xs font-medium rounded-lg px-3.5 py-1.5 gap-2 transition-all cursor-pointer"
              >
                <KeyRound className="size-3.5" />
                API & Credentials
              </TabsTrigger>
              <TabsTrigger
                value="bot"
                className="data-[state=active]:bg-[#272727] data-[state=active]:text-white text-zinc-400 text-xs font-medium rounded-lg px-3.5 py-1.5 gap-2 transition-all cursor-pointer"
              >
                <Bot className="size-3.5" />
                Bot & Gateway
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── TAB 1: GENERAL ── */}
          <TabsContent value="general" className="flex flex-col gap-6 animate-in fade-in-50 duration-150">
            {/* Authenticated Discord User Card */}
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0E0E11] p-4">
              <div className="flex items-center gap-3.5">
                <Avatar className="size-12 rounded-xl border border-white/10">
                  <AvatarImage src={userAvatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-[#272727] text-white text-sm font-semibold">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{displayName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300 border border-white/10">
                      Discord Account
                    </span>
                  </div>
                  <span className="text-zinc-500 font-mono text-xs">ID: {userSnowflake}</span>
                </div>
              </div>
            </div>

            {/* Server Identity & Preferences */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Server preferences</h3>
                <p className="text-zinc-400 text-xs mt-1">
                  Configure default routing and preferences for this community.
                </p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Server className="size-3.5 text-zinc-400" />
                      <span className="text-xs font-medium text-white">Default server on login</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Select which workspace loads automatically when you sign in to ConnectingERLC.
                    </p>
                  </div>
                  <Select
                    value={defaultServerMode}
                    onValueChange={(val) => {
                      setDefaultServerMode(val);
                      localStorage.setItem('erlcus_default_guild_mode', val);
                      handleUpdateUserSetting({ defaultServerMode: val });
                      addToast('info', 'Default server preference saved', `Set to ${val === 'last_active' ? 'Last active' : 'This server'}.`);
                    }}
                  >
                    <SelectTrigger className="w-[150px] bg-[#141416] border-white/10 text-xs text-white h-8.5 rounded-lg">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141416] border-white/10 text-white text-xs">
                      <SelectItem value="last_active">Last active server</SelectItem>
                      <SelectItem value="current">Current server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* REDEEM PROMO CODE CARD */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Redeem a promo code</h3>
                <p className="text-zinc-400 text-xs mt-1">
                  Enter an official promotional code to deposit free boost credits into your community treasury.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Promo code</label>
                  <Input
                    placeholder="e.g. LAUNCH100"
                    value={promoInputCode}
                    onChange={(e) => setPromoInputCode(e.target.value.toUpperCase())}
                    className="font-mono text-xs uppercase bg-[#141416] border-white/10 text-white rounded-xl h-9 focus:border-[var(--accent)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Target destination</label>
                  <Select
                    value={promoTargetServerId || guildId || 'wallet'}
                    onValueChange={(val) => setPromoTargetServerId(val === 'wallet' ? '' : val)}
                  >
                    <SelectTrigger className="w-full h-9 px-3 rounded-xl bg-[#141416] border border-white/10 text-xs font-medium text-white focus:border-[var(--accent)] cursor-pointer">
                      <SelectValue placeholder="Select target destination..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121215] border-white/10 text-white text-xs">
                      <SelectItem value="wallet" className="text-xs cursor-pointer hover:bg-white/[0.04]">
                        Personal User Wallet
                      </SelectItem>
                      {userServers.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs cursor-pointer hover:bg-white/[0.04]">
                          <div className="flex items-center gap-2">
                            <ServerIcon
                              guildId={s.id}
                              iconUrl={s.iconUrl}
                              name={s.name}
                              size={18}
                              className="size-4.5 rounded-sm object-cover"
                            />
                            <span className="truncate">{s.name}</span>
                            {s.id === guildId && (
                              <span className="text-[10px] text-zinc-500 font-normal">(Current)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-500">One redemption per community server.</span>
                <Button
                  type="button"
                  disabled={!promoInputCode.trim() || redeemingPromo}
                  onClick={handleRedeemPromo}
                  className="bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-semibold h-8.5 px-4 rounded-xl cursor-pointer disabled:opacity-40"
                >
                  {redeemingPromo ? 'Redeeming...' : 'Redeem code'}
                </Button>
              </div>
            </div>

            {/* Giveaway Code Redemption Success Dialog */}
            <Dialog open={redemptionSuccessDialog !== null} onOpenChange={(open) => !open && setRedemptionSuccessDialog(null)}>
              <DialogContent className="max-w-[420px] bg-[#0E0E11] border border-white/[0.1] rounded-2xl p-6 text-center space-y-4">
                <div className="size-12 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 mx-auto flex items-center justify-center">
                  <Sparkles className="size-6 text-[var(--accent)]" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-white font-sans">
                    Giveaway Code Redeemed!
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400 font-sans">
                    Your community treasury balance has been updated.
                  </DialogDescription>
                </div>
                <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-2 text-center">
                  <div className="text-2xl font-extrabold text-[var(--accent)] font-mono">
                    +{redemptionSuccessDialog?.amount} Credits
                  </div>
                  <div className="text-xs text-zinc-400 font-sans">
                    Deposited to <span className="text-white font-semibold">{redemptionSuccessDialog?.serverName}</span>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-sans">
                    <span className="text-zinc-500">New Balance</span>
                    <span className="text-white font-semibold font-mono">{redemptionSuccessDialog?.newBalance} credits</span>
                  </div>
                </div>
                <Button
                  onClick={() => setRedemptionSuccessDialog(null)}
                  className="w-full bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] font-semibold text-xs h-9 cursor-pointer"
                >
                  Done
                </Button>
              </DialogContent>
            </Dialog>

            {/* System Status & Maintenance Controls */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-white">Emergency maintenance controls</h3>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1">
                    Control public under construction screens for the whole site or specific features if something goes wrong.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-zinc-500">
                  Selectively take down Boosts, Forms, Server Pages, or the entire website anytime from the Admin Portal.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = '/admin-portal';
                  }}
                  className="text-xs border-white/10 hover:bg-white/5 cursor-pointer text-zinc-300 shrink-0"
                >
                  Manage maintenance &rarr;
                </Button>
              </div>
            </div>

            {/* DANGER ZONE (Visible ONLY on General and Appearance tabs, Owner only) */}
            <DangerZone
              serverName={serverName}
              guildId={guildId}
              isOwner={isOwner}
              user={user}
              addToast={addToast}
            />
          </TabsContent>

          {/* ── TAB 3: NOTIFICATIONS ── */}
          <TabsContent value="notifications" className="flex flex-col gap-6 animate-in fade-in-50 duration-150">
            {/* IN-APP NOTIFICATIONS */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-white">In-app notifications</h3>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Manage real-time notifications, bell indicators, and toast alerts in your browser.
                </p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">In-app notification bell & toasts</span>
                    <p className="text-[11px] text-zinc-500">
                      Show popup alerts and unread count badges in the top bar when updates arrive.
                    </p>
                  </div>
                  <Switch
                    checked={inAppNotifs}
                    onCheckedChange={(val) => {
                      setInAppNotifs(val);
                      handleUpdateUserSetting({ inAppNotifs: val });
                      addToast('info', val ? 'In-app alerts on' : 'In-app alerts muted', 'Preference saved.');
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Directory & join alerts</span>
                    <p className="text-[11px] text-zinc-500">
                      Receive notices when new members join your server through the Earn Credits directory.
                    </p>
                  </div>
                  <Switch
                    checked={directoryJoinAlerts}
                    onCheckedChange={(val) => {
                      setDirectoryJoinAlerts(val);
                      handleUpdateUserSetting({ directoryJoinAlerts: val });
                      addToast('info', val ? 'Join alerts on' : 'Join alerts muted', 'Preference saved.');
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Partnership requests</span>
                    <p className="text-[11px] text-zinc-500">
                      Get notified instantly when other roleplay communities send partnership proposals.
                    </p>
                  </div>
                  <Switch
                    checked={partnershipRequestAlerts}
                    onCheckedChange={(val) => {
                      setPartnershipRequestAlerts(val);
                      handleUpdateUserSetting({ partnershipRequestAlerts: val });
                      addToast('info', val ? 'Partnership alerts on' : 'Partnership alerts muted', 'Preference saved.');
                    }}
                  />
                </div>
              </div>
            </div>

            {/* DISCORD DM NOTIFICATIONS */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-white">Discord DM notifications</h3>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Deliver notifications directly to your Discord account via the ConnectingERLC bot.
                </p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Bump reminder</span>
                    <p className="text-[11px] text-zinc-500">
                      Direct message when your bump cooldown expires and your server is ready to bump again.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sendingTest !== null}
                      onClick={() => handleSendTestNotification('bump')}
                      className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white"
                    >
                      {sendingTest === 'bump' ? 'Sending…' : 'Send test'}
                    </Button>
                    <Switch
                      checked={discordDmNotifs}
                      onCheckedChange={(val) => {
                        setDiscordDmNotifs(val);
                        handleUpdateUserSetting({ discordDmNotifs: val });
                        addToast('info', val ? 'Bump reminders on' : 'Bump reminders muted', 'Preference saved.');
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Streak alert</span>
                    <p className="text-[11px] text-zinc-500">
                      Direct message 2 hours before your daily check-in streak resets so you do not lose progress.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sendingTest !== null}
                      onClick={() => handleSendTestNotification('streak')}
                      className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white"
                    >
                      {sendingTest === 'streak' ? 'Sending…' : 'Send test'}
                    </Button>
                    <Switch
                      checked={streakAlerts}
                      onCheckedChange={(val) => {
                        setStreakAlerts(val);
                        handleUpdateUserSetting({ streakAlerts: val });
                        addToast('info', val ? 'Streak alert on' : 'Streak alert muted', 'Preference saved.');
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Partnership proposal</span>
                    <p className="text-[11px] text-zinc-500">
                      Direct message when another community submits a cross-promotion partnership request.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sendingTest !== null}
                      onClick={() => handleSendTestNotification('partnership')}
                      className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white"
                    >
                      {sendingTest === 'partnership' ? 'Sending…' : 'Send test'}
                    </Button>
                    <Switch
                      checked={discordDmWeeklyDigest}
                      onCheckedChange={(val) => {
                        setDiscordDmWeeklyDigest(val);
                        handleUpdateUserSetting({ discordDmWeeklyDigest: val });
                        addToast('info', val ? 'Partnership notices on' : 'Partnership notices muted', 'Preference saved.');
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Review notice</span>
                    <p className="text-[11px] text-zinc-500">
                      Direct message when a community member publishes a review for your server listing.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sendingTest !== null}
                      onClick={() => handleSendTestNotification('review')}
                      className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white"
                    >
                      {sendingTest === 'review' ? 'Sending…' : 'Send test'}
                    </Button>
                    <Switch
                      checked={discordDmSecurityAlerts}
                      onCheckedChange={(val) => {
                        setDiscordDmSecurityAlerts(val);
                        handleUpdateUserSetting({ discordDmSecurityAlerts: val });
                        addToast('info', val ? 'Review notices on' : 'Review notices muted', 'Preference saved.');
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── TAB 4: API & CREDENTIALS ── */}
          <TabsContent value="billing" className="flex flex-col gap-5 animate-in fade-in-50 duration-150">
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-bold text-white">ER:LC API key</h3>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Connect your ER:LC private server API key to automatically synchronize real-time player counts, join keys, and server status.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="erlc-key" className="text-xs font-semibold text-zinc-300">
                  ER:LC API key
                </Label>
                <div className="relative">
                  <Input
                    id="erlc-key"
                    type={showKey ? 'text' : 'password'}
                    value={erlcKey}
                    onChange={(e) => setErlcKey(e.target.value)}
                    placeholder={workspace?.hasErlcKey ? '••••••••••••••••••••••••••••••••' : 'Enter your ER:LC API key...'}
                    className="bg-[#141416] border-white/10 text-white text-xs h-10 pr-10 rounded-xl font-mono focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${workspace?.hasErlcKey ? 'bg-[var(--accent)]' : 'bg-zinc-600'}`} />
                  <span className="text-xs text-zinc-400 font-mono">
                    {workspace?.hasErlcKey ? 'Connected & verified' : 'Awaiting configuration'}
                  </span>
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveErlcKey}
                  disabled={savingKey}
                  className="bg-[#272727] hover:bg-[#323232] text-white border border-white/10 text-xs font-medium rounded-xl h-9 px-4 cursor-pointer"
                >
                  {savingKey ? 'Verifying...' : 'Save ER:LC API key'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── TAB 5: BOT & GATEWAY ── */}
          <TabsContent value="bot" className="flex flex-col gap-5 animate-in fade-in-50 duration-150">
            {/* Server Bot Controls & Role Selectors */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-white">Bot telemetry & staff roles</h3>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Configure administrative staff roles and automated enforcement channels.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Staff role</Label>
                  <Select
                    value={config.promotionStaffRoleId || ''}
                    onValueChange={(val) => onChangeConfig({ promotionStaffRoleId: val })}
                  >
                    <SelectTrigger className="bg-[#141416] border-white/10 text-xs text-white h-9 rounded-lg">
                      <SelectValue placeholder="Select staff role" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141416] border-white/10 text-white text-xs">
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Bot announcement channel</Label>
                  <Select
                    value={config.partnershipBroadcastChannel || ''}
                    onValueChange={(val) => onChangeConfig({ partnershipBroadcastChannel: val })}
                  >
                    <SelectTrigger className="bg-[#141416] border-white/10 text-xs text-white h-9 rounded-lg">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141416] border-white/10 text-white text-xs">
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          #{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={onSaveConfig}
                  className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs h-9 px-4 rounded-xl font-medium cursor-pointer"
                >
                  Save bot settings
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default SettingsTab;
