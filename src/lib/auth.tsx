import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { DiscordGuild, DiscordUser } from '../types';
import { fetchAuthMe, logout as apiLogout } from './api';

interface AuthContextType {
  user: DiscordUser | null;
  guilds: DiscordGuild[];
  loading: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  guilds: [],
  loading: true,
  refreshAuth: async () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // GET /api/auth/me is the ONLY source of truth (Section 1.3)
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await fetchAuthMe();
      if (data && data.user) {
        setUser(data.user);
        if (data.guilds && Array.isArray(data.guilds)) {
          setGuilds(data.guilds);
          try { localStorage.setItem('erlcus_known_guilds', JSON.stringify(data.guilds)); } catch {}
        }
      } else {
        setUser(null);
        setGuilds([]);
        try {
          localStorage.removeItem('erlcus_user');
          localStorage.removeItem('connectingerlc_user');
          localStorage.removeItem('erlcus_known_guilds');
          localStorage.removeItem('erlcus_default_guild');
          localStorage.removeItem('connectingerlc_user_joins');
          localStorage.removeItem('erlcus_credits_balance');
          localStorage.removeItem('erlcus_current_user_ban');
        } catch {}
      }
    } catch {
      setUser(null);
      setGuilds([]);
      try {
        localStorage.removeItem('erlcus_user');
        localStorage.removeItem('connectingerlc_user');
        localStorage.removeItem('erlcus_known_guilds');
        localStorage.removeItem('erlcus_default_guild');
        localStorage.removeItem('connectingerlc_user_joins');
        localStorage.removeItem('erlcus_credits_balance');
        localStorage.removeItem('erlcus_current_user_ban');
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();

    const handleUnauthorized = () => {
      refreshAuth();
    };
    window.addEventListener('connectingerlc_auth_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('connectingerlc_auth_unauthorized', handleUnauthorized);
    };
  }, [refreshAuth]);

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {}

    // Cleanly wipe all user session artifacts from storage
    try {
      localStorage.removeItem('erlcus_user');
      localStorage.removeItem('connectingerlc_user');
      localStorage.removeItem('erlcus_known_guilds');
      localStorage.removeItem('erlcus_default_guild');
      localStorage.removeItem('connectingerlc_user_joins');
      localStorage.removeItem('erlcus_credits_balance');
      localStorage.removeItem('erlcus_current_user_ban');
      sessionStorage.clear();
      document.cookie = 'connectingerlc_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      document.cookie = 'erlcus_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      document.cookie = 'erlc_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    } catch {}

    setUser(null);
    setGuilds([]);
    window.location.assign('/login');
  };

  return (
    <AuthContext.Provider value={{ user, guilds, loading, refreshAuth, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
