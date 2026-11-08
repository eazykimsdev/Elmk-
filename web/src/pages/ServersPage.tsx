import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Search,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Users,
  ShieldAlert,
  ArrowUpDown,
  Compass
} from 'lucide-react';
import { fetchGuilds, getBotInviteUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { DiscordGuild } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ServerIcon } from '@/components/ui/ServerIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

export function ServersPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'active'>('members');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pollingGuilds, setPollingGuilds] = useState<Record<string, number>>({});

  useEffect(() => {
    document.title = 'Your servers — ConnectingERLC';
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadServers = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const apiList = await fetchGuilds(forceRefresh);
      let list = Array.isArray(apiList) ? apiList : [];

      if (list.length === 0) {
        try {
          const cachedRaw = localStorage.getItem('erlcus_known_guilds');
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed)) list = parsed;
          }
        } catch {}
      }

      list = list.filter(
        (g) => g && g.id && /^\d{17,20}$/.test(g.id) && g.name
      );

      list = list.map((g) => {
        const cachedIcon = localStorage.getItem(`server_icon_${g.id}`);
        const iconUrl =
          g.iconUrl ||
          cachedIcon ||
          (g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null);
        return {
          ...g,
          iconUrl,
        };
      });

      try {
        localStorage.setItem('erlcus_known_guilds', JSON.stringify(list));
      } catch {}

      setGuilds(list);
    } catch (err: any) {
      setError(err?.message || 'Could not load your Discord servers. Try refreshing the list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadServers(false);
  }, [loadServers]);

  // Handle bot addition & polling
  const handleAddBot = (guildId: string) => {
    const invite = getBotInviteUrl(guildId);
    window.open(invite, '_blank', 'noopener,noreferrer');
    showToast('Waiting for ConnectingERLC bot to join server…');

    setPollingGuilds((prev) => ({ ...prev, [guildId]: Date.now() }));
  };

  // Poll for bot joining up to 60 seconds
  useEffect(() => {
    const activePolls = Object.keys(pollingGuilds);
    if (activePolls.length === 0) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const updated = { ...pollingGuilds };
      let changed = false;

      for (const gid of activePolls) {
        if (now - pollingGuilds[gid] > 60000) {
          delete updated[gid];
          changed = true;
          continue;
        }

        try {
          const res = await fetch(`/api/servers/${gid}/bot-status`);
          if (res.ok) {
            const data = await res.json();
            if (data?.bot_in_guild) {
              setGuilds((prev) =>
                prev.map((g) =>
                  g.id === gid
                    ? {
                        ...g,
                        bot_in_guild: true,
                        botStatus: data.botStatus || 'Online',
                        missingPermissions: data.missingPermissions || [],
                        hasWorkspace: true,
                        configured: true
                      }
                    : g
                )
              );
              showToast('ConnectingERLC bot joined! Ready to manage.');
              delete updated[gid];
              changed = true;
            }
          }
        } catch {}
      }

      if (changed) setPollingGuilds(updated);
    }, 2500);

    return () => clearInterval(interval);
  }, [pollingGuilds]);

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast('Server ID copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Directory publication check
  const isServerListed = (guildId: string) => {
    try {
      const raw = localStorage.getItem('erlcus_promoted_servers');
      if (raw) {
        const list = JSON.parse(raw);
        return list.some((s: any) => String(s.id) === String(guildId));
      }
    } catch {}
    return false;
  };

  const needBotGuildId = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('need_bot');
    } catch {
      return null;
    }
  }, []);

  // Filter & Sort
  const filteredGuilds = useMemo(() => {
    let list = [...guilds];
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((g) => g.name.toLowerCase().includes(q) || g.id.includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'members') {
        const ma = a.memberCount || (a as any).approximateMemberCount || 0;
        const mb = b.memberCount || (b as any).approximateMemberCount || 0;
        return mb - ma;
      }
      return 0;
    });

    return list;
  }, [guilds, query, sortBy]);

  const runningConnectingERLC = useMemo(
    () => filteredGuilds.filter((g) => Boolean(g.bot_in_guild || (g.botStatus && g.botStatus !== 'Not added'))),
    [filteredGuilds]
  );

  const notSetUpYet = useMemo(
    () => filteredGuilds.filter((g) => !g.bot_in_guild && (!g.botStatus || g.botStatus === 'Not added')),
    [filteredGuilds]
  );

  return (
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5] font-sans flex flex-col selection:bg-[var(--accent)]/20 selection:text-[var(--accent)]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="rounded-[10px] bg-[#141417] border border-[var(--border-strong)] px-4 py-2 text-[13px] text-[#F4F4F5] shadow-xl flex items-center gap-2">
            <Check className="size-3.5 text-[var(--accent)]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top 48px Header Bar: Only Breadcrumb 'Your servers' */}
      <header className="h-12 border-b border-[var(--border)] bg-[#09090B]/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6">
        <div className="max-w-[1000px] mx-auto h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[13px]">
            <Link to="/" className="text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors">
              ConnectingERLC
            </Link>
            <span className="text-[#71717A]">/</span>
            <span className="font-medium text-[#F4F4F5]">Your servers</span>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/docs" className="text-[13px] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors hidden sm:inline">
              Docs
            </Link>
            <Button
              variant="secondary"
              size="sm"
              loading={refreshing}
              onClick={() => loadServers(true)}
              className="h-8 text-[12px]"
            >
              <RefreshCw className="size-3" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 sm:px-6 py-8 space-y-7">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-[24px] leading-8 font-semibold text-[#F4F4F5]">
            Your servers
          </h1>
          <p className="text-[14px] leading-5 text-[#A1A1AA]">
            Every server where you have Manage Server or Administrator. Open one to manage it, or add ConnectingERLC to the rest.
          </p>
        </div>

        {needBotGuildId && (
          <div className="rounded-[12px] bg-[#141417] border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-amber-400 shrink-0" />
              <p className="text-[13px] text-zinc-200">
                ConnectingERLC bot must be added to this server before you can manage it.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAddBot(needBotGuildId)}
              className="h-8 px-3 text-[12px] shrink-0"
            >
              Add ConnectingERLC
            </Button>
          </div>
        )}

        {/* Toolbar: Search & Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search servers by name or ID…"
              className="pl-9 h-9 text-[13px] bg-[#0E0E11]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] text-[#A1A1AA] hidden sm:inline">Sort:</span>
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-[160px] h-9 bg-[#0E0E11] border-[var(--border)] text-[13px]">
                <SelectValue placeholder="Sort servers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="members">Most members</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="active">Recently active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="rounded-[12px] border border-[#F87171]/20 bg-[#F87171]/10 p-4 text-[13px] text-[#F87171] flex items-center justify-between">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => loadServers(true)}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            {[0, 1].map((idx) => (
              <div key={idx} className="space-y-3">
                <Skeleton className="h-5 w-36 rounded bg-[#141417]" />
                <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] divide-y divide-[var(--border)]">
                  {[0, 1, 2].map((r) => (
                    <div key={r} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-[8px] bg-[#141417]" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-32 rounded bg-[#141417]" />
                          <Skeleton className="h-3 w-16 rounded bg-[#141417]" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20 rounded bg-[#141417]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredGuilds.length === 0 ? (
          <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11]">
            <EmptyState
              title={query ? 'No servers match your search' : 'No servers found'}
              description={
                query
                  ? 'Try searching with a different server name or clearing the search.'
                  : 'You do not have Manage Server or Administrator permissions on any Discord server.'
              }
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (query) setQuery('');
                    else loadServers(true);
                  }}
                  className="bg-[#18181B] text-zinc-200 border-white/10"
                >
                  {query ? 'Clear search' : 'Refresh servers'}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Section 1: Running ConnectingERLC (n) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#F4F4F5]">
                  Running ConnectingERLC ({runningConnectingERLC.length})
                </h2>
              </div>

              {runningConnectingERLC.length === 0 ? (
                <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-6 text-[13px] text-[#A1A1AA]">
                  None of your servers are running ConnectingERLC yet. Add ConnectingERLC to a server below to get started.
                </div>
              ) : (
                <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_80px_80px_160px] items-center border-b border-[var(--border)] px-5 py-3 text-[12px] font-medium text-[#71717A]">
                    <div>Server</div>
                    <div className="hidden sm:block">Status</div>
                    <div className="hidden sm:block text-right">Members</div>
                    <div className="hidden sm:block text-center">Access</div>
                    <div className="text-right">Action</div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {runningConnectingERLC.map((guild) => {
                      const isOwner = Boolean(guild.owner);
                      const members = guild.memberCount || (guild as any).approximateMemberCount || 0;
                      const listed = isServerListed(guild.id);

                      return (
                        <div
                          key={guild.id}
                          className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_80px_80px_160px] items-center gap-3 px-5 py-3.5 hover:bg-[#141417]/50 transition-colors"
                        >
                          {/* Server info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <ServerIcon
                              guildId={guild.id}
                              iconHash={guild.icon_hash || guild.icon}
                              iconUrl={guild.iconUrl}
                              name={guild.name}
                              size={36}
                              className="size-9 rounded-[8px] object-cover shrink-0"
                            />

                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-medium text-[#F4F4F5] truncate">
                                  {guild.name}
                                </span>
                                {listed && (
                                  <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                    Listed
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[12px] text-[#71717A]">
                                <span className="font-mono">ID: {guild.id.slice(0, 6)}…</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyId(guild.id, e)}
                                  className="text-[#71717A] hover:text-[#F4F4F5] transition-colors"
                                  title="Copy server ID"
                                >
                                  {copiedId === guild.id ? <Check className="size-3 text-[var(--accent)]" /> : <Copy className="size-3" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Status dot */}
                          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-[#A1A1AA]">
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                guild.botStatus === 'Missing permissions'
                                  ? 'bg-amber-400'
                                  : guild.botStatus === 'Offline'
                                  ? 'bg-[#71717A]'
                                  : 'bg-[var(--accent)]'
                              )}
                            />
                            <span title={Array.isArray(guild.missingPermissions) && guild.missingPermissions.length ? `Missing: ${guild.missingPermissions.join(', ')}` : undefined}>
                              {guild.botStatus === 'Missing permissions'
                                ? 'Missing permissions'
                                : guild.botStatus === 'Offline'
                                ? 'Offline'
                                : 'Online'}
                            </span>
                          </div>

                          {/* Member count */}
                          <div className="hidden sm:block text-right text-[13px] text-[#A1A1AA]">
                            {members.toLocaleString()}
                          </div>

                          {/* Access badge */}
                          <div className="hidden sm:flex justify-center">
                            <Badge variant={isOwner ? 'outline' : 'secondary'} className="text-[11px]">
                              {isOwner ? 'Owner' : 'Manager'}
                            </Badge>
                          </div>

                          {/* Manage button */}
                          <div className="text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/dashboard/${guild.id}`)}
                              className="h-8 px-3 text-[12px]"
                            >
                              Manage
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: Not set up yet (n) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#F4F4F5]">
                  Not set up yet ({notSetUpYet.length})
                </h2>
              </div>

              {notSetUpYet.length === 0 ? (
                <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-6 text-[13px] text-[#A1A1AA]">
                  All of your servers are already connected to ConnectingERLC!
                </div>
              ) : (
                <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_80px_80px_160px] items-center border-b border-[var(--border)] px-5 py-3 text-[12px] font-medium text-[#71717A]">
                    <div>Server</div>
                    <div className="hidden sm:block">Status</div>
                    <div className="hidden sm:block text-right">Members</div>
                    <div className="hidden sm:block text-center">Access</div>
                    <div className="text-right">Action</div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {notSetUpYet.map((guild) => {
                      const isOwner = Boolean(guild.owner);
                      const members = guild.memberCount || (guild as any).approximateMemberCount || 0;
                      const isPolling = Boolean(pollingGuilds[guild.id]);

                      return (
                        <div
                          key={guild.id}
                          className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_80px_80px_160px] items-center gap-3 px-5 py-3.5 hover:bg-[#141417]/50 transition-colors"
                        >
                          {/* Server info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <ServerIcon
                              guildId={guild.id}
                              iconHash={guild.icon_hash || guild.icon}
                              iconUrl={guild.iconUrl}
                              name={guild.name}
                              size={36}
                              className="size-9 rounded-[8px] object-cover shrink-0"
                            />

                            <div className="space-y-0.5 min-w-0">
                              <span className="text-[14px] font-medium text-[#F4F4F5] truncate block">
                                {guild.name}
                              </span>
                              <div className="flex items-center gap-2 text-[12px] text-[#71717A]">
                                <span className="font-mono">ID: {guild.id.slice(0, 6)}…</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyId(guild.id, e)}
                                  className="text-[#71717A] hover:text-[#F4F4F5] transition-colors"
                                  title="Copy server ID"
                                >
                                  {copiedId === guild.id ? <Check className="size-3 text-[var(--accent)]" /> : <Copy className="size-3" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-[#71717A]">
                            <span className="size-2 rounded-full bg-[#71717A]" />
                            <span>{isPolling ? 'Waiting for the bot to join' : 'Not added'}</span>
                          </div>

                          {/* Member count */}
                          <div className="hidden sm:block text-right text-[13px] text-[#A1A1AA]">
                            {members > 0 ? members.toLocaleString() : '—'}
                          </div>

                          {/* Access badge */}
                          <div className="hidden sm:flex justify-center">
                            <Badge variant="outline" className="text-[11px]">
                              {isOwner ? 'Owner' : 'Manager'}
                            </Badge>
                          </div>

                          {/* Add ConnectingERLC button */}
                          <div className="text-right">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAddBot(guild.id)}
                              disabled={isPolling}
                              className="h-8 px-3 text-[12px] whitespace-nowrap"
                            >
                              {isPolling ? 'Connecting…' : 'Add ConnectingERLC'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
