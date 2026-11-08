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
  Volume2
} from 'lucide-react';

import { useTheme } from '@/components/library/theme-provider';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { updateWorkspaceCredentials, sendTestNotification } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

interface SettingsTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onChangeConfig: (updates: Partial<WorkspaceCustomizations>) => void;
  onSaveConfig: () => Promise<void>;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

// Danger Zone Component (Section 9.2: Hard delete server)
function DangerZone({
  serverName,
  guildId,
  isOwner,
  addToast,
}: {
  serverName: string;
  guildId: string;
  isOwner: boolean;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOwner) return null;

  const handleDelete = async () => {
    if (confirmName.trim() !== serverName.trim()) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/servers/${guildId}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        addToast('success', 'Server deleted', `${serverName} was permanently deleted.`);
        setShowDialog(false);
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
        const data = await res.json().catch(() => ({}));
        addToast('error', 'Deletion failed', data.error || 'Could not delete server.');
      }
    } catch {
      addToast('error', 'Network error', 'Failed to connect to server.');
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteItems = [
    'Listing and banner files',
    'Reviews',
    'Team',
    'API keys and webhooks',
    'ER:LC key',
    'Representatives',
    'Recruits',
    'Tracked invites',
    'Partnerships',
    'Notifications',
    'Settings',
    'Analytics',
  ];

  return (
    <>
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.02] p-6 space-y-4 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-sans tracking-tight">
                Delete server from ConnectingERLC
              </h3>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                This permanently removes the listing, settings and all data for this server. This cannot be undone.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => {
              setConfirmName('');
              setShowDialog(true);
            }}
            className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold h-9 px-4 rounded-xl cursor-pointer shrink-0"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            <span>Delete server</span>
          </Button>
        </div>
      </div>

      {showDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0E0E11] text-zinc-100 shadow-2xl p-6 space-y-5 font-sans"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
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
                onClick={() => setShowDialog(false)}
                className="size-7 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center hover:bg-white/[0.05] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Checklist of 12 items */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-300 block">
                The following data will be permanently wiped:
              </span>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#141417] border border-white/[0.06] text-xs text-zinc-300">
                {deleteItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Callout */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Active partnerships will end and your partner servers will be notified. Pending join and recruit rewards will be cancelled.
              </p>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2 pt-1">
              <label className="text-xs text-zinc-300 block">
                To confirm deletion, please type <strong className="text-white font-semibold select-all font-mono">"{serverName}"</strong> below:
              </label>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={`Type "${serverName}" to confirm...`}
                className="bg-[#141416] border-white/10 text-xs text-white rounded-xl h-10 font-sans focus:border-rose-500/50"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="bg-[#19191D] hover:bg-[#222227] text-zinc-300 border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={confirmName.trim() !== serverName.trim() || isDeleting}
                onClick={handleDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold h-9 px-4 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting server...' : 'Delete server'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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

  // Real Discord channels & roles loaded from server
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; color?: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadGuildData() {
      try {
        const [chRes, rRes] = await Promise.all([
          fetch(`/api/workspace/${guildId}/channels`).catch(() => null),
          fetch(`/api/workspace/${guildId}/roles`).catch(() => null),
        ]);

        if (chRes && chRes.ok) {
          const chData = await chRes.json();
          if (mounted && Array.isArray(chData.channels) && chData.channels.length > 0) {
            setChannels(chData.channels);
          }
        }

        if (rRes && rRes.ok) {
          const rData = await rRes.json();
          if (mounted && Array.isArray(rData.roles) && rData.roles.length > 0) {
            setRoles(rData.roles);
          }
        }
      } catch (err) {
        console.warn('[SETTINGS] Could not load live guild telemetry:', err);
      }
    }

    loadGuildData();
    return () => {
      mounted = false;
    };
  }, [guildId]);

  // Testing notification state
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  const handleSendTest = async (type: 'anti_raid' | 'bump' | 'streak' | 'digest') => {
    setSendingTest(type);
    try {
      await sendTestNotification(guildId, type);
      addToast(
        'success',
        'Test dispatched to Discord',
        `Live notification embed sent to your Discord DM (${user?.username || 'user'}).`
      );
    } catch (err: any) {
      addToast('error', 'Delivery notice', err.message || 'Could not send test notification.');
    } finally {
      setSendingTest(null);
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
          <div className="no-scrollbar mb-6 min-w-0 overflow-x-auto overflow-y-hidden border-b border-white/[0.06] pb-3">
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

            {/* DANGER ZONE (Visible ONLY on General and Appearance tabs, Owner only) */}
            <DangerZone
              serverName={serverName}
              guildId={guildId}
              isOwner={isOwner}
              addToast={addToast}
            />
          </TabsContent>



          {/* ── TAB 3: NOTIFICATIONS (Zero email mentions, pure in-app & Discord DM) ── */}
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
                  Deliver notifications and telemetry directly to your Discord account via the ConnectingERLC bot.
                </p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Discord DM delivery</span>
                    <p className="text-[11px] text-zinc-500">
                      Enable the ConnectingERLC bot to send direct messages to your Discord account.
                    </p>
                  </div>
                  <Switch
                    checked={discordDmNotifs}
                    onCheckedChange={(val) => {
                      setDiscordDmNotifs(val);
                      handleUpdateUserSetting({ discordDmNotifs: val });
                      addToast('info', val ? 'Discord DM delivery on' : 'Discord DM delivery muted', 'Preference saved.');
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Weekly summary DM</span>
                    <p className="text-[11px] text-zinc-500">
                      Receive a Sunday digest with weekly joins, credits earned, and alliance telemetry via Discord DM.
                    </p>
                  </div>
                  <Switch
                    checked={discordDmWeeklyDigest}
                    onCheckedChange={(val) => {
                      setDiscordDmWeeklyDigest(val);
                      handleUpdateUserSetting({ discordDmWeeklyDigest: val });
                      addToast('info', val ? 'Weekly summary DM on' : 'Weekly summary DM muted', 'Preference saved.');
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white">Security advisories DM</span>
                    <p className="text-[11px] text-zinc-500">
                      Receive high-priority alerts for permission changes, gateway status, and security notices via Discord DM.
                    </p>
                  </div>
                  <Switch
                    checked={discordDmSecurityAlerts}
                    onCheckedChange={(val) => {
                      setDiscordDmSecurityAlerts(val);
                      handleUpdateUserSetting({ discordDmSecurityAlerts: val });
                      addToast('info', val ? 'Security advisories DM on' : 'Security advisories DM muted', 'Preference saved.');
                    }}
                  />
                </div>
              </div>
            </div>

            {/* TEST NOTIFICATIONS DISPATCH */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-white">Test dispatch</h3>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Send a sample notification embed to your Discord account to verify delivery.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingTest === 'anti_raid'}
                  onClick={() => handleSendTest('anti_raid')}
                  className="bg-[#141417] hover:bg-[#1a1a1f] text-zinc-200 border-white/10 text-xs h-9 rounded-xl cursor-pointer"
                >
                  <ShieldAlert className="size-3.5 mr-1.5 text-zinc-400" />
                  <span>{sendingTest === 'anti_raid' ? 'Sending...' : 'Test raid alert'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingTest === 'bump'}
                  onClick={() => handleSendTest('bump')}
                  className="bg-[#141417] hover:bg-[#1a1a1f] text-zinc-200 border-white/10 text-xs h-9 rounded-xl cursor-pointer"
                >
                  <Radio className="size-3.5 mr-1.5 text-zinc-400" />
                  <span>{sendingTest === 'bump' ? 'Sending...' : 'Test bump notice'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingTest === 'streak'}
                  onClick={() => handleSendTest('streak')}
                  className="bg-[#141417] hover:bg-[#1a1a1f] text-zinc-200 border-white/10 text-xs h-9 rounded-xl cursor-pointer"
                >
                  <ShieldCheck className="size-3.5 mr-1.5 text-zinc-400" />
                  <span>{sendingTest === 'streak' ? 'Sending...' : 'Test streak alert'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingTest === 'digest'}
                  onClick={() => handleSendTest('digest')}
                  className="bg-[#141417] hover:bg-[#1a1a1f] text-zinc-200 border-white/10 text-xs h-9 rounded-xl cursor-pointer"
                >
                  <Send className="size-3.5 mr-1.5 text-zinc-400" />
                  <span>{sendingTest === 'digest' ? 'Sending...' : 'Test digest'}</span>
                </Button>
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
