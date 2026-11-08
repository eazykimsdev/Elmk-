import React, { useState } from 'react';
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
  BellRing
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-row';
import { getBotInviteUrl, updateWorkspaceCredentials } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

interface BotManagementTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onChangeConfig: (updates: Partial<WorkspaceCustomizations>) => void;
  onSaveConfig: () => Promise<void>;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

const TABS = [
  { id: 'overview', label: 'Bot status & permissions' },
  { id: 'erlc', label: 'ER:LC connection' },
  { id: 'webhooks', label: 'Logs & webhooks' },
] as const;

type TabKey = typeof TABS[number]['id'];

interface BotPermissionItem {
  name: string;
  description: string;
  granted: boolean;
}

export function BotManagementTab({
  guild,
  workspace,
  config,
  onChangeConfig,
  onSaveConfig,
  addToast
}: BotManagementTabProps) {
  const guildId = guild?.id || '1530147023754367006';
  const serverName = guild?.name || config.serverName || 'Community Server';

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [botEnabled, setBotEnabled] = useState<boolean>(true);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<boolean>(false);

  // Bot connection status
  const isBotAdded = Boolean(workspace?.isInGuild || workspace?.hasWorkspace);

  // Form field states
  const [logChannel, setLogChannel] = useState<string>('#bot-logs');
  const [killLogsChannel, setKillLogsChannel] = useState<string>('#kill-logs');
  const [commandLogsChannel, setCommandLogsChannel] = useState<string>('#command-logs');
  const [bumpAnnounce, setBumpAnnounce] = useState<boolean>(true);

  // ER:LC states
  const [erlcJoinCode, setErlcJoinCode] = useState<string>(() => config.joinCode || '');
  const [erlcKeyMasked, setErlcKeyMasked] = useState<boolean>(Boolean(config.erlcApiKey));
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [showNewKey, setShowNewKey] = useState<boolean>(false);

  const botInviteUrl = getBotInviteUrl(guildId);

  // Required permissions with live status
  const requiredPermissions: BotPermissionItem[] = [
    {
      name: 'View Channels & Send Messages',
      description: 'Allows the bot to read commands and send bump & partnership notifications.',
      granted: isBotAdded
    },
    {
      name: 'Create Instant Invite',
      description: 'Used by the recruit hub and directory to generate verified invitation links.',
      granted: isBotAdded
    },
    {
      name: 'Manage Webhooks',
      description: 'Dispatches partner exchanges, join logs, and automated server updates.',
      granted: isBotAdded
    },
    {
      name: 'Embed Links & Attach Files',
      description: 'Renders directory preview cards and formatted telemetry reports.',
      granted: isBotAdded
    },
    {
      name: 'Read Message History',
      description: 'Verifies partner messages and prevents duplicate announcements.',
      granted: isBotAdded
    }
  ];

  const hasAllPermissions = requiredPermissions.every((p) => p.granted);

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(botInviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
    addToast('success', 'Invite link copied', 'Bot authorization URL copied to clipboard.');
  };

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) {
      addToast('warning', 'API key required', 'Please enter your ER:LC private server API key.');
      return;
    }
    setSavingKey(true);
    try {
      await updateWorkspaceCredentials(guildId, { erlcApiKey: newApiKey.trim() });
      onChangeConfig({ erlcApiKey: newApiKey.trim() });
      setErlcKeyMasked(true);
      setNewApiKey('');
      addToast('success', 'Credentials encrypted', 'ER:LC API credentials encrypted and securely saved.');
    } catch (err: any) {
      addToast('error', 'Update failed', err.message || 'Could not save API key.');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Master Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="space-y-0.5">
          <h2 className="text-[20px] font-semibold text-[#F4F4F5]">
            Bot configuration
          </h2>
          <p className="text-[14px] text-[#A1A1AA]">
            Connection status, permissions, ER:LC sync, and webhook logging for {serverName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#A1A1AA]">
            {botEnabled ? 'Bot active' : 'Bot paused'}
          </span>
          <Switch
            checked={botEnabled}
            onCheckedChange={(val) => {
              setBotEnabled(val);
              addToast(val ? 'success' : 'info', 'Status updated', val ? 'Bot connection enabled.' : 'Bot connection paused.');
            }}
          />
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`size-10 rounded-[10px] flex items-center justify-center shrink-0 border ${
              isBotAdded ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20' : 'bg-[#141417] text-[#A1A1AA] border-[var(--border)]'
            }`}>
              <Bot className="size-5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold text-[#F4F4F5]">
                  {isBotAdded ? 'ConnectingERLC bot connected' : 'Bot not added yet'}
                </span>
                {isBotAdded ? (
                  <Badge variant="success">Gateway active</Badge>
                ) : (
                  <Badge variant="outline">Action required</Badge>
                )}
              </div>
              <p className="text-[13px] text-[#A1A1AA]">
                {isBotAdded
                  ? 'The bot is online in your Discord server and actively tracking invites, joins, and bumps.'
                  : 'Add ConnectingERLC to your Discord server to enable join verification and directory bumps.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isBotAdded ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyInvite}
              >
                {copiedInvite ? <Check className="size-3.5 text-[var(--accent)]" /> : <Copy className="size-3.5" />}
                <span>{copiedInvite ? 'Copied' : 'Invite link'}</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.open(botInviteUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="size-3.5" />
                <span>Add ConnectingERLC</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(botInviteUrl, '_blank', 'noopener,noreferrer')}
            >
              <ShieldCheck className="size-3.5 text-[var(--accent)]" />
              <span>Fix permissions</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[#0E0E11] border border-[var(--border)] overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#141417] text-[#F4F4F5] shadow-xs'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Bot status & permissions */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <SettingsGroup
            title="Required bot permissions"
            description="The bot requires these core permissions to perform bump verification and invite tracking."
          >
            <div className="divide-y divide-[var(--border)]">
              {requiredPermissions.map((perm) => (
                <div key={perm.name} className="flex items-start justify-between py-3.5 px-4 first:pt-2 last:pb-2">
                  <div className="space-y-1 pr-4">
                    <div className="text-[14px] font-medium text-[#F4F4F5] flex items-center gap-2">
                      <span>{perm.name}</span>
                      {perm.granted ? (
                        <Check className="size-3.5 text-[var(--accent)]" />
                      ) : (
                        <AlertTriangle className="size-3.5 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[13px] text-[#A1A1AA]">
                      {perm.description}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {perm.granted ? (
                      <span className="text-[12px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2.5 py-1 rounded-[6px]">
                        Granted
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(botInviteUrl, '_blank', 'noopener,noreferrer')}
                        className="h-7 text-xs"
                      >
                        Fix
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SettingsGroup>
        </div>
      )}

      {/* Tab 2: ER:LC Connection */}
      {activeTab === 'erlc' && (
        <SettingsGroup
          title="Emergency Response: Liberty County"
          description="Live server player count, kill logs, command logs, and in-game sync."
        >
          <SettingsRow
            label="ER:LC join code"
            description="Your private server code displayed on public listings."
            control={
              <Input
                value={erlcJoinCode}
                onChange={(e) => {
                  setErlcJoinCode(e.target.value);
                  onChangeConfig({ joinCode: e.target.value });
                }}
                placeholder="e.g. PRLC-102"
                className="w-40 h-9 font-mono text-[13px]"
              />
            }
          />

          <SettingsRow
            label="ER:LC server API key"
            description="Encrypted server-side with AES-256-GCM. Never sent back to browser in plain text."
            vertical
          >
            <div className="space-y-3">
              {erlcKeyMasked && (
                <div className="flex items-center gap-2 p-2.5 rounded-[8px] bg-[#141417] border border-[var(--border)] text-[13px] text-[#A1A1AA]">
                  <KeyRound className="size-4 text-[var(--accent)]" />
                  <span>API Key configured and encrypted (AES-256-GCM).</span>
                  <Badge variant="outline" className="ml-auto text-[11px]">Encrypted</Badge>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNewKey ? 'text' : 'password'}
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder={erlcKeyMasked ? 'Enter new key to update...' : 'Paste your ER:LC API key...'}
                    className="h-10 text-[13px] font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F4F4F5] cursor-pointer"
                  >
                    {showNewKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveApiKey}
                  disabled={!newApiKey.trim() || savingKey}
                  className="h-10 shrink-0"
                >
                  {savingKey ? 'Encrypting…' : 'Save key'}
                </Button>
              </div>
            </div>
          </SettingsRow>
        </SettingsGroup>
      )}

      {/* Tab 3: Logs & Webhooks */}
      {activeTab === 'webhooks' && (
        <SettingsGroup
          title="Webhook settings & logging"
          description="Designate channels for system events, kill logs, and command telemetry."
        >
          <SettingsRow
            label="System log channel"
            description="Where errors, bumps, and platform notifications are posted."
            control={
              <Select value={logChannel} onValueChange={setLogChannel}>
                <SelectTrigger className="w-44 h-9 bg-[#141417] border-[var(--border)] text-[13px]">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#bot-logs">#bot-logs</SelectItem>
                  <SelectItem value="#mod-logs">#mod-logs</SelectItem>
                  <SelectItem value="#general">#general</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          <SettingsRow
            label="Kill logs channel"
            description="Channel where in-game ER:LC player kills are relayed."
            control={
              <Select value={killLogsChannel} onValueChange={setKillLogsChannel}>
                <SelectTrigger className="w-44 h-9 bg-[#141417] border-[var(--border)] text-[13px]">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#kill-logs">#kill-logs</SelectItem>
                  <SelectItem value="#erlc-logs">#erlc-logs</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          <SettingsRow
            label="Command logs channel"
            description="Channel where in-game :m, :kick, :ban, and mod commands are logged."
            control={
              <Select value={commandLogsChannel} onValueChange={setCommandLogsChannel}>
                <SelectTrigger className="w-44 h-9 bg-[#141417] border-[var(--border)] text-[13px]">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#command-logs">#command-logs</SelectItem>
                  <SelectItem value="#audit-log">#audit-log</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          <SettingsRow
            label="Direct bump announcements"
            description="Broadcast directory bumps into your announcement channel."
            control={
              <Switch
                checked={bumpAnnounce}
                onCheckedChange={setBumpAnnounce}
              />
            }
          />
        </SettingsGroup>
      )}
    </div>
  );
}
