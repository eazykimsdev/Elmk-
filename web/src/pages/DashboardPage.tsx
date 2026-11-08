import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Save, AlertTriangle, Pencil, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncButton } from '@/components/ui/async-button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useDirtyFormState, useRegisterDirtyForm, dirtyFormStore } from '@/lib/dirty-form-store';
import NotificationsBlock, { type ToastNotification } from '@/components/ui/notifications-5';
import {
  fetchGuilds,
  fetchWorkspace,
  saveWorkspaceConfig,
  fetchChannels,
} from '@/lib/api';
import type {
  DiscordGuild,
  WorkspaceBot,
  WorkspaceCustomizations,
} from '@/types';
import { useAuth } from '@/lib/auth';

import { AppShell } from '@/components/ui/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { currentUser, shellNotifications } from '@/app/import/data';
import { REFERENCE_DATE } from '@/lib/sample-data';
import { type NavConfig } from '@/lib/nav-config';

import { OverviewTab } from './dashboard/OverviewTab';
import { PromoteTab } from './dashboard/PromoteTab';
import { EarnCoinsTab } from './dashboard/EarnCoinsTab';
import { RewardsTab } from './dashboard/RewardsTab';
import { ReferralsTab } from './dashboard/ReferralsTab';
import { LeaderboardTab } from './dashboard/LeaderboardTab';
import { MyJoinsTab } from './dashboard/MyJoinsTab';
import { HistoryTab } from './dashboard/HistoryTab';
import { TransferTab } from './dashboard/TransferTab';
import { UptimeTab } from './dashboard/UptimeTab';
import { ChangelogTab } from './dashboard/ChangelogTab';
import { ServerDetailsTab } from './dashboard/ServerDetailsTab';
import { BotManagementTab } from './dashboard/BotManagementTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { PartnershipsTab } from './dashboard/PartnershipsTab';
import { RecruitsTab } from './dashboard/RecruitsTab';
import { NotFoundPage } from './NotFoundPage';
import { AdminPortalPage } from './AdminPortalPage';
import { ServerProfileModal } from '@/components/ServerProfileModal';

const VALID_DASHBOARD_TABS = new Set([
  'overview',
  'details',
  'server-page',
  'promote',
  'promote-server',
  'earn',
  'earn-credits',
  'rewards',
  'leaderboard',
  'joins',
  'my-joins',
  'partnerships',
  'recruits',
  'history',
  'transfer',
  'uptime',
  'bot',
  'settings',
  'credentials',
  'changelog',
  'checkin',
  'daily-check-in',
  'admin-portal',
  'admin-potal',
  'admin-panel',
]);

const TAB_ALIASES: Record<string, string> = {
  'earn-credits': 'earn',
  'promote-server': 'promote',
  'my-joins': 'joins',
  'daily-check-in': 'checkin',
  'check-in': 'checkin',
};

