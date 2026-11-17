import type { DiscordGuild, DiscordUser, WorkspaceBot, LiveErlcServer, WorkspaceCustomizations } from '../types';

let csrfToken = '';
try {
  csrfToken = sessionStorage.getItem('erlc_csrf_token') || '';
} catch {}

export function getDiscordLoginUrl(): string {
  // The backend builds the Discord authorize URL so the OAuth state and server-membership check apply.
  return '/api/auth/discord/start?returnTo=%2Fdashboard';
}

export function setCsrfToken(token: string) {
  csrfToken = token;
  try {
    sessionStorage.setItem('erlc_csrf_token', token);
  } catch {}
}

export function getCsrfToken(): string {
  return csrfToken;
}

const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

async function resolveCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  try {
    const stored = sessionStorage.getItem('erlc_csrf_token') || '';
    if (stored) {
      csrfToken = stored;
      return stored;
    }
  } catch {}
  try {
    const meRes = await nativeFetch('/api/auth/me', { credentials: 'include' });
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData?.csrfToken) {
        setCsrfToken(meData.csrfToken);
        return meData.csrfToken;
      }
    }
  } catch {}
  return '';
}

// Automatically attach X-CSRF-Token and credentials on any same-origin state-changing fetch call
if (typeof window !== 'undefined' && !(window as any).__erlcFetchPatched) {
  (window as any).__erlcFetchPatched = true;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const isSameOrigin = rawUrl.startsWith('/') || (typeof window !== 'undefined' && rawUrl.startsWith(window.location.origin));
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();

    if (isSameOrigin && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('X-CSRF-Token')) {
        const token = await resolveCsrfToken();
        if (token) headers.set('X-CSRF-Token', token);
      }
      return nativeFetch(input, {
        ...init,
        method,
        headers,
        credentials: init?.credentials || 'include'
      });
    }
    return nativeFetch(input, init);
  };
}

/**
 * Shared API Fetch Wrapper (Item 1a & 1b)
 * Used across the dashboard for all API operations:
 * - Ensures credentials: 'include'
 * - Injects X-CSRF-Token on state-changing requests (POST, PUT, PATCH, DELETE)
 * - Normalizes URL path (adds /api prefix if relative without /api)
 * - Safely verifies response Content-Type (throws clear error if HTML instead of JSON)
 */
export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Ensure CSRF token is attached for state-changing requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await resolveCsrfToken();
    if (token) {
      headers.set('X-CSRF-Token', token);
    }
  }

  const rawUrl = typeof input === 'string' ? input : input.toString();
  let normalizedUrl = rawUrl;
  if (!rawUrl.startsWith('http') && !rawUrl.startsWith('/api')) {
    normalizedUrl = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }

  const res = await nativeFetch(normalizedUrl, {
    ...init,
    method,
    headers,
    credentials: 'include'
  });

  // Check Content-Type: If not JSON (e.g. HTML fallback), throw human-readable error instead of JSON parse crash
  const contentType = res.headers.get('content-type') || '';
  if (res.status !== 204 && !contentType.includes('application/json')) {
    throw new Error(`Server returned unexpected ${res.status} response (${contentType.split(';')[0] || 'non-JSON'}).`);
  }

  return res;
}

export async function api<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const response = await apiFetch(path, init);

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
    const res = await api<{ servers: any[] }>('/directory?all=true');
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

export async function sendTestNotification(guildId: string, type: 'bump' | 'streak' | 'partnership' | 'review' | string): Promise<any> {
  return api(`/workspace/${guildId}/test-notification`, {
    method: 'POST',
    body: JSON.stringify({ type })
  });
}

export function getBotInviteUrl(guildId?: string): string {
  const clientId = '1560767279191302215';
  const permissions = '2147485696';
  const base = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&integration_type=0&scope=bot%20applications.commands`;
  return guildId ? `${base}&guild_id=${guildId}&disable_guild_select=true` : base;
}
