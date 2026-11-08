'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Coins,
  CalendarCheck,
  Trophy,
  Users,
  Handshake,
  Activity,
  GitBranch,
  Settings,
  Eye,
  Search,
  ChevronDown,
  MoreHorizontal,
  Flame,
  Check,
  Server,
  UserRound,
  Bot,
  Receipt,
  BookOpen,
  HelpCircle,
  Moon,
  Sun,
  Laptop,
  LogOut,
  Sparkles,
  UserPlus,
  Palette,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useTheme } from '@/components/library/theme-provider';
import type { NavConfig } from '@/lib/nav-config';
import type { AppShellUser, AppShellWorkspace } from '@/components/ui/app-shell';

export type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
  badge?: React.ReactNode;
  chevron?: React.ReactNode;
  isChild?: boolean;
};

export type NavigationGroup = {
  label?: string;
  items: NavigationItem[];
};

export type AppShellSidebarProps = {
  nav: NavConfig;
  activeHref?: string;
  onSearch?: () => void;
  workspaces?: AppShellWorkspace[];
  workspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  side?: 'left' | 'right';
  user?: AppShellUser;
  onSignOut?: () => void;
};

export function ServerAvatar({
  name,
  iconUrl,
  size = 'md',
  className,
}: {
  name?: string;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  return (
    <ServerIcon
      name={name}
      iconUrl={iconUrl}
      size={size}
      className={className}
    />
  );
}

export function DashboardSidebar({
  activeHref,
  onSearch,
  workspaces,
  workspaceId,
  onWorkspaceChange,
  side = 'left',
  user,
  onSignOut,
}: AppShellSidebarProps) {
  const { state, isMobile, setOpenMobile, setOpen } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const navigate = useNavigate();
  const location = useLocation();

  const [searchServerQuery, setSearchServerQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentGuildId =
    workspaceId || (workspaces && workspaces[0]?.id) || '';
  const currentWorkspace =
    workspaces?.find((w) => w.id === currentGuildId) || workspaces?.[0];

  // Save collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('connectingerlc_sidebar_collapsed', String(collapsed));
    } catch {}
  }, [collapsed]);

  // Real member count from workspace or cached value
  const realMemberCount = useMemo(() => {
    if (typeof currentWorkspace?.memberCount === 'number' && currentWorkspace.memberCount >= 0) {
      return currentWorkspace.memberCount;
    }
    try {
      const cached = localStorage.getItem(`server_members_${currentGuildId}`);
      if (cached) {
        const parsed = parseInt(cached, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch {}
    return 0;
  }, [currentWorkspace, currentGuildId]);

  // Server banner if configured
  const serverBannerUrl = useMemo(() => {
    try {
      const storedBanner = localStorage.getItem(`server_banner_${currentGuildId}`);
      if (storedBanner) return storedBanner;
      const raw = localStorage.getItem('erlcus_promoted_servers');
      if (raw) {
        const list = JSON.parse(raw);
        const match = list.find((s: any) => String(s.id) === String(currentGuildId));
        if (match?.bannerUrl) return match.bannerUrl;
      }
    } catch {}
    return null;
  }, [currentGuildId]);

  // Bump cooldown state (shared source of truth with Overview)
  const [bumpRemainingSeconds, setBumpRemainingSeconds] = useState<number>(0);
  const [bumping, setBumping] = useState<boolean>(false);

  const checkBumpStatus = () => {
    try {
      const savedNext = localStorage.getItem(`server_next_bump_${currentGuildId}`);
      if (savedNext) {
        const nextTime = parseInt(savedNext, 10);
        const rem = Math.max(0, Math.ceil((nextTime - Date.now()) / 1000));
        setBumpRemainingSeconds(rem);
        return;
      }
    } catch {}

    try {
      const s1 = localStorage.getItem(`server_bump_${currentGuildId}`);
      const s2 = localStorage.getItem(`erlcus_bump_${currentGuildId}`);
      const t1 = s1 ? parseInt(s1, 10) : 0;
      const t2 = s2 ? parseInt(s2, 10) : 0;
      const last = Math.max(t1, t2);
      if (last === 0) {
        setBumpRemainingSeconds(0);
      } else {
        const elapsed = Date.now() - last;
        const rem = Math.max(0, Math.ceil((60 * 60 * 1000 - elapsed) / 1000));
        setBumpRemainingSeconds(rem);
      }
    } catch {
      setBumpRemainingSeconds(0);
    }
  };

  useEffect(() => {
    checkBumpStatus();
    const timer = setInterval(checkBumpStatus, 1000);
    const onBumpEvent = () => checkBumpStatus();
    window.addEventListener('server_bumped', onBumpEvent);
    window.addEventListener('erlcus_bump_updated', onBumpEvent);
    return () => {
      clearInterval(timer);
      window.removeEventListener('server_bumped', onBumpEvent);
      window.removeEventListener('erlcus_bump_updated', onBumpEvent);
    };
  }, [currentGuildId]);

  const canBump = bumpRemainingSeconds === 0;

  const formatRemainingTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${Math.max(1, minutes)}m`;
  };

  // Perform quick bump
  const handleQuickBump = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canBump || bumping) return;
    setBumping(true);
    try {
      const nextTime = Date.now() + 60 * 60 * 1000;
      localStorage.setItem(`server_next_bump_${currentGuildId}`, String(nextTime));
      localStorage.setItem(`server_bump_${currentGuildId}`, String(Date.now()));

      // Increment bumps count
      const currentBumps = parseInt(localStorage.getItem(`server_bumps_count_${currentGuildId}`) || '0', 10);
      localStorage.setItem(`server_bumps_count_${currentGuildId}`, String(currentBumps + 1));

      window.dispatchEvent(new Event('server_bumped'));
      window.dispatchEvent(new Event('erlcus_bump_updated'));
      setBumpRemainingSeconds(3600);
    } catch {}
    finally {
      setBumping(false);
    }
  };

  // Count incoming partnership requests (Section 8.2 & 8.3)
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchPendingCount = async () => {
      try {
        const res = await fetch(`/api/partnerships/${currentGuildId}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data?.summary?.waitingCount !== undefined) {
            setPendingRequestsCount(Number(data.summary.waitingCount) || 0);
          }
        }
      } catch {}
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000);
    const onUpdate = () => fetchPendingCount();
    window.addEventListener('mavely_partnerships_updated', onUpdate);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('mavely_partnerships_updated', onUpdate);
    };
  }, [currentGuildId]);

  const currentPath = location.pathname + location.search;

  // Recruiter role check (Section 7.6)
  const isRecruiter = (user as any)?.role === 'Recruiter';

  // Collapsible My Joins / Recruit Hub state (Section 7.1)
  const isRecruitOrJoinRoute =
    location.pathname.includes('/joins') ||
    location.pathname.includes('/recruits') ||
    location.pathname.includes('/recruit');

  const [myJoinsExpanded, setMyJoinsExpanded] = useState<boolean>(() => isRecruitOrJoinRoute);

  useEffect(() => {
    if (isRecruitOrJoinRoute) {
      setMyJoinsExpanded(true);
    }
  }, [isRecruitOrJoinRoute]);

  // Flat navigation structure
  const navigationGroups: NavigationGroup[] = useMemo(() => {
    if (isRecruiter) {
      return [
        {
          label: 'Recruiting',
          items: [
            {
              label: 'My joins',
              href: `/dashboard/${currentGuildId}/joins`,
              icon: Users,
              chevron: (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Toggle recruit hub"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMyJoinsExpanded((prev) => !prev);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      setMyJoinsExpanded((prev) => !prev);
                    }
                  }}
                  className="size-5 rounded flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <ChevronDown className={cn('size-3.5 transition-transform duration-150', !myJoinsExpanded && '-rotate-90')} />
                </span>
              ),
            },
            ...(myJoinsExpanded
              ? [
                  {
                    label: 'Recruit hub',
                    href: `/dashboard/${currentGuildId}/recruits`,
                    icon: UserPlus,
                    isChild: true,
                  },
                ]
              : []),
          ],
        },
        {
          label: 'Resources',
          items: [
            {
              label: 'Docs',
              href: `/docs`,
              icon: BookOpen,
            },
          ],
        },
      ];
    }

    return [
      {
        items: [
          {
            label: 'Overview',
            href: `/dashboard/${currentGuildId}`,
            icon: LayoutDashboard,
            exact: true,
            badge: canBump ? (
              <span className="size-2 rounded-full bg-[var(--accent)] shrink-0" title="Bump ready" />
            ) : null,
          },
        ],
      },
      {
        label: 'Growth',
        items: [
          {
            label: 'Server page',
            href: `/dashboard/${currentGuildId}/details`,
            icon: Eye,
          },
          {
            label: 'Promote server',
            href: `/dashboard/${currentGuildId}/promote`,
            icon: Megaphone,
          },
          {
            label: 'Earn credits',
            href: `/dashboard/${currentGuildId}/earn`,
            icon: Coins,
          },
          {
            label: 'Daily check-in',
            href: `/dashboard/${currentGuildId}/rewards`,
            icon: CalendarCheck,
          },
          {
            label: 'Leaderboard',
            href: `/dashboard/${currentGuildId}/leaderboard`,
            icon: Trophy,
          },
          {
            label: 'My joins',
            href: `/dashboard/${currentGuildId}/joins`,
            icon: Users,
            chevron: (
              <span
                role="button"
                tabIndex={0}
                aria-label="Toggle recruit hub"
                onClick={(e) => {
                  e.stopPropagation();
                  setMyJoinsExpanded((prev) => !prev);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setMyJoinsExpanded((prev) => !prev);
                  }
                }}
                className="size-5 rounded flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <ChevronDown className={cn('size-3.5 transition-transform duration-150', !myJoinsExpanded && '-rotate-90')} />
              </span>
            ),
          },
          ...(myJoinsExpanded
            ? [
                {
                  label: 'Recruit hub',
                  href: `/dashboard/${currentGuildId}/recruits`,
                  icon: UserPlus,
                  isChild: true,
                },
              ]
            : []),
          {
            label: 'Partnerships',
            href: `/dashboard/${currentGuildId}/partnerships`,
            icon: Handshake,
            badge:
              pendingRequestsCount > 0 ? (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-none tabular-nums shrink-0 select-none font-sans',
                    'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] shadow-[0_0_8px_var(--accent)]',
                    pendingRequestsCount > 9
                      ? 'min-w-[22px] h-[18px] px-1.5'
                      : 'size-[18px] aspect-square'
                  )}
                >
                  {pendingRequestsCount}
                </span>
              ) : null,
          },
        ],
      },
      {
        label: 'System',
        items: [
          {
            label: 'System status',
            href: `/dashboard/${currentGuildId}/uptime`,
            icon: Activity,
          },
          {
            label: 'Changelog',
            href: `/dashboard/${currentGuildId}/changelog`,
            icon: GitBranch,
          },
          {
            label: 'Settings',
            href: `/dashboard/${currentGuildId}/settings`,
            icon: Settings,
          },
        ],
      },
    ];
  }, [currentGuildId, canBump, pendingRequestsCount, myJoinsExpanded, isRecruiter]);

  const isItemActive = (item: NavigationItem) => {
    if (item.href.includes('?')) {
      return currentPath === item.href;
    }
    if (item.exact) {
      return location.pathname === item.href && !location.search;
    }
    const target = activeHref || location.pathname;
    return target === item.href || location.pathname === item.href;
  };

  const handleNavClick = (href: string) => {
    navigate(href);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const showServerSearch = Boolean(workspaces && workspaces.length > 8);

  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    if (!showServerSearch || !searchServerQuery.trim()) return workspaces;
    const q = searchServerQuery.toLowerCase().trim();
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(q));
  }, [workspaces, showServerSearch, searchServerQuery]);

  return (
    <TooltipProvider delay={150}>
      <Sidebar
        collapsible="icon"
        side={side}
        sheetTitle={currentWorkspace?.name || 'ConnectingERLC navigation'}
        className="bg-[#09090B] border-r border-[var(--border)] text-[#A1A1AA] transition-[width] duration-200 ease-in-out select-none"
      >
        {/* Blurred Banner Backdrop behind top 120px of sidebar */}
        {!collapsed && serverBannerUrl && (
          <div
            className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none overflow-hidden z-0"
            style={{
              maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
            }}
          >
            <img
              src={serverBannerUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{
                filter: 'blur(18px) saturate(1.1)',
                transform: 'scale(1.15)',
                opacity: 0.35,
              }}
            />
          </div>
        )}

        {/* ── HEADER: SERVER CARD + SEARCH ─────────────────────────────── */}
        <SidebarHeader className="relative z-10 p-4 pb-0 space-y-0 bg-transparent border-0 shadow-none outline-none shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] bg-transparent border-0 shadow-none',
                collapsed
                  ? 'mx-auto size-11 flex items-center justify-center rounded-[12px] hover:bg-[#141417]'
                  : 'w-full h-[72px] flex items-center justify-between gap-3 text-left group'
              )}
            >
              {collapsed ? (
                <ServerAvatar
                  name={currentWorkspace?.name}
                  iconUrl={
                    currentWorkspace?.iconUrl ||
                    (currentWorkspace?.id ? localStorage.getItem(`server_icon_${currentWorkspace.id}`) : null)
                  }
                  size="lg"
                  className="size-9 rounded-[10px]"
                />
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <ServerAvatar
                      name={currentWorkspace?.name}
                      iconUrl={
                        currentWorkspace?.iconUrl ||
                        (currentWorkspace?.id ? localStorage.getItem(`server_icon_${currentWorkspace.id}`) : null)
                      }
                      size="lg"
                      className="size-10 rounded-[12px] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] leading-snug font-semibold text-[#F4F4F5] tracking-normal font-sans">
                        {currentWorkspace?.name || 'Select server'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="size-2 rounded-full bg-[var(--accent)] shrink-0" />
                        <span className="text-[12px] leading-none text-[#A1A1AA] font-normal tabular-nums truncate font-sans">
                          {realMemberCount.toLocaleString()} {realMemberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="size-7 rounded-[6px] flex items-center justify-center text-[#71717A] group-hover:text-[#F4F4F5] hover:bg-white/[0.06] transition-colors shrink-0">
                    <ChevronDown className="size-4" />
                  </div>
                </>
              )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              side={collapsed ? 'right' : 'bottom'}
              sideOffset={8}
              className="z-50 w-64 rounded-[16px] p-1.5 border border-[var(--border-strong)] bg-[#0E0E11] text-[#F4F4F5] shadow-2xl backdrop-blur-md"
            >
              {showServerSearch && (
                <div className="px-1.5 py-1">
                  <input
                    type="text"
                    value={searchServerQuery}
                    onChange={(e) => setSearchServerQuery(e.target.value)}
                    placeholder="Filter servers…"
                    className="w-full h-8 rounded-[8px] border border-[var(--border)] bg-[#141417] px-2.5 text-xs text-[#F4F4F5] placeholder:text-[#71717A] focus-visible:outline-none focus-visible:border-[var(--accent)]"
                  />
                </div>
              )}

              <DropdownMenuGroup className="max-h-64 overflow-y-auto space-y-0.5">
                <DropdownMenuLabel className="px-2.5 py-1 text-xs font-medium text-[#71717A]">
                  Your servers
                </DropdownMenuLabel>
                {!filteredWorkspaces || filteredWorkspaces.length === 0 ? (
                  <div className="px-2.5 py-3 text-xs text-[#71717A]">
                    No servers found
                  </div>
                ) : (
                  filteredWorkspaces.map((ws) => {
                    const isSelected = ws.id === currentWorkspace?.id;
                    const wsIconUrl =
                      ws.iconUrl ||
                      (ws.id ? localStorage.getItem(`server_icon_${ws.id}`) : null);
                    return (
                      <DropdownMenuItem
                        key={ws.id}
                        onClick={() => {
                          onWorkspaceChange?.(ws.id);
                          if (isMobile) setOpenMobile(false);
                        }}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 cursor-pointer text-[13px] transition-colors',
                          isSelected
                            ? 'bg-[#141417] text-[#F4F4F5] font-medium'
                            : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D]'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ServerAvatar name={ws.name} iconUrl={wsIconUrl} size="sm" />
                          <span className="truncate">{ws.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="size-4 text-[var(--accent)] shrink-0" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                )}
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />
              <DropdownMenuItem
                onClick={() => handleNavClick('/servers')}
                className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
              >
                <Server className="size-4 text-[#71717A]" />
                <span>All servers</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Box: 36px tall, radius 10px, 1px border at 7%, transparent background, 12px under header */}
          {!collapsed ? (
            <button
              type="button"
              onClick={() => {
                onSearch?.();
                if (isMobile) setOpenMobile(false);
              }}
              className="w-full h-9 mt-3 flex items-center justify-between rounded-[10px] border border-white/[0.07] bg-transparent hover:bg-[#141417] px-3 text-[13px] text-[#71717A] hover:text-[#F4F4F5] transition-colors duration-120 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Search className="size-4 text-[#71717A]" />
                <span className="text-[13px] font-normal text-[#A1A1AA] font-sans">Search</span>
              </span>
              <kbd className="inline-flex items-center gap-0.5 rounded-[6px] border border-white/[0.07] bg-[#141417] px-1.5 py-0.5 text-[11px] font-mono text-[#71717A]">
                <span className="text-[10px]">Ctrl</span> K
              </kbd>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSearch?.()}
                  aria-label="Search (Ctrl K)"
                  className="mx-auto size-11 flex items-center justify-center rounded-[12px] text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#19191D] transition-colors duration-120 cursor-pointer"
                >
                  <Search className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (Ctrl K)</TooltipContent>
            </Tooltip>
          )}
        </SidebarHeader>

        {/* ── NAVIGATION CONTENT ─────────────────────────────────────── */}
        <SidebarContent className="relative z-10 px-3 pt-5 pb-2 bg-transparent flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {navigationGroups.map((group, groupIndex) => {
            const isOverviewGroup = groupIndex === 0;

            return (
              <div
                key={group.label || `group-${groupIndex}`}
                className={cn(
                  'space-y-1',
                  isOverviewGroup ? 'mt-0' : 'mt-7'
                )}
              >
                {group.label && (
                  collapsed ? (
                    <div className="my-3 border-t border-[var(--border)] w-8 mx-auto" />
                  ) : (
                    <div className="px-3 mb-2 text-[12px] font-medium text-[#71717A] select-none font-sans">
                      {group.label}
                    </div>
                  )
                )}

                <div className={cn('space-y-1', collapsed && 'space-y-2 flex flex-col items-center')}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);

                    if (collapsed) {
                      /* Collapsed item: 44px square button with tooltip */
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-current={active ? 'page' : undefined}
                              onClick={() => handleNavClick(item.href)}
                              className={cn(
                                'relative size-11 flex items-center justify-center rounded-[12px] transition-colors duration-120 cursor-pointer',
                                active
                                  ? 'bg-[#141417] text-[var(--accent)] border border-[rgba(255,255,255,0.07)]'
                                  : 'text-[#71717A] hover:bg-[#19191D] hover:text-[#F4F4F5]'
                              )}
                            >
                              <Icon className="size-[18px]" strokeWidth={1.75} />
                              {item.badge && (
                                <span className="absolute top-2 right-2 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[#09090B]" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-[#0E0E11] text-[#F4F4F5] border-[var(--border)] text-xs">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    if (item.isChild) {
                      /* Child item: indented 16px, 1px vertical connector line on left, 32px row, 13px label, smaller icon */
                      return (
                        <div key={item.href} className="relative pl-4">
                          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-[var(--border)]" />
                          <button
                            type="button"
                            aria-current={active ? 'page' : undefined}
                            onClick={() => handleNavClick(item.href)}
                            className={cn(
                              'w-full h-8 flex items-center justify-between gap-2 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors duration-120 cursor-pointer select-none',
                              active
                                ? 'bg-[#141417] text-[#F4F4F5] border border-[rgba(255,255,255,0.07)]'
                                : 'text-[#71717A] hover:bg-[#19191D] hover:text-[#F4F4F5]'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon
                                className={cn(
                                  'size-3.5 shrink-0 transition-colors',
                                  active ? 'text-[var(--accent)]' : 'text-[#71717A]'
                                )}
                                strokeWidth={1.75}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge}
                          {item.chevron}
                        </div>
                          </button>
                        </div>
                      );
                    }

                    /* Expanded item: 36px row, radius 10px, 12px padding, 10px gap */
                    return (
                      <button
                        key={item.href}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => handleNavClick(item.href)}
                        className={cn(
                          'w-full h-9 flex items-center justify-between gap-2.5 rounded-[10px] px-3 text-[14px] font-medium transition-colors duration-120 cursor-pointer select-none',
                          active
                            ? 'bg-[#141417] text-[#F4F4F5] border border-[rgba(255,255,255,0.07)]'
                            : 'text-[#71717A] hover:bg-[#19191D] hover:text-[#F4F4F5]'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              'size-[18px] shrink-0 transition-colors',
                              active ? 'text-[var(--accent)]' : 'text-[#71717A]'
                            )}
                            strokeWidth={1.75}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge}
                          {item.chevron}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </SidebarContent>

        {/* ── FOOTER: USER MENU ONLY (Bump card deleted) ────────────────── */}
        <SidebarFooter className="p-3 pt-2 border-t border-[var(--border)] bg-[#09090B] shrink-0 mt-auto">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'transition-all duration-120 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
                  collapsed
                    ? 'mx-auto size-11 flex items-center justify-center rounded-[12px] hover:bg-[#141417]'
                    : 'group w-full flex items-center justify-between gap-2.5 rounded-[12px] p-2 hover:bg-[#141417] text-left'
                )}
              >
                {collapsed ? (
                  <div className="relative">
                    <UserAvatar
                      avatarUrl={user.avatarUrl}
                      name={user.name}
                      size={36}
                      className="border border-[var(--border)]"
                    />
                    <span className="size-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[#09090B] absolute bottom-0 right-0" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          avatarUrl={user.avatarUrl}
                          name={user.name}
                          size={36}
                          className="border border-[var(--border)]"
                        />
                        <span className="size-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[#09090B] absolute bottom-0 right-0" />
                      </div>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-[14px] leading-snug font-medium text-[#F4F4F5] truncate">
                          {user.name}
                        </span>
                        <span className="text-[13px] leading-tight text-[#71717A] truncate">
                          {user.handle ||
                            (user.username ? `@${user.username}` : `@${user.name.toLowerCase().replace(/\s+/g, '')}`)}
                        </span>
                      </div>
                    </div>

                    <div className="size-6 rounded-[6px] flex items-center justify-center text-[#71717A] group-hover:text-[#F4F4F5] transition-colors shrink-0">
                      <MoreHorizontal className="size-4" />
                    </div>
                  </>
                )}
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side={collapsed ? 'right' : 'top'}
                align="start"
                sideOffset={8}
                className="w-[260px] p-1.5 z-50 rounded-[16px] border border-[var(--border-strong)] bg-[#0E0E11] text-[#F4F4F5] shadow-2xl backdrop-blur-md"
              >
                {/* 1. Header: Avatar 40px, Name, Handle, Role Badge */}
                <DropdownMenuLabel className="px-2.5 py-2 font-normal">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        userId={user.id}
                        avatarUrl={user.avatarUrl}
                        name={user.name}
                        size={40}
                        className="size-10 rounded-full shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-[14px] leading-snug font-semibold block truncate text-[#F4F4F5]">
                          {user.name}
                        </span>
                        <span className="text-[12px] leading-tight text-[#71717A] block truncate">
                          {user.handle ||
                            (user.username ? `@${user.username}` : `@${user.name.toLowerCase().replace(/\s+/g, '')}`)}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-[#141417] text-[#A1A1AA] border-white/10">
                      Owner
                    </Badge>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />

                {/* 2. Menu group: Account, Credit history, Bot setup */}
                <DropdownMenuItem
                  onClick={() => handleNavClick(`/dashboard/${currentGuildId}/settings`)}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <UserRound className="size-4 text-[#71717A]" />
                  <span className="flex-1">Account</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleNavClick(`/dashboard/${currentGuildId}/history`)}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <Receipt className="size-4 text-[#71717A]" />
                  <span className="flex-1">Credit history</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleNavClick(`/dashboard/${currentGuildId}/bot`)}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <Bot className="size-4 text-[#71717A]" />
                  <span className="flex-1">Bot setup</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />

                {/* 3. Group: Docs, Support, Changelog */}
                <DropdownMenuItem
                  onClick={() => handleNavClick('/docs')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <BookOpen className="size-4 text-[#71717A]" />
                  <span className="flex-1">Docs</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open('https://discord.gg/mavely', '_blank', 'noopener,noreferrer')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <HelpCircle className="size-4 text-[#71717A]" />
                  <span className="flex-1">Support</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleNavClick(`/dashboard/${currentGuildId}/changelog`)}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <GitBranch className="size-4 text-[#71717A]" />
                  <span className="flex-1">Changelog</span>
                </DropdownMenuItem>



                {/* 5. Sign out */}
                {onSignOut && (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />
                    <DropdownMenuItem
                      onClick={onSignOut}
                      className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#F87171] hover:text-[#F87171] hover:bg-[#F87171]/10 cursor-pointer"
                    >
                      <LogOut className="size-4 text-[#F87171]" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}

export { DashboardSidebar as AppShellSidebar };