export function DashboardPage() {
  const { guildId, tab } = useParams();
  const rawTab = tab || 'overview';
  const activeTabKey = TAB_ALIASES[rawTab] || rawTab;
  const navigate = useNavigate();
  const auth = useAuth();
  const authLoading = auth.loading;

  const [serverNotFound, setServerNotFound] = useState(false);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);

  const defaultSavedGuild = (() => {
    try {
      return localStorage.getItem('erlcus_default_guild');
    } catch {
      return null;
    }
  })();
  const currentGuildId = guildId || defaultSavedGuild || selectedGuild?.id || '';

  // Strict Auth Guard: Never allow viewing dashboard without signing in
  useEffect(() => {
    if (!authLoading && !auth.user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, auth.user, navigate]);

  // If no server is selected or accessible, redirect to Your servers
  useEffect(() => {
    if (!currentGuildId && !authLoading && auth.user) {
      navigate('/servers', { replace: true });
    }
  }, [currentGuildId, authLoading, auth.user, navigate]);

  useEffect(() => {
    if (currentGuildId && /^\d{17,20}$/.test(currentGuildId)) {
      try {
        localStorage.setItem('erlcus_default_guild', currentGuildId);
      } catch {}
    }
  }, [currentGuildId]);

  // Recruiter role client redirection (Section 7.6)
  useEffect(() => {
    if (auth?.user?.role === 'Recruiter' && activeTabKey !== 'recruits' && activeTabKey !== 'joins') {
      navigate(`/dashboard/${currentGuildId}/recruits`, { replace: true });
    }
  }, [auth?.user?.role, activeTabKey, currentGuildId, navigate]);

  const [workspace, setWorkspace] = useState<WorkspaceBot | null>(null);
  const [_loadingGuilds, setLoadingGuilds] = useState(true);

  const [config, setConfig] = useState<WorkspaceCustomizations>({});
  const [baselineConfig, setBaselineConfig] = useState<string>('');

  // Check for restored draft after sign-in (Section 6)
  useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem('pending_save_draft');
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft.body) {
          const parsedBody = typeof draft.body === 'string' ? JSON.parse(draft.body) : draft.body;
          if (parsedBody.customizations) {
            setConfig((prev) => ({ ...prev, ...parsedBody.customizations }));
            addToast('success', 'Changes restored', 'Signed in again. Your changes are still here.');
          }
        }
        sessionStorage.removeItem('pending_save_draft');
      }
    } catch {}
  }, []);
  const hasUnsavedChanges = Boolean(
    baselineConfig && JSON.stringify(config) !== baselineConfig
  );

  const [notificationsList, setNotificationsList] = useState(() =>
    shellNotifications()
  );

  useEffect(() => {
    const handleNotifUpdate = () => {
      setNotificationsList(shellNotifications());
    };
    window.addEventListener('erlcus_notifications_updated', handleNotifUpdate);
    return () =>
      window.removeEventListener('erlcus_notifications_updated', handleNotifUpdate);
  }, []);

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (
    variant: 'success' | 'info' | 'warning' | 'error',
    title: string,
    body: string
  ) => {
    setToasts((prev) => {
      if (prev.some((t) => t.title === title && t.body === body)) return prev;
      const id = Date.now() + Math.random();
      setTimeout(() => {
        setToasts((curr) => curr.filter((t) => t.id !== id));
      }, 4500);
      return [...prev, { id, variant, title, body }];
    });
  };

  useEffect(() => {
    const serverName = selectedGuild?.name || 'Server';
    document.title = `${serverName} — ConnectingERLC`;
  }, [selectedGuild]);

  // Shared ServerProfileModal state synced with ?server=slug
  const [modalServerSlug, setModalServerSlug] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('server');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const slug = new URLSearchParams(window.location.search).get('server');
      setModalServerSlug(slug);
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('erlcus_open_server_modal', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('erlcus_open_server_modal', handleUrlChange);
    };
  }, []);

  useEffect(() => {
    async function initGuilds() {
      if (guildId && !/^\d{17,20}$/.test(guildId)) {
        setServerNotFound(true);
        setLoadingGuilds(false);
        return;
      }

      try {
        let list = await fetchGuilds();
        list = list.filter(
          (g) =>
            g &&
            g.name &&
            !g.name.includes('Orlando') &&
            !g.name.includes('Strict')
        );

        const storedRaw = localStorage.getItem('erlcus_known_guilds');
        let storedList: DiscordGuild[] = [];
        if (storedRaw) {
          try {
            storedList = JSON.parse(storedRaw);
            storedList = storedList.filter(
              (g) =>
                g &&
                g.name &&
                !g.name.includes('Orlando') &&
                !g.name.includes('Strict')
            );
          } catch {}
        }

        list = list.map((g) => {
          const cachedIcon = localStorage.getItem(`server_icon_${g.id}`);
          const rawCachedName = localStorage.getItem(`server_name_${g.id}`);
          const validCachedName =
            rawCachedName &&
            !rawCachedName.startsWith('Community (') &&
            !rawCachedName.startsWith('ER:LC Community')
              ? rawCachedName
              : null;
          const validApiName =
            g.name &&
            !g.name.startsWith('Community (') &&
            !g.name.startsWith('ER:LC Community')
              ? g.name
              : null;
          const iconUrl =
            g.iconUrl ||
            cachedIcon ||
            (g.icon
              ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
              : null);
          const name = validApiName || validCachedName || g.name || 'Discord server';
          if (iconUrl) localStorage.setItem(`server_icon_${g.id}`, iconUrl);
          if (validApiName) localStorage.setItem(`server_name_${g.id}`, validApiName);
          return {
            ...g,
            name,
            iconUrl,
          };
        });

        for (const sg of storedList) {
          if (!list.some((g) => g.id === sg.id)) {
            const cachedIcon =
              localStorage.getItem(`server_icon_${sg.id}`) || sg.iconUrl;
            const rawCachedName = localStorage.getItem(`server_name_${sg.id}`);
            const validCachedName =
              rawCachedName &&
              !rawCachedName.startsWith('Community (') &&
              !rawCachedName.startsWith('ER:LC Community')
                ? rawCachedName
                : null;
            const validSgName =
              sg.name &&
              !sg.name.startsWith('Community (') &&
              !sg.name.startsWith('ER:LC Community')
                ? sg.name
                : null;
            list.push({
              ...sg,
              name: validSgName || validCachedName || sg.name || 'Discord server',
              iconUrl: cachedIcon || null,
            });
          }
        }

        if (
          currentGuildId &&
          !list.some((g) => g.id === currentGuildId)
        ) {
          const cachedIcon = localStorage.getItem(`server_icon_${currentGuildId}`);
          const rawCachedName = localStorage.getItem(`server_name_${currentGuildId}`);
          const validCachedName =
            rawCachedName &&
            !rawCachedName.startsWith('Community (') &&
            !rawCachedName.startsWith('ER:LC Community')
              ? rawCachedName
              : null;
          const directGuild: DiscordGuild = {
            id: currentGuildId,
            name: validCachedName || 'Community server',
            icon: null,
            iconUrl: cachedIcon || null,
            owner: true,
            hasWorkspace: true,
            configured: true,
          };
          list = [directGuild, ...list];
        }

        const matched = list.find((g) => g.id === currentGuildId);
        if (matched) {
          if (matched.botStatus === 'Not added' || (!matched.bot_in_guild && matched.botStatus !== 'Online' && matched.botStatus !== 'Missing permissions')) {
            navigate(`/servers?need_bot=${matched.id}`, { replace: true });
            return;
          }
          setSelectedGuild(matched);
        } else if (guildId) {
          try {
            const data = await fetchWorkspace(guildId);
            if (data?.guild) {
              list = [data.guild, ...list];
              setSelectedGuild(data.guild);
            } else {
              setServerNotFound(true);
              return;
            }
          } catch (err: any) {
            if (err?.error === 'BOT_NOT_IN_GUILD' || err?.message?.includes('BOT_NOT_IN_GUILD')) {
              navigate(`/servers?need_bot=${guildId}`, { replace: true });
              return;
            }
            setServerNotFound(true);
            return;
          }
        } else {
          setSelectedGuild(list[0] || null);
        }

        try {
          localStorage.setItem('erlcus_known_guilds', JSON.stringify(list));
        } catch {}

        setGuilds(list);
      } catch (err) {
        console.warn('Failed to load user guilds:', err);
      } finally {
        setLoadingGuilds(false);
      }
    }
    initGuilds();
  }, [currentGuildId, guildId]);

  const loadWorkspaceData = useCallback(async (targetId: string) => {
    try {
      const data = await fetchWorkspace(targetId);
      setWorkspace(data.workspace);
      if (data?.workspace?.customizations) {
        setConfig(data.workspace.customizations);
        setBaselineConfig(JSON.stringify(data.workspace.customizations));
        if (data.workspace.customizations.serverIconUrl) {
          localStorage.setItem(
            `server_icon_${targetId}`,
            data.workspace.customizations.serverIconUrl
          );
          setGuilds((prev) => {
            const updated = prev.map((g) =>
              g.id === targetId
                ? {
                    ...g,
                    iconUrl:
                      g.iconUrl || data.workspace.customizations.serverIconUrl,
                  }
                : g
            );
            try {
              localStorage.setItem('erlcus_known_guilds', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      }
      if (data?.guild) {
        if (data.guild.iconUrl) {
          localStorage.setItem(`server_icon_${targetId}`, data.guild.iconUrl);
        }
        if (data.guild.name) {
          localStorage.setItem(`server_name_${targetId}`, data.guild.name);
        }
        if (
          data.guild.memberCount ||
          (data.guild as any).approximateMemberCount
        ) {
          const mCount =
            data.guild.memberCount || (data.guild as any).approximateMemberCount;
          localStorage.setItem(`server_members_${targetId}`, mCount.toString());
        }
        if (data.guild.channels && Array.isArray(data.guild.channels)) {
          localStorage.setItem(
            `erlcus_channels_${targetId}`,
            JSON.stringify(data.guild.channels)
          );
        }
        setSelectedGuild((prev) => {
          return {
            ...(prev || {}),
            ...data.guild,
            id: targetId,
            channels: data.guild.channels || (prev as any)?.channels || [],
          } as DiscordGuild;
        });
        setGuilds((prev) => {
          const updated = prev.map((g) =>
            g.id === targetId
              ? {
                  ...g,
                  name: data.guild.name || g.name,
                  iconUrl: data.guild.iconUrl || g.iconUrl,
                  memberCount: data.guild.memberCount || g.memberCount,
                  channels: data.guild.channels || (g as any).channels,
                }
              : g
          );
          try {
            localStorage.setItem('erlcus_known_guilds', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        fetchChannels(targetId).then((chs) => {
          if (chs && chs.length > 0) {
            setSelectedGuild((prev) =>
              prev ? ({ ...prev, channels: chs } as any) : null
            );
          }
        });
      }
    } catch (err: any) {
      console.warn('Workspace data fetch notice:', err.message);
    }
  }, []);

  useEffect(() => {
    if (currentGuildId) {
      loadWorkspaceData(currentGuildId);
    }
  }, [currentGuildId, loadWorkspaceData]);

  const handleSelectGuild = (newGuildId: string) => {
    const found = guilds.find((g) => g.id === newGuildId);
    if (found) {
      setSelectedGuild(found);
      try {
        localStorage.setItem('erlcus_default_guild', newGuildId);
      } catch {}
      window.dispatchEvent(new CustomEvent('balance_updated', { detail: { guildId: newGuildId } }));
      const nextTab = tab ? `/${tab}` : '';
      navigate(`/dashboard/${newGuildId}${nextTab}`);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await saveWorkspaceConfig(currentGuildId, config);
      setBaselineConfig(JSON.stringify(config));
      addToast('success', 'Changes saved!', 'Your server settings have been updated.');
    } catch (err: any) {
      addToast(
        'error',
        'Could not save changes',
        err.message || 'Check your connection and try again.'
      );
    }
  };

  const handleResetConfig = () => {
    if (baselineConfig) {
      try {
        setConfig(JSON.parse(baselineConfig));
        addToast('info', 'Changes discarded', 'Reverted to your last saved settings.');
      } catch {}
    }
  };

  // Register workspace settings form with single global dirty store (only on settings tabs)
  useRegisterDirtyForm({
    id: `workspace-config-${currentGuildId}`,
    isDirty: (activeTabKey === 'settings' || activeTabKey === 'credentials') && hasUnsavedChanges,
    onSave: handleSaveConfig,
    onReset: handleResetConfig,
  });

  // Single dirty form store state for app shell
  const {
    isDirty: isAnyFormDirty,
    isSaving: isAnyFormSaving,
    sections: dirtySections = [],
    changedFields: dirtyFields = [],
    save: saveDirtyForms,
    reset: resetDirtyForms,
  } = useDirtyFormState();

  const leaveDialogText = useMemo(() => {
    if (!dirtySections || dirtySections.length === 0) {
      return 'You have unsaved changes.';
    }
    if (dirtySections.length === 1) {
      return `You have unsaved changes in ${dirtySections[0]}.`;
    }
    return `You have unsaved changes in ${dirtySections.join(' and ')}.`;
  }, [dirtySections]);

  const displayedChips = useMemo(() => {
    return dirtyFields.slice(0, 3);
  }, [dirtyFields]);
  const moreChipsCount = Math.max(0, dirtyFields.length - 3);

  // Router blocker for unsaved changes navigation guard
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        isAnyFormDirty && currentLocation.pathname !== nextLocation.pathname,
      [isAnyFormDirty]
    )
  );

  // Beforeunload listener for window/tab close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAnyFormDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAnyFormDirty]);

  // Global Ctrl+S shortcut connected to dirty store
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isAnyFormDirty && !isAnyFormSaving) {
          saveDirtyForms();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyFormDirty, isAnyFormSaving, saveDirtyForms]);

  const userProfile = useMemo(() => {
    return currentUser(auth?.user);
  }, [auth?.user]);

  const workspacesConfig = useMemo(() => {
    return {
      current: currentGuildId,
      items: guilds.map((g) => {
        const cachedIcon = localStorage.getItem(`server_icon_${g.id}`);
        const iconUrl =
          g.iconUrl ||
          cachedIcon ||
          (g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null);
        const cachedMembers = localStorage.getItem(`server_members_${g.id}`);
        const memberCount =
          typeof g.memberCount === 'number'
            ? g.memberCount
            : typeof g.approximateMemberCount === 'number'
            ? g.approximateMemberCount
            : cachedMembers
            ? parseInt(cachedMembers, 10)
            : 0;
        return {
          id: g.id,
          name: g.name,
          initial: g.name.slice(0, 2).toUpperCase(),
          iconUrl,
          memberCount: isNaN(memberCount) ? 0 : memberCount,
        };
      }),
    };
  }, [guilds, currentGuildId]);

  const nav: NavConfig = useMemo(
    () => ({
      brand: {
        name:
          selectedGuild?.name ||
          workspace?.customizations?.serverName ||
          'Server',
        initial: (
          selectedGuild?.name ||
          workspace?.customizations?.serverName ||
          'SV'
        )
          .slice(0, 2)
          .toUpperCase(),
        href: `/dashboard/${currentGuildId}`,
      },
      groups: [
        {
          items: [
            {
              title: 'Overview',
              href: `/dashboard/${currentGuildId}`,
              icon: 'layout-dashboard',
              exact: true,
            },
          ],
        },
        {
          label: 'Growth',
          items: [
            {
              title: 'Server page',
              href: `/dashboard/${currentGuildId}/details`,
              icon: 'server',
            },
            {
              title: 'Promote server',
              href: `/dashboard/${currentGuildId}/promote`,
              icon: 'megaphone',
            },
            {
              title: 'Earn credits',
              href: `/dashboard/${currentGuildId}/earn`,
              icon: 'coins',
            },
            {
              title: 'Daily check-in',
              href: `/dashboard/${currentGuildId}/rewards`,
              icon: 'calendar',
            },
            {
              title: 'Leaderboard',
              href: `/dashboard/${currentGuildId}/leaderboard`,
              icon: 'chart-line',
            },
            {
              title: 'My joins',
              href: `/dashboard/${currentGuildId}/joins`,
              icon: 'users',
            },
            {
              title: 'Partnerships',
              href: `/dashboard/${currentGuildId}/partnerships`,
              icon: 'message-square-heart',
            },
          ],
        },
        {
          label: 'System',
          items: [
            {
              title: 'System status',
              href: `/dashboard/${currentGuildId}/uptime`,
              icon: 'activity',
            },
            {
              title: 'Changelog',
              href: `/dashboard/${currentGuildId}/changelog`,
              icon: 'git-branch',
            },
            {
              title: 'Settings',
              href: `/dashboard/${currentGuildId}/settings`,
              icon: 'settings',
            },
          ],
        },
      ],
      footer: [],
    }),
    [selectedGuild, currentGuildId, workspace]
  );

  const activeHref =
    activeTabKey === 'overview'
      ? `/dashboard/${currentGuildId}`
      : `/dashboard/${currentGuildId}/${activeTabKey}`;

  const serverName = selectedGuild?.name || 'Server';

  const handleSignOut = async () => {
    try {
      await auth.logout();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    window.location.assign('/');
  };

  const breadcrumbs = useMemo(() => {
    const brandName =
      selectedGuild?.name ||
      workspace?.customizations?.serverName ||
      'Server';
    const tabTitles: Record<string, string> = {
      overview: 'Overview',
      details: 'Server page',
      'server-page': 'Server page',
      promote: 'Promote server',
      earn: 'Earn credits',
      rewards: 'Daily check-in',
      leaderboard: 'Leaderboard',
      joins: 'My joins',
      partnerships: 'Partnerships',
      history: 'Credit history',
      bot: 'Bot setup',
      uptime: 'System status',
      changelog: 'Changelog',
      settings: 'Settings',
    };
    const title = tabTitles[activeTabKey] || 'Overview';
    return [
      { title: brandName, href: `/dashboard/${currentGuildId}` },
      { title, href: `/dashboard/${currentGuildId}/${activeTabKey === 'overview' ? '' : activeTabKey}` },
    ];
  }, [selectedGuild, workspace, currentGuildId, activeTabKey]);

  if (authLoading || !auth.user) {
    return (
      <div className="min-h-svh bg-[#09090B] flex flex-col items-center justify-center gap-3 text-sm text-[#A1A1AA] font-sans">
        <div className="size-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <span>Loading account…</span>
      </div>
    );
  }

  if (serverNotFound) {
    return <NotFoundPage />;
  }

  if (tab && !VALID_DASHBOARD_TABS.has(tab) && tab !== 'admin-panel') {
    return <NotFoundPage />;
  }

  if (tab === 'admin-portal' || tab === 'admin-potal' || tab === 'admin-panel') {
    return <AdminPortalPage />;
  }

  return (
    <AppShell
      nav={nav}
      activeHref={activeHref}
      breadcrumbs={breadcrumbs}
      workspaces={workspacesConfig}
      onWorkspaceChange={handleSelectGuild}
      user={userProfile}
      notifications={notificationsList}
      now={REFERENCE_DATE}
      onSignOut={handleSignOut}
    >
      {/* Dynamic PageHeader */}
      {(activeTabKey === 'details' || activeTabKey === 'server-page') && (
        <PageHeader
          title="Server page"
          description="How your server looks in the public directory."
        />
      )}

      {activeTabKey === 'earn' && (
        <PageHeader
          title="Earn credits"
          description="Join listed Discord servers to earn credits, then spend them to bump your own server."
        />
      )}

      {activeTabKey === 'rewards' && (
        <PageHeader
          title="Daily check-in"
          description="Claim your daily credit allowance once every 24 hours."
        />
      )}

      {activeTabKey === 'referrals' && (
        <PageHeader
          title="Referrals"
          description="Invite other server owners and earn credits when they list their server."
        />
      )}

      {activeTabKey === 'leaderboard' && (
        <PageHeader
          title="Leaderboard"
          description="Top communities, recruiters, and mutual partners across the ConnectingERLC network."
        />
      )}

      {activeTabKey === 'joins' && (
        <PageHeader
          title="My joins"
          description="Servers you joined through ConnectingERLC and their 72-hour verification status."
        />
      )}

      {activeTabKey === 'history' && (
        <PageHeader
          title="Credit history"
          description="Every credit added to or spent from your balance."
        />
      )}

      {activeTabKey === 'transfer' && (
        <PageHeader
          title="Credit store"
          description="Spend credits on server bumps and directory slots."
        />
      )}

      {activeTabKey === 'uptime' && (
        <PageHeader
          title="System status"
          description="Live status for the API, database, Discord bot, and ER:LC sync."
        />
      )}

      {activeTabKey === 'bot' && (
        <PageHeader
          title="Bot setup"
          description="Connect the ConnectingERLC bot to your server and configure modules."
        />
      )}

      {(activeTabKey === 'settings' || activeTabKey === 'credentials') && (
        <PageHeader
          title="Settings"
          description="Manage your server preferences, notifications, and API keys."
        />
      )}

      {activeTabKey === 'changelog' && (
        <PageHeader
          title="Changelog"
          description="Recent updates and fixes across ConnectingERLC."
        />
      )}

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="fixed bottom-20 right-6 z-[100] max-w-sm w-full pointer-events-none">
          <NotificationsBlock
            notifications={toasts}
            onDismiss={(id: number | string) =>
              setToasts((prev) => prev.filter((t) => t.id !== id))
            }
            className="pointer-events-auto"
          />
        </div>

        {/* Single Global Unsaved Changes Bar */}
        {isAnyFormDirty && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-150">
            <div className="bg-[#141417] border border-[var(--border-strong)] rounded-[16px] px-4 py-2.5 flex items-center gap-4 text-xs shadow-lg font-sans">
              <div className="flex items-center gap-2 text-[#F4F4F5] font-medium font-sans">
                <span className="size-2 rounded-full bg-[#FBBF24] shrink-0" />
                <span>You have unsaved changes</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetDirtyForms}
                  disabled={isAnyFormSaving}
                  className="h-8 px-3 text-xs text-[#A1A1AA] hover:text-[#F4F4F5]"
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveDirtyForms}
                  disabled={isAnyFormSaving}
                  className="h-8 px-3.5 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] text-xs font-medium rounded-[10px]"
                >
                  {isAnyFormSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>

              <kbd className="hidden sm:inline-block font-mono text-[11px] text-[#71717A] px-1.5 py-0.5 rounded-[6px] border border-white/10 bg-[#19191D]">
                Ctrl S
              </kbd>
            </div>
          </div>
        )}

        {/* Unsaved Changes Route Guard Dialog */}
        {blocker.state === 'blocked' && (
          <Dialog open={true} onOpenChange={() => blocker.reset?.()}>
            <DialogContent
              showCloseButton={false}
              className="w-full max-w-[420px] sm:max-w-[420px] bg-[#0E0E11] border border-[var(--border,#27272A)] rounded-[16px] p-6 shadow-none overflow-hidden relative"
            >
              {/* Close button: top right */}
              <button
                type="button"
                onClick={() => blocker.reset?.()}
                className="absolute top-4 right-4 size-7 rounded-[8px] flex items-center justify-center text-[#71717A] hover:text-[#F4F4F5] hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>

              <div className="space-y-1.5 pr-6">
                <h3 className="text-[18px] font-semibold text-[#F4F4F5] font-sans leading-snug">
                  Leave without saving?
                </h3>
                <p className="text-[14px] text-[#A1A1AA] font-sans leading-normal">
                  Your changes will be lost if you leave this page.
                </p>
              </div>

              {/* Changed fields preview badges: max 3 then +N more */}
              {displayedChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3">
                  {displayedChips.map((chip) => (
                    <span
                      key={chip}
                      className="bg-[#19191D] text-[#A1A1AA] border border-[var(--border,#27272A)] text-[12px] px-2 py-0.5 rounded-[6px] font-sans"
                    >
                      {chip}
                    </span>
                  ))}
                  {moreChipsCount > 0 && (
                    <span className="bg-[#19191D] text-[#A1A1AA] border border-[var(--border,#27272A)] text-[12px] px-2 py-0.5 rounded-[6px] font-sans">
                      +{moreChipsCount} more
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons footer */}
              <div className="flex flex-wrap items-center justify-end gap-2 mt-6 pt-0">
                <Button
                  variant="ghost"
                  onClick={() => blocker.reset?.()}
                  className="h-9 px-3.5 text-[13px] text-[#A1A1AA] hover:text-[#F4F4F5] focus-visible:outline-none focus-visible:ring-0"
                >
                  Stay
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    dirtyFormStore.resetAll();
                    blocker.proceed?.();
                  }}
                  className="h-9 px-3.5 text-[13px] bg-[#19191D] hover:bg-[#202025] text-zinc-300 border border-[var(--border,#27272A)]"
                >
                  Discard changes
                </Button>
                <Button
                  variant="primary"
                  disabled={isAnyFormSaving}
                  onClick={async () => {
                    try {
                      await dirtyFormStore.saveAll();
                      blocker.proceed?.();
                    } catch (err: any) {
                      addToast('error', 'Save error', err?.message || 'Could not save changes before leaving.');
                    }
                  }}
                  className="h-9 px-4 text-[13px] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] font-semibold flex items-center gap-2"
                >
                  {isAnyFormSaving && <Loader2 className="size-4 animate-spin" />}
                  <span>{isAnyFormSaving ? 'Saving...' : 'Save and leave'}</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Active Content Module */}
        <main className="space-y-6 min-w-0">
          {activeTabKey === 'overview' && (
            <OverviewTab
              guild={selectedGuild}
              workspace={workspace}
              config={config}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
            />
          )}

          {(activeTabKey === 'details' || activeTabKey === 'server-page') && (
            <ServerDetailsTab
              guild={selectedGuild}
              workspace={workspace}
              config={config}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
            />
          )}

          {activeTabKey === 'import' && (
            <PromoteTab
              guild={selectedGuild}
              config={config}
              onChangeConfig={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
              onSaveConfig={handleSaveConfig}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
              initialSubTab="roster"
            />
          )}

          {activeTabKey === 'promote' && (
            <PromoteTab
              guild={selectedGuild}
              config={config}
              onChangeConfig={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
              onSaveConfig={handleSaveConfig}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
              initialSubTab="listing"
            />
          )}

          {activeTabKey === 'earn' && (
            <EarnCoinsTab
              currentGuildId={currentGuildId}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
            />
          )}

          {activeTabKey === 'rewards' && <RewardsTab addToast={addToast} />}

          {activeTabKey === 'referrals' && (
            <ReferralsTab currentGuildId={currentGuildId} addToast={addToast} />
          )}

          {activeTabKey === 'leaderboard' && (
            <LeaderboardTab
              currentGuildId={currentGuildId}
              addToast={addToast}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
            />
          )}

          {activeTabKey === 'joins' && (
            <MyJoinsTab
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
            />
          )}

          {activeTabKey === 'partnerships' && (
            <PartnershipsTab
              currentGuildId={currentGuildId}
              serverName={selectedGuild?.name || 'Server'}
              addToast={addToast}
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
            />
          )}

          {activeTabKey === 'recruits' && (
            <RecruitsTab
              currentGuildId={currentGuildId}
              serverName={selectedGuild?.name || 'Server'}
              addToast={addToast}
            />
          )}

          {activeTabKey === 'history' && (
            <HistoryTab
              onNavigateTab={(t) => navigate(`/dashboard/${currentGuildId}/${t}`)}
              addToast={addToast}
            />
          )}

          {activeTabKey === 'transfer' && <TransferTab addToast={addToast} />}

          {activeTabKey === 'uptime' && <UptimeTab addToast={addToast} />}

          {activeTabKey === 'bot' && (
            <BotManagementTab
              guild={selectedGuild}
              workspace={workspace}
              config={config}
              onChangeConfig={(updates) =>
                setConfig((prev) => ({ ...prev, ...updates }))
              }
              onSaveConfig={handleSaveConfig}
              addToast={addToast}
            />
          )}

          {(activeTabKey === 'settings' || activeTabKey === 'credentials') && (
            <SettingsTab
              guild={selectedGuild}
              workspace={workspace}
              config={config}
              onChangeConfig={(updates) =>
                setConfig((prev) => ({ ...prev, ...updates }))
              }
              onSaveConfig={handleSaveConfig}
              addToast={addToast}
            />
          )}

          {activeTabKey === 'changelog' && <ChangelogTab />}
        </main>
      </div>

      {/* Shared Server Profile Details Modal (?server=slug) */}
      {modalServerSlug && (
        <ServerProfileModal
          serverSlug={modalServerSlug}
          currentUserId={auth?.user?.id}
          isOwnServer={Boolean(selectedGuild && String(selectedGuild.id) === String(modalServerSlug))}
          onClose={() => {
            setModalServerSlug(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('server');
            window.history.pushState({}, '', url.toString());
          }}
          onJoin={() => {
            fetch(`/api/directory/join/${encodeURIComponent(modalServerSlug)}`, {
              method: 'POST',
              credentials: 'include',
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.inviteUrl) {
                  window.open(data.inviteUrl, '_blank', 'noopener,noreferrer');
                }
                if (data.success) {
                  addToast('success', 'Joined server', 'Membership recorded and bounty verification active.');
                }
              })
              .catch(() => {});
          }}
          onBump={() => {
            setModalServerSlug(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('server');
            window.history.pushState({}, '', url.toString());
            navigate(`/dashboard/${currentGuildId}/overview`);
          }}
          addToast={addToast}
        />
      )}
    </AppShell>
  );
}

export default DashboardPage;
