import type { DiscordGuild, DiscordUser, WorkspaceBot, LiveErlcServer, WorkspaceCustomizations } from '../types';

let csrfToken = '';

export function getDiscordLoginUrl(): string {
  // The backend builds the Discord authorize URL so the OAuth state and server-membership check apply.
  return '/api/auth/discord/start?returnTo=%2Fdashboard';
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export async function api<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const normalizedPath = path.startsWith('/api') ? path : `/api${path}`;
  const response = await fetch(normalizedPath, {
    ...init,
    method,
    headers,
    credentials: 'include'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // If 401 or 403 (unauthorized or CSRF expired), refresh session once and retry automatically (Section 1.4)
    if ((response.status === 401 || response.status === 403) && !isRetry && path !== '/auth/me') {
      try {
        const authRes = await fetch('/api/auth/me', { credentials: 'include' });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData?.user) {
            if (authData?.csrfToken) setCsrfToken(authData.csrfToken);
            return api<T>(path, init, true);
          }
        }
      } catch {}

      // Notify auth context to synchronize real state
      window.dispatchEvent(new CustomEvent('connectingerlc_auth_unauthorized'));

      // If write request and session is genuinely lost, save draft to preserve changes and redirect to sign in
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && init.body) {
        try {
          sessionStorage.setItem('pending_save_draft', JSON.stringify({
            path,
            body: init.body,
            returnTo: window.location.pathname + window.location.search,
            timestamp: Date.now()
          }));
          window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        } catch {}
      }
    }
    const error: any = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload as T;
}

export async function fetchAuthMe(): Promise<{ user: DiscordUser | null; csrfToken: string; guilds: DiscordGuild[] }> {
  const data = await api<{ user: DiscordUser | null; csrfToken: string; guilds: DiscordGuild[] }>('/auth/me');
  if (data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }
  return data;
}

export async function fetchGuilds(refresh = false): Promise<DiscordGuild[]> {
  try {
    const data = await api<{ servers: DiscordGuild[] }>(`/servers${refresh ? '?refresh=1' : ''}`);
    if (data.servers && Array.isArray(data.servers)) return data.servers;
  } catch {
    // No servers or network offline
  }
  return [];
}

