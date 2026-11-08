import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Compass,
  Trophy,
  Handshake,
  Sparkles,
  LayoutDashboard,
  BookOpen,
  Activity,
  LifeBuoy,
  Search,
  LogIn,
  LogOut,
  Settings,
  Shield,
  Menu,
  X,
  Receipt,
  Bot,
  HelpCircle,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { SearchModal } from '@/components/ui/search-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const SUPPORT_INVITE_URL = 'https://discord.gg/central';

export function PublicIconRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetch('/api/admin/check')
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          if (data && data.isAdmin) setIsAdmin(true);
          else setIsAdmin(false);
        })
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [user?.id]);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItemClass = (active: boolean) =>
    cn(
      'relative flex items-center justify-center size-10 rounded-xl transition-all duration-150 outline-hidden',
      active
        ? 'bg-[#18181B] text-[var(--accent)] shadow-xs ring-1 ring-white/10'
        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
    );

  return (
    <TooltipProvider delay={150}>
      {/* ── DESKTOP VERTICAL ICON RAIL (>=768px, 64px width) ── */}
      <aside
        aria-label="Public Navigation Rail"
        className="hidden md:flex fixed top-0 left-0 bottom-0 w-16 bg-[#09090B] border-r border-white/[0.06] flex-col items-center justify-between py-3.5 z-40 select-none font-sans"
      >
        {/* Pinned to Top: Clean CE logo with divider line under it */}
        <div className="shrink-0 w-full flex flex-col items-center pb-3 border-b border-white/[0.06]">
          <Tooltip>
            <TooltipTrigger render={<Link to="/" aria-label="ConnectingERLC Home" className="flex items-center justify-center size-11 rounded-xl transition-all hover:opacity-80 active:scale-95" />}>
              <img
                src="/brand/logo.png"
                alt="CE"
                className="size-[38px] object-contain pointer-events-none"
              />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white font-medium">
              ConnectingERLC Home
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Pinned to Middle: Navigation icon groups */}
        <div className="flex flex-col items-center gap-2.5 my-auto">
          {/* Group 1: Core Navigation */}
          <div className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger render={<Link to="/" aria-label="Home" className={navItemClass(isActive('/'))} />}>
                <Home className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Home
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Link to="/directory" aria-label="Directory" className={navItemClass(isActive('/directory'))} />}>
                <Compass className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Directory
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Link to="/leaderboard" aria-label="Leaderboard" className={navItemClass(isActive('/leaderboard'))} />}>
                <Trophy className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Leaderboard
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Separator */}
          <div className="w-6 h-[1px] bg-white/[0.08] my-0.5" />

          {/* Group 2: Growth Tools */}
          <div className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger render={<Link to="/dashboard?tab=partnerships" aria-label="Partnerships" className={navItemClass(location.pathname === '/dashboard' && location.search.includes('tab=partnerships'))} />}>
                <Handshake className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Partnerships
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Link to="/dashboard?tab=recruits" aria-label="Recruiting" className={navItemClass(location.pathname === '/dashboard' && location.search.includes('tab=recruits'))} />}>
                <Sparkles className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Recruiting
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Separator */}
          <div className="w-6 h-[1px] bg-white/[0.08] my-0.5" />

          {/* Group 3: Utility, Docs & Search */}
          <div className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger render={<Link to="/dashboard" aria-label="Dashboard" className={navItemClass(location.pathname === '/dashboard' && !location.search.includes('tab='))} />}>
                <LayoutDashboard className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Dashboard
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Link to="/docs" aria-label="Documentation" className={navItemClass(isActive('/docs'))} />}>
                <BookOpen className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Docs
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Link to="/status" aria-label="System Status" className={navItemClass(isActive('/status'))} />}>
                <Activity className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Status
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<button type="button" onClick={() => setSearchOpen(true)} aria-label="Search communities (Ctrl+K)" className={navItemClass(false)}>
                <Search className="size-4.5 stroke-[2]" />
              </button>}>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Search <span className="text-[10px] text-zinc-400 ml-1">Ctrl+K</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<a href={SUPPORT_INVITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Support Discord" className={navItemClass(false)} />}>
                <LifeBuoy className="size-4.5 stroke-[2]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white">
                Support Community
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Pinned to Bottom: User Avatar Only (No search on top of icon) */}
        <div className="flex flex-col items-center shrink-0 pt-3 border-t border-white/[0.06] w-full px-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-hidden ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer">
                <div className="relative">
                  <UserAvatar
                    userId={user.id}
                    avatarHash={user.avatar}
                    name={user.global_name || user.username}
                    size={38}
                    className="size-[38px] rounded-full border border-white/10 hover:border-white/30 transition-all"
                  />
                  <span className="size-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[#09090B] absolute bottom-0 right-0" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                sideOffset={14}
                className="w-[260px] p-1.5 z-50 rounded-[16px] border border-white/[0.08] bg-[#0E0E11] text-[#F4F4F5] shadow-2xl backdrop-blur-md font-sans"
              >
                {/* 1. Header: Avatar 40px, Name, Handle, Role Badge */}
                <div className="px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        userId={user.id}
                        avatarHash={user.avatar}
                        name={user.global_name || user.username}
                        size={40}
                        className="size-10 rounded-full shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-[14px] leading-snug font-semibold block truncate text-[#F4F4F5]">
                          {user.global_name || user.username}
                        </span>
                        <span className="text-[12px] leading-tight text-[#71717A] block truncate">
                          @{user.username}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-[#141417] text-[#A1A1AA] border-white/10">
                      {isAdmin ? 'Admin' : 'Owner'}
                    </Badge>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />

                {/* 2. Navigation items: Home, Dashboard, Credit history, Bot setup */}
                <DropdownMenuItem
                  onClick={() => navigate('/')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <Home className="size-4 text-[#71717A]" />
                  <span className="flex-1">Home</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/dashboard')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <LayoutDashboard className="size-4 text-[#71717A]" />
                  <span className="flex-1">Dashboard</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/dashboard?tab=history')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <Receipt className="size-4 text-[#71717A]" />
                  <span className="flex-1">Credit history</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/dashboard?tab=bot')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <Bot className="size-4 text-[#71717A]" />
                  <span className="flex-1">Bot setup</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />

                {/* 3. Resources: Docs, Support, Changelog */}
                <DropdownMenuItem
                  onClick={() => navigate('/docs')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <BookOpen className="size-4 text-[#71717A]" />
                  <span className="flex-1">Docs</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open(SUPPORT_INVITE_URL, '_blank', 'noopener,noreferrer')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <HelpCircle className="size-4 text-[#71717A]" />
                  <span className="flex-1">Support</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/changelog')}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#19191D] cursor-pointer"
                >
                  <GitBranch className="size-4 text-[#71717A]" />
                  <span className="flex-1">Changelog</span>
                </DropdownMenuItem>

                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={() => navigate('/admin-portal')}
                      className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <Shield className="size-4 text-amber-400" />
                      <span className="flex-1">Admin Portal</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />

                {/* 4. Sign out */}
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="h-9 flex items-center gap-2.5 px-2.5 rounded-[8px] text-[14px] text-[#F87171] hover:text-[#F87171] hover:bg-[#F87171]/10 cursor-pointer"
                >
                  <LogOut className="size-4 text-[#F87171]" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger render={<Link to="/login" aria-label="Sign in with Discord" className="flex items-center justify-center size-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold transition-all shadow-xs" />}>
                <LogIn className="size-5 stroke-[2.5]" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs bg-[#121215] border-white/10 text-white font-medium">
                Sign in with Discord
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* ── MOBILE STICKY BOTTOM BAR (<768px, 56px height) ── */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#09090B]/95 backdrop-blur-md border-t border-white/[0.08] flex items-center justify-around px-3 z-40 select-none font-sans"
      >
        <Link
          to="/"
          aria-label="Home"
          className={cn(
            'flex flex-col items-center justify-center p-1.5 rounded-lg text-xs',
            isActive('/') ? 'text-[var(--accent)]' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <Home className="size-5" />
          <span className="text-[10px] mt-0.5">Home</span>
        </Link>

        <Link
          to="/directory"
          aria-label="Directory"
          className={cn(
            'flex flex-col items-center justify-center p-1.5 rounded-lg text-xs',
            isActive('/directory') ? 'text-[var(--accent)]' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <Compass className="size-5" />
          <span className="text-[10px] mt-0.5">Directory</span>
        </Link>

        <Link
          to="/dashboard"
          aria-label="Dashboard"
          className={cn(
            'flex flex-col items-center justify-center p-1.5 rounded-lg text-xs',
            location.pathname.startsWith('/dashboard') ? 'text-[var(--accent)]' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          <LayoutDashboard className="size-5" />
          <span className="text-[10px] mt-0.5">Dashboard</span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="flex flex-col items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs"
        >
          <Search className="size-5" />
          <span className="text-[10px] mt-0.5">Search</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="More Menu"
          className="flex flex-col items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs"
        >
          {user ? (
            <UserAvatar
              userId={user.id}
              avatarHash={user.avatar}
              name={user.global_name || user.username}
              size={20}
              className="size-5 rounded-full"
            />
          ) : (
            <Menu className="size-5" />
          )}
          <span className="text-[10px] mt-0.5">{user ? 'Account' : 'More'}</span>
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative bg-[#121215] border-t border-white/[0.08] rounded-t-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              {user ? (
                <div className="flex items-center gap-3">
                  <UserAvatar
                    userId={user.id}
                    avatarHash={user.avatar}
                    name={user.global_name || user.username}
                    size={36}
                    className="size-9 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{user.global_name || user.username}</p>
                    <p className="text-xs font-mono text-zinc-400">@{user.username}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-semibold text-white">Menu & Navigation</div>
              )}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="size-8 rounded-lg bg-white/[0.04] text-zinc-400 flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1">
              <Link
                to="/leaderboard"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                <Trophy className="size-4 text-[var(--accent)]" />
                <span>Leaderboard</span>
              </Link>
              <Link
                to="/dashboard?tab=partnerships"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                <Handshake className="size-4 text-[var(--accent)]" />
                <span>Partnerships</span>
              </Link>
              <Link
                to="/dashboard?tab=recruits"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                <Sparkles className="size-4 text-[var(--accent)]" />
                <span>Recruiting</span>
              </Link>
              <Link
                to="/docs"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                <BookOpen className="size-4 text-zinc-400" />
                <span>Documentation</span>
              </Link>
              <Link
                to="/status"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                <Activity className="size-4 text-zinc-400" />
                <span>System Status</span>
              </Link>
              <a
                href={SUPPORT_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                <LifeBuoy className="size-4 text-zinc-400" />
                <span>Support Community</span>
              </a>
            </div>

            {isAdmin && (
              <div className="pt-2 border-t border-white/[0.06]">
                <Link
                  to="/admin-portal"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-300 hover:bg-amber-500/10"
                >
                  <Shield className="size-4 text-amber-400" />
                  <span>Admin Portal</span>
                </Link>
              </div>
            )}

            <div className="pt-2 border-t border-white/[0.06]">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10"
                >
                  <LogOut className="size-4" />
                  <span>Sign out</span>
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold text-sm shadow-xs"
                >
                  <LogIn className="size-4 stroke-[2.5]" />
                  <span>Sign in with Discord</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Search Palette Modal */}
      <SearchModal modal={true} open={searchOpen} onOpenChange={setSearchOpen} />
    </TooltipProvider>
  );
}

export default PublicIconRail;

