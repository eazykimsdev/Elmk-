import * as React from "react"
import { useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"
import { DashboardShell } from "@/components/ui/dashboard-shell"
import { type Notification } from "@/components/ui/notification-center"
import { breadcrumbsFor, findNavItem, type NavConfig } from "@/lib/nav-config"
import { useNavOverride } from "@/components/ui/app-shell/nav-override"

import { AppShellHeader } from "./header"
import { AppShellSidebar } from "./sidebar"

export type AppShellUser = {
  id?: string
  name: string
  email: string
  avatarUrl?: string
  initials?: string
  username?: string
  handle?: string
}

export type AppShellWorkspace = {
  id: string
  name: string
  initial: string
  plan?: string
  iconUrl?: string | null
  memberCount?: number
}

export type AppShellNotification = {
  id: string
  title: string
  description?: string
  at: Date
  read?: boolean
  href?: string
  type?: any
  avatar?: string | { name: string; src?: string }
}

export type AppShellContextValue = {
  nav: NavConfig
  user: AppShellUser
  workspace?: AppShellWorkspace
}

const AppShellContext = React.createContext<AppShellContextValue | null>(null)

function useAppShell(): AppShellContextValue {
  const context = React.useContext(AppShellContext)
  if (!context) {
    throw new Error("useAppShell must be called inside an <AppShell>.")
  }
  return context
}

const NO_NOTIFICATIONS: AppShellNotification[] = []

export type AppShellProps = React.ComponentProps<"div"> & {
  nav: NavConfig
  user: AppShellUser
  workspaces?: { current: string; items: AppShellWorkspace[] }
  onWorkspaceChange?: (id: string) => void
  notifications?: AppShellNotification[]
  now?: Date
  actions?: React.ReactNode
  activeHref?: string
  breadcrumbs?: { title: string; href: string }[]
  showLastCrumb?: boolean
  onSignOut?: () => void
  defaultOpen?: boolean
  density?: "comfortable" | "compact"
  children: React.ReactNode
}

function directionOf(element: HTMLElement): "ltr" | "rtl" {
  const attribute = element.closest("[dir]")?.getAttribute("dir")?.toLowerCase()
  if (attribute === "rtl" || attribute === "ltr") return attribute
  return getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr"
}

function AppShell({
  className,
  nav: ownNav,
  user,
  workspaces,
  onWorkspaceChange,
  notifications = NO_NOTIFICATIONS,
  now,
  actions,
  activeHref,
  breadcrumbs,
  showLastCrumb = true,
  onSignOut,
  defaultOpen,
  density,
  children,
  dir,
  ...props
}: AppShellProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const [pageDirection, setPageDirection] = React.useState<"ltr" | "rtl">("ltr")
  React.useLayoutEffect(() => {
    if (root.current) setPageDirection(directionOf(root.current))
  }, [])
  const side = (dir === "rtl" || dir === "ltr" ? dir : pageDirection) === "rtl" ? "right" : "left"

  const override = useNavOverride()
  const nav = override?.nav ?? ownNav
  const pathname = useLocation().pathname
  const route = override?.activeHref ?? activeHref ?? pathname

  const [workspaceId, setWorkspaceId] = React.useState(workspaces?.current)
  const [lastCurrent, setLastCurrent] = React.useState(workspaces?.current)
  if (workspaces?.current !== lastCurrent) {
    setLastCurrent(workspaces?.current)
    setWorkspaceId(workspaces?.current)
  }

  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [readIds, setReadIds] = React.useState<string[]>([])
  const [lastNotifications, setLastNotifications] = React.useState(notifications)
  if (notifications !== lastNotifications) {
    setLastNotifications(notifications)
    setReadIds([])
  }

  const active = React.useMemo(() => findNavItem(nav, route), [nav, route])
  const trail = React.useMemo(() => {
    if (breadcrumbs) return breadcrumbs
    const full = breadcrumbsFor(nav, route)
    if (full.length === 1) {
      return [...full, { title: "Overview", href: full[0].href }]
    }
    return showLastCrumb ? full : full.slice(0, -1)
  }, [breadcrumbs, nav, route, showLastCrumb])

  const trailEndsAtPage = true

  const workspace = workspaces?.items.find((item) => item.id === workspaceId)
  const context = React.useMemo<AppShellContextValue>(
    () => ({ nav, user, workspace }),
    [nav, user, workspace]
  )

  const rows = React.useMemo<Notification[]>(
    () =>
      notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        description: notification.description,
        time: notification.at,
        read: notification.read === true || readIds.includes(notification.id),
        type: notification.type as any,
        avatar: notification.avatar
          ? typeof notification.avatar === 'string'
            ? { name: notification.title, src: notification.avatar }
            : notification.avatar
          : undefined,
        href: notification.href,
      })),
    [notifications, readIds]
  )

  return (
    <AppShellContext.Provider value={context}>
      <div
        ref={root}
        data-slot="app-shell"
        data-density={density}
        dir={dir}
        className={cn(
          "flex min-h-svh w-full flex-col bg-[var(--background)] text-[var(--foreground)] [&_[data-slot=sidebar-inset]]:min-w-0 [&_[data-slot=sidebar-inset]]:bg-[var(--background)]",
          className
        )}
        {...props}
      >
        <DashboardShell
          defaultOpen={defaultOpen}
          className="min-h-0 flex-1"
          contentClassName="min-h-0 p-0 md:p-0 space-y-0"
          sidebar={
            <AppShellSidebar
              side={side}
              nav={nav}
              activeHref={active?.href || route}
              onSearch={() => setPaletteOpen(true)}
              workspaces={workspaces?.items}
              workspaceId={workspaceId}
              onWorkspaceChange={(id) => {
                setWorkspaceId(id)
                onWorkspaceChange?.(id)
              }}
              user={user}
              onSignOut={onSignOut}
            />
          }
          header={
            <AppShellHeader
              nav={nav}
              paletteOpen={paletteOpen}
              onPaletteOpenChange={setPaletteOpen}
              breadcrumbs={trail}
              user={user}
              notifications={rows}
              now={now}
              actions={actions}
              onSignOut={onSignOut}
              lastCrumbIsPage={trailEndsAtPage}
              onMarkRead={(id) =>
                setReadIds((current) => (current.includes(id) ? current : [...current, id]))
              }
              onMarkAllRead={() => setReadIds(notifications.map((n) => n.id))}
            />
          }
        >
          {children}
        </DashboardShell>
      </div>
    </AppShellContext.Provider>
  )
}

export { AppShell, AppShellContext, AppShellHeader, AppShellSidebar, useAppShell }