export async function fetchChannels(guildId: string): Promise<{ id: string; name: string; type?: number }[]> {
  try {
    const data = await api<{ channels: { id: string; name: string; type?: number }[] }>(`/workspace/${guildId}/channels`);
    if (data?.channels && Array.isArray(data.channels) && data.channels.length > 0) {
      try {
        localStorage.setItem(`erlcus_channels_${guildId}`, JSON.stringify(data.channels));
      } catch {}
      return data.channels;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(`erlcus_channels_${guildId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  return [];
}

export async function fetchWorkspace(guildId: string): Promise<{ workspace: WorkspaceBot; guild: DiscordGuild }> {
  try {
    return await api<{ workspace: WorkspaceBot; guild: DiscordGuild }>(`/workspace/${guildId}`);
  } catch (err: any) {
    if (err?.status === 403 || err?.message?.includes('BOT_NOT_IN_GUILD') || err?.error === 'BOT_NOT_IN_GUILD') {
      throw err;
    }
    const cachedName = localStorage.getItem(`server_name_${guildId}`) || 'Community Server';
    const cachedIcon = localStorage.getItem(`server_icon_${guildId}`);
    return {
      workspace: {
        id: `ws-${guildId}`,
        guildId,
        isMainBot: false,
        discordBotId: '',
        botUser: {
          id: '',
          username: 'ConnectingERLC Bot',
          avatarUrl: ''
        },
        isInGuild: true,
        inviteUrl: getBotInviteUrl(guildId),
        status: 'online',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasErlcApiKey: false,
        customizations: {
          serverName: cachedName,
          joinCode: '',
          j4jEnabled: true,
          j4jDailyTarget: 50,
          joinCredits: 28,
          sessionState: 'PATROL_LIVE'
        }
      },
      guild: {
        id: guildId,
        name: cachedName,
        icon: null,
        iconUrl: cachedIcon,
        owner: true
      }
    };
  }
}

export async function createWorkspace(guildId: string): Promise<{ workspace: WorkspaceBot; created: boolean; guild?: DiscordGuild }> {
  try {
    return await api<{ workspace: WorkspaceBot; created: boolean; guild?: DiscordGuild }>('/workspace', {
      method: 'POST',
      body: JSON.stringify({ guildId })
    });
  } catch {
    const cachedName = localStorage.getItem(`server_name_${guildId}`) || 'Discord Server';
    const cachedIcon = localStorage.getItem(`server_icon_${guildId}`);
    return {
      created: true,
      workspace: {
        id: `ws-${guildId}`,
        guildId,
        isMainBot: false,
        discordBotId: '1552165138017165372',
        botUser: { id: '1552165138017165372', username: 'ConnectingERLC Bot', avatarUrl: '' },
        isInGuild: true,
        inviteUrl: getBotInviteUrl(guildId),
        status: 'online',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasErlcApiKey: false,
        customizations: {
          serverName: cachedName,
          joinCode: '',
          j4jEnabled: true,
          j4jDailyTarget: 50,
          joinCredits: 28,
          sessionState: 'PATROL_LIVE'
        }
      },
      guild: {
        id: guildId,
        name: cachedName,
        icon: null,
        iconUrl: cachedIcon,
        owner: true
      }
    };
  }
}

export async function saveWorkspaceConfig(guildId: string, customizations: Partial<WorkspaceCustomizations>): Promise<{ success: boolean; workspace: WorkspaceBot }> {
  return api<{ success: boolean; workspace: WorkspaceBot }>(`/workspace/${guildId}/config`, {
    method: 'PATCH',
    body: JSON.stringify({ customizations })
  });
}

export async function updateWorkspaceCredentials(guildId: string, creds: { erlcApiKey: string }): Promise<{ success: boolean; workspace: WorkspaceBot }> {
  return api<{ success: boolean; workspace: WorkspaceBot }>(`/workspace/${guildId}/credentials`, {
    method: 'POST',
    body: JSON.stringify(creds)
  });
}

export async function fetchErlcLive(guildId: string): Promise<LiveErlcServer> {
  return api<LiveErlcServer>(`/workspace/${guildId}/erlc`);
}

export async function logout(): Promise<void> {
  await api('/auth/logout', { method: 'POST' });
}

export async function fetchDirectoryServers(): Promise<any[]> {
  try {
    const res = await api<{ servers: any[] }>('/directory');
    if (Array.isArray(res?.servers)) return res.servers;
  } catch {}
  return [];
}

export async function fetchServerProfile(guildId: string): Promise<any> {
  const servers = await fetchDirectoryServers();
  const matched = servers.find((s: any) => s.id === guildId || s.joinCode === guildId);
  if (matched) return matched;
  try {
    const ws = await fetchWorkspace(guildId);
    if (ws) {
      return {
        id: ws.guild?.id || guildId,
        name: ws.guild?.name || 'Community Server',
        icon: ws.guild?.iconUrl || null,
        category: (ws.workspace as any)?.serverCategory || 'Roleplay server',
        description: (ws.workspace as any)?.serverDescription || '',
        bannerUrl: (ws.workspace as any)?.bannerUrl || null,
        memberCount: ws.guild?.memberCount || 0,
        inviteUrl: (ws.workspace as any)?.inviteUrl || '',
        joinCode: (ws.workspace as any)?.joinCode || null,
      };
    }
  } catch {}
  return null;
}

export async function promoteServerToDirectory(server: any): Promise<any> {
  return api('/directory/promote', {
    method: 'POST',
    body: JSON.stringify(server)
  });
}

export async function bumpDirectoryServer(guildId: string): Promise<any> {
  return api('/directory/bump', {
    method: 'POST',
    body: JSON.stringify({ guildId })
  });
}

export async function fetchDirectoryBalance(): Promise<{ balance: number; joined: string[] }> {
  try {
    return await api<{ balance: number; joined: string[] }>('/directory/balance');
  } catch {
    return { balance: 0, joined: [] };
  }
}

export async function claimDirectoryBounty(guildId: string): Promise<any> {
  return api('/directory/claim', {
    method: 'POST',
    body: JSON.stringify({ guildId })
  });
}

import { siteUrl } from './siteUrl';

export async function sendTestNotification(guildId: string, type: 'anti_raid' | 'bump' | 'streak' | 'digest'): Promise<any> {
  return api(`/workspace/${guildId}/test-notification`, {
    method: 'POST',
    body: JSON.stringify({ type })
  });
}

export function getBotInviteUrl(guildId?: string): string {
  const clientId = '1552165138017165372';
  const permissions = '8';
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const redirectUri = isLocal
    ? `${window.location.origin}/auth/discord/callback`
    : siteUrl('/auth/discord/callback');
  const base = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&redirect_uri=${encodeURIComponent(redirectUri)}&integration_type=0&scope=bot`;
  return guildId ? `${base}&guild_id=${guildId}&disable_guild_select=true` : base;
}
