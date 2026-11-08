import * as React from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  SearchIcon,
  Coins,
  BookOpen,
  MessageCircle,
  Server,
  Settings,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommandPalette, type CommandGroup, type CommandItem } from "@/components/ui/command-palette"
import { HeaderBar } from "@/components/ui/header-bar"
import {
  NotificationCenter,
  type Notification,
} from "@/components/ui/notification-center"
import { flattenNav, type NavConfig } from "@/lib/nav-config"

import { useNavOverride } from "./nav-override"
import type { AppShellUser } from "./index"
import { navIcon } from "./icons"

export const SEARCH_HOTKEY = "mod+k"

export type AppShellHeaderProps = {
  nav: NavConfig
  paletteOpen: boolean
  onPaletteOpenChange: (open: boolean) => void
  breadcrumbs: { title: string; href: string }[]
  user: AppShellUser
  notifications: Notification[]
  now?: Date
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  actions?: React.ReactNode
  onSignOut?: () => void
  lastCrumbIsPage?: boolean
}

function AppShellHeader({
  nav,
  paletteOpen,
  onPaletteOpenChange,
  breadcrumbs,
  user: _user,
  notifications,
  now,
  onMarkRead,
  onMarkAllRead,
  actions,
  onSignOut: _onSignOut,
  lastCrumbIsPage = true,
}: AppShellHeaderProps) {
  const override = useNavOverride()
  const framed = override !== null
  const renderLink = React.useCallback(
    (href: string, props: React.ComponentProps<"a">) => (
      <Link to={href} {...(props as any)} />
    ),
    []
  )
  const navigate = useNavigate()
  const location = useLocation()
  const router = React.useMemo(() => ({ push: (href: string) => navigate(href) }), [navigate])

  const currentGuildId = React.useMemo(() => {
    const match = location.pathname.match(/\/dashboard\/([^/]+)/)
    return match?.[1] || "1530147023754367006"
  }, [location.pathname])

  const go = React.useCallback(
    (href: string) => {
      if (override?.navigate) override.navigate(href)
      else if (!framed) router.push(href)
    },
    [override, framed, router]
  )

  const [directoryServers, setDirectoryServers] = React.useState<{ id: string; name: string; category?: string }[]>([])

  React.useEffect(() => {
    fetch("/api/directory")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.servers)) {
          setDirectoryServers(
            data.servers.slice(0, 20).map((s: any) => ({
              id: String(s.id),
              name: String(s.name || "Server"),
              category: s.category ? String(s.category) : undefined,
            }))
          )
        }
      })
      .catch(() => {})
  }, [])

  const commandGroups = React.useMemo<CommandGroup[]>(() => {
    const pageItems: CommandItem[] = flattenNav(nav).map((item) => {
      const Icon = navIcon(item.icon)
      return {
        id: item.href,
        label: item.title,
        icon: Icon ? <Icon /> : undefined,
        keywords: [item.href, item.title],
        onSelect: () => go(item.href),
      }
    })

    const settingItems: CommandItem[] = [
      {
        id: "cmd-your-servers",
        label: "Switch server (Your servers)",
        icon: <Server />,
        keywords: ["servers", "switch", "guilds"],
        onSelect: () => go("/servers"),
      },
      {
        id: "cmd-credit-history",
        label: "Credit history & ledger",
        icon: <Coins />,
        keywords: ["credits", "ledger", "balance", "history"],
        onSelect: () => go(`/dashboard/${currentGuildId}/history`),
      },
      {
        id: "cmd-settings",
        label: "Server settings & notifications",
        icon: <Settings />,
        keywords: ["settings", "preferences", "webhooks", "api"],
        onSelect: () => go(`/dashboard/${currentGuildId}/settings`),
      },
      {
        id: "cmd-docs",
        label: "Documentation",
        icon: <BookOpen />,
        keywords: ["docs", "help", "guide"],
        onSelect: () => go("/docs"),
      },
    ]

    const groups: CommandGroup[] = [
      { heading: "Pages", items: pageItems },
      { heading: "Settings & tools", items: settingItems },
    ]

    if (directoryServers.length > 0) {
      groups.push({
        heading: "Servers in directory",
        items: directoryServers.map((srv) => ({
          id: `dir-${srv.id}`,
          label: srv.name,
          icon: <Server />,
          keywords: [srv.name, srv.category || "directory"],
          onSelect: () => go(`/dashboard/${currentGuildId}/earn?server=${encodeURIComponent(srv.id)}`),
        })),
      })
    }

    return groups
  }, [nav, go, directoryServers])

  // Single source of truth for user credits from the ledger API (scoped to current server)
  const [balance, setBalance] = React.useState<number>(0)

  React.useEffect(() => {
    const fetchLedgerBalance = () => {
      fetch(`/api/directory/balance?guildId=${encodeURIComponent(currentGuildId)}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.balance === "number") {
            setBalance(data.balance)
            try {
              localStorage.setItem(`erlcus_credits_balance_${currentGuildId}`, String(data.balance))
            } catch {}
          }
        })
        .catch(() => {})
    }

    fetchLedgerBalance()
    window.addEventListener("balance_updated", fetchLedgerBalance)
    window.addEventListener("storage", fetchLedgerBalance)

    return () => {
      window.removeEventListener("balance_updated", fetchLedgerBalance)
      window.removeEventListener("storage", fetchLedgerBalance)
    }
  }, [currentGuildId])

  // Clicking the credits chip opens Credit history
  const handleBalanceClick = React.useCallback(() => {
    const match = window.location.pathname.match(/\/dashboard\/([^/]+)/)
    if (match && match[1]) {
      navigate(`/dashboard/${match[1]}/history`)
    } else {
      navigate("/dashboard")
    }
  }, [navigate])

  return (
    <>
      <HeaderBar
        sticky
        showSidebarTrigger={true}
        lastCrumbIsPage={lastCrumbIsPage}
        breadcrumbs={breadcrumbs.map((crumb) => ({ label: crumb.title, href: crumb.href }))}
        renderLink={renderLink}
        search={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            aria-haspopup="dialog"
            className="md:hidden"
            onClick={() => onPaletteOpenChange(true)}
          >
            <SearchIcon />
          </Button>
        }
        actions={
          <div className="flex items-center gap-2">
            {actions}

            {/* Credits chip: real value from ledger, click opens Credit history */}
            <button
              type="button"
              onClick={handleBalanceClick}
              title="Open credit history"
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--raised)] hover:bg-[var(--hover)] px-2.5 text-xs font-medium text-[var(--foreground)] transition-colors duration-150 cursor-pointer"
            >
              <Coins className="size-3.5 text-[var(--accent)] shrink-0" />
              <span className="tabular-nums font-medium">{balance.toLocaleString()}</span>
              <span className="text-[var(--muted-foreground)] font-normal">credits</span>
            </button>

            {/* Notification bell with real unread count (badge hidden at 0) */}
            <NotificationCenter
              notifications={notifications}
              now={now}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              renderLink={renderLink}
            />
          </div>
        }
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={onPaletteOpenChange}
        hotkey={SEARCH_HOTKEY}
        placeholder="Search pages, servers, or settings…"
        emptyMessage="No matching pages or servers."
        groups={commandGroups}
      />
    </>
  )
}

export { AppShellHeader }
