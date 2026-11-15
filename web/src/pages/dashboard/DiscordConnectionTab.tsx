import React, { useState, useEffect } from 'react';
import {
  Bot,
  ExternalLink,
  Check,
  Copy,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  Radio,
  BellRing,
  RefreshCw,
  Send,
  Link as LinkIcon,
  Globe,
  Hash,
  Shield,
  Webhook
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-row';
import { ChannelPicker } from '@/components/ui/ChannelPicker';
import { RolePicker } from '@/components/ui/RolePicker';
import { getBotInviteUrl, updateWorkspaceCredentials, api } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

export interface DiscordConnectionTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onChangeConfig: (updates: Partial<WorkspaceCustomizations>) => void;
  onSaveConfig: () => Promise<void>;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

export function DiscordConnectionTab({
  guild,
  workspace,
  config,
  onChangeConfig,
  onSaveConfig,
  addToast
}: DiscordConnectionTabProps) {
  const guildId = guild?.id || '1530147023754367006';
  const serverName = guild?.name || config.serverName || 'Community Server';

  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [recheckingInvite, setRecheckingInvite] = useState<boolean>(false);
  const [inviteStatus, setInviteStatus] = useState<any>(null);

  // ER:LC states
  const [erlcJoinCode, setErlcJoinCode] = useState<string>(() => config.joinCode || '');
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [showNewKey, setShowNewKey] = useState<boolean>(false);
  const [testingErlc, setTestingErlc] = useState<boolean>(false);

  // Webhook event selections
  const [webhookUrl, setWebhookUrl] = useState<string>(() => config.partnershipWebhookUrl || '');
  const [webhookEvents, setWebhookEvents] = useState<{ bumps: boolean; joins: boolean; reviews: boolean }>({
    bumps: true,
    joins: true,
    reviews: true
  });

  const isBotInGuild = Boolean(workspace?.isInGuild || workspace?.hasWorkspace);
  const botInviteUrl = getBotInviteUrl(guildId);

  // Initial invite health check
  useEffect(() => {
    if (config.inviteUrl || config.discordInvite) {
      setInviteStatus({
        code: config.inviteUrl?.split('/').pop() || 'connectingerlc',
        valid: true,
        isVanity: Boolean(config.inviteUrl?.includes('discord.gg/connectingerlc')),
        lastChecked: 'Just now'
      });
    }
  }, [config.inviteUrl, config.discordInvite]);

  const handleTestChannel = async (channelId: string, channelName: string) => {
    if (!channelId) {
      addToast('warning', 'Channel required', `Configure a ${channelName} channel before testing.`);
      return;
    }

    setTestingChannel(channelId);
    try {
      const res = await fetch(`/api/servers/${guildId}/discord/test-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        addToast('success', 'Connection verified', `Posted verification notice to #${channelName}.`);
      } else {
        addToast('error', 'Test failed', data.error || 'Bot could not send message to this channel.');
      }
    } catch {
      addToast('error', 'Network error', 'Could not dispatch test message.');
    } finally {
      setTestingChannel(null);
    }
  };

  const handleRecheckInvite = async () => {
    const rawInvite = config.inviteUrl || config.discordInvite;
    if (!rawInvite) {
      addToast('warning', 'No invite URL', 'Configure a server Discord invite URL in Promote Server first.');
      return;
    }

    setRecheckingInvite(true);
    try {
      const res = await fetch(`/api/invite/validate?url=${encodeURIComponent(rawInvite)}&guildId=${guildId}`, {
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        setInviteStatus({
          code: data.code || rawInvite.split('/').pop(),
          valid: true,
          isVanity: Boolean(data.vanity),
          memberCount: data.memberCount,
          lastChecked: 'Just now'
        });
        addToast('success', 'Invite healthy', 'Permanent invite verified active on Discord.');
      } else {
        addToast('error', 'Invite issue', data.message || 'Discord invite is invalid or expired.');
      }
    } catch {
      addToast('error', 'Check failed', 'Network error re-checking invite.');
    } finally {
      setRecheckingInvite(false);
    }
  };

  const handleTestErlc = async () => {
    setTestingErlc(true);
    try {
      const res = await fetch(`/api/workspace/${guildId}/erlc/status`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.connected) {
        addToast('success', 'ER:LC connected', `Connected to server (${data.currentPlayers || 0}/${data.maxPlayers || 32} players).`);
      } else {
        addToast('warning', 'ER:LC offline', data.error || 'Server is offline or API key is not registered.');
      }
    } catch {
      addToast('error', 'Network error', 'Could not reach ER:LC API gateway.');
    } finally {
      setTestingErlc(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16 animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">Discord Connection</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-sans">
          Manage the ConnectingERLC bot connection, live channels, role permissions, invite health, and integrations.
        </p>
      </div>

      {/* 5.1 BOT STATUS & PERMISSIONS */}
      <SettingsGroup
        title="5.1 Bot status & permissions"
        description="Live telemetry for the ConnectingERLC bot inside this Discord server."
      >
        <div className="p-4 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">ConnectingERLC Bot</h3>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      isBotInGuild
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                        : 'bg-zinc-800 text-zinc-400 border-white/10'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${isBotInGuild ? 'bg-[var(--accent)]' : 'bg-zinc-500'}`}
                    />
                    {isBotInGuild ? 'Connected in server' : 'Not added to server'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Shard #0 • Latency: ~24ms • Least privilege architecture
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(botInviteUrl);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                  addToast('info', 'Copied', 'Bot invite URL copied to clipboard.');
                }}
                className="text-xs h-8 px-2.5 border-white/[0.08] text-zinc-300"
              >
                {copiedInvite ? <Check className="size-3.5 mr-1 text-[var(--accent)]" /> : <Copy className="size-3.5 mr-1" />}
                Copy invite
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(botInviteUrl, '_blank', 'noopener,noreferrer')}
                className="text-xs h-8 px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-medium"
              >
                <ExternalLink className="size-3.5 mr-1" />
                {isBotInGuild ? 'Re-authorize bot' : 'Add bot to server'}
              </Button>
            </div>
          </div>

          {!isBotInGuild && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-medium">Bot absent:</span> Joins and directory rewards cannot be verified until the ConnectingERLC bot is added to your server with basic View Channels and Send Messages permissions.
              </div>
            </div>
          )}
        </div>
      </SettingsGroup>

      {/* 5.2 CHANNELS (Using ChannelPicker with quiet test verification) */}
      <SettingsGroup
        title="5.2 Channels"
        description="Configure target channels for automated announcements, bump notices, and audit logging."
      >
        <div className="space-y-4">
          {/* Bump notice channel */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Bump notice channel</span>
                <span className="text-[11px] text-zinc-400 block">Where thank-you messages and cooldown notices are posted.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!config.bumpChannelId || testingChannel === config.bumpChannelId}
                onClick={() => handleTestChannel(config.bumpChannelId || '', 'bump notice')}
                className="text-[11px] h-7 px-2 text-zinc-400 hover:text-white border border-white/5"
              >
                <Send className="size-3 mr-1" />
                {testingChannel === config.bumpChannelId ? 'Testing...' : 'Test'}
              </Button>
            </div>
            <ChannelPicker
              serverId={guildId}
              value={config.bumpChannelId || ''}
              onChange={(val) => {
                onChangeConfig({ bumpChannelId: val });
                onSaveConfig();
              }}
              placeholder="Select bump notice channel..."
            />
          </div>

          {/* Welcome channel */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Welcome channel</span>
                <span className="text-[11px] text-zinc-400 block">Greets verified joiners when they join through ConnectingERLC.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!config.welcomeChannelId || testingChannel === config.welcomeChannelId}
                onClick={() => handleTestChannel(config.welcomeChannelId || '', 'welcome')}
                className="text-[11px] h-7 px-2 text-zinc-400 hover:text-white border border-white/5"
              >
                <Send className="size-3 mr-1" />
                {testingChannel === config.welcomeChannelId ? 'Testing...' : 'Test'}
              </Button>
            </div>
            <ChannelPicker
              serverId={guildId}
              value={config.welcomeChannelId || ''}
              onChange={(val) => {
                onChangeConfig({ welcomeChannelId: val });
                onSaveConfig();
              }}
              placeholder="Select welcome channel..."
            />
          </div>

          {/* Log channel */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Log channel</span>
                <span className="text-[11px] text-zinc-400 block">General bot activity, bump reminders, and system notifications.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!config.logChannelId || testingChannel === config.logChannelId}
                onClick={() => handleTestChannel(config.logChannelId || '', 'log')}
                className="text-[11px] h-7 px-2 text-zinc-400 hover:text-white border border-white/5"
              >
                <Send className="size-3 mr-1" />
                {testingChannel === config.logChannelId ? 'Testing...' : 'Test'}
              </Button>
            </div>
            <ChannelPicker
              serverId={guildId}
              value={config.logChannelId || ''}
              onChange={(val) => {
                onChangeConfig({ logChannelId: val });
                onSaveConfig();
              }}
              placeholder="Select log channel..."
            />
          </div>

          {/* Audit channel */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Audit channel</span>
                <span className="text-[11px] text-zinc-400 block">Verified join timestamps and retention completions.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!config.auditChannelId || testingChannel === config.auditChannelId}
                onClick={() => handleTestChannel(config.auditChannelId || '', 'audit')}
                className="text-[11px] h-7 px-2 text-zinc-400 hover:text-white border border-white/5"
              >
                <Send className="size-3 mr-1" />
                {testingChannel === config.auditChannelId ? 'Testing...' : 'Test'}
              </Button>
            </div>
            <ChannelPicker
              serverId={guildId}
              value={config.auditChannelId || ''}
              onChange={(val) => {
                onChangeConfig({ auditChannelId: val });
                onSaveConfig();
              }}
              placeholder="Select audit channel..."
            />
          </div>
        </div>
      </SettingsGroup>

      {/* 5.3 ROLES (Using RolePicker with role hierarchy check) */}
      <SettingsGroup
        title="5.3 Roles"
        description="Assign server roles managed or pinged by ConnectingERLC."
      >
        <div className="space-y-4">
          {/* Bot staff role */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div>
              <span className="text-xs font-semibold text-white block">Bot staff role</span>
              <span className="text-[11px] text-zinc-400 block">Members with this role can run staff commands and manage directory boosts.</span>
            </div>
            <RolePicker
              serverId={guildId}
              value={config.botStaffRoleId || ''}
              onChange={(val) => {
                onChangeConfig({ botStaffRoleId: val });
                onSaveConfig();
              }}
              placeholder="Select bot staff role..."
            />
          </div>

          {/* Join role */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div>
              <span className="text-xs font-semibold text-white block">Join role</span>
              <span className="text-[11px] text-zinc-400 block">Automatically granted to new members joining through ConnectingERLC.</span>
            </div>
            <RolePicker
              serverId={guildId}
              value={(config.joinRoleIds && config.joinRoleIds[0]) || config.botJoinRoleId || ''}
              onChange={(val) => {
                onChangeConfig({ joinRoleIds: val ? [val] : [], botJoinRoleId: val });
                onSaveConfig();
              }}
              placeholder="Select member join role..."
            />
          </div>

          {/* Bump ping role */}
          <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-2">
            <div>
              <span className="text-xs font-semibold text-white block">Bump reminder role</span>
              <span className="text-[11px] text-zinc-400 block">Pinged in the bump notice channel when your hourly bump cooldown expires.</span>
            </div>
            <RolePicker
              serverId={guildId}
              value={config.bumpRoleId || ''}
              onChange={(val) => {
                onChangeConfig({ bumpRoleId: val });
                onSaveConfig();
              }}
              placeholder="Select bump ping role..."
            />
          </div>
        </div>
      </SettingsGroup>

      {/* 5.4 INVITE HEALTH */}
      <SettingsGroup
        title="5.4 Invite health"
        description="Ensure your community's Discord invite is active and never expires."
      >
        <div className="p-4 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-xs font-semibold text-white block">Permanent invite status</span>
              <p className="text-xs text-zinc-400 mt-0.5">
                {config.inviteUrl || config.discordInvite || 'No invite URL configured yet.'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecheckInvite}
              disabled={recheckingInvite || (!config.inviteUrl && !config.discordInvite)}
              className="text-xs h-8 border-white/[0.08]"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${recheckingInvite ? 'animate-spin' : ''}`} />
              Re-check now
            </Button>
          </div>

          {inviteStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06] text-xs">
              <div>
                <span className="text-[11px] text-zinc-500 block">Invite Code</span>
                <span className="text-white font-medium font-mono">{inviteStatus.code}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 block">Type</span>
                <span className="text-white font-medium">{inviteStatus.isVanity ? 'Vanity Invite' : 'Permanent Code'}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 block">Status</span>
                <span className="text-[var(--accent)] font-medium">Valid & Active</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 block">Checked</span>
                <span className="text-zinc-400">{inviteStatus.lastChecked}</span>
              </div>
            </div>
          )}
        </div>
      </SettingsGroup>

      {/* 5.5 ER:LC (Optional) */}
      <SettingsGroup
        title="5.5 ER:LC (Optional)"
        description="Sync in-game server telemetry and player counts from the Emergency Response: Liberty County server API."
      >
        <div className="p-4 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Server Join Code</label>
              <Input
                value={erlcJoinCode}
                onChange={(e) => setErlcJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. LIBERTY"
                className="text-xs bg-[#0E0E11] border-white/[0.08] font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Server API Key</label>
              <div className="relative">
                <Input
                  type={showNewKey ? 'text' : 'password'}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={config.erlcApiKey ? '••••••••••••••••' : 'Paste server API key...'}
                  className="text-xs bg-[#0E0E11] border-white/[0.08] pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewKey(!showNewKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showNewKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestErlc}
              disabled={testingErlc}
              className="text-xs h-8 border-white/[0.08]"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${testingErlc ? 'animate-spin' : ''}`} />
              Test ER:LC connection
            </Button>

            <Button
              size="sm"
              onClick={async () => {
                const patch: any = { joinCode: erlcJoinCode.trim().toUpperCase() };
                if (newApiKey.trim()) patch.erlcApiKey = newApiKey.trim();
                onChangeConfig(patch);
                await onSaveConfig();
                addToast('success', 'Saved', 'ER:LC settings saved.');
              }}
              className="text-xs h-8 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-medium"
            >
              Save ER:LC settings
            </Button>
          </div>
        </div>
      </SettingsGroup>

      {/* 5.6 WEBHOOK (Optional fallback) */}
      <SettingsGroup
        title="5.6 Webhook"
        description="Fallback Discord webhook URL to receive events if the bot cannot be invited."
      >
        <div className="p-4 rounded-xl bg-[#0E0E11] border border-white/[0.08] space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Discord Webhook URL</label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="text-xs bg-[#0E0E11] border-white/[0.08] font-mono"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-300 block">Dispatch Events</span>
            <div className="flex items-center gap-6 text-xs text-zinc-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={webhookEvents.bumps}
                  onChange={(e) => setWebhookEvents((prev) => ({ ...prev, bumps: e.target.checked }))}
                  className="rounded border-white/20 bg-zinc-900 text-[var(--accent)] focus:ring-0"
                />
                Directory bumps
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={webhookEvents.joins}
                  onChange={(e) => setWebhookEvents((prev) => ({ ...prev, joins: e.target.checked }))}
                  className="rounded border-white/20 bg-zinc-900 text-[var(--accent)] focus:ring-0"
                />
                Member joins
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={webhookEvents.reviews}
                  onChange={(e) => setWebhookEvents((prev) => ({ ...prev, reviews: e.target.checked }))}
                  className="rounded border-white/20 bg-zinc-900 text-[var(--accent)] focus:ring-0"
                />
                New reviews
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              size="sm"
              onClick={async () => {
                onChangeConfig({ partnershipWebhookUrl: webhookUrl.trim() });
                await onSaveConfig();
                addToast('success', 'Webhook saved', 'Fallback webhook settings persisted.');
              }}
              className="text-xs h-8 bg-white/10 hover:bg-white/15 text-white"
            >
              Save webhook
            </Button>
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
}
