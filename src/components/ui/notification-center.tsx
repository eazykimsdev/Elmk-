"use client"

import * as React from "react"
import {
  BellIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  CheckCheck
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RelativeTime } from "@/components/ui/relative-time"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getInitials } from "@/lib/format"

export type RenderLink = (href: string, props: React.ComponentProps<"a">) => React.ReactNode

export type NotificationTone = "default" | "success" | "warning" | "danger" | "info"

export type Notification = {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  time: Date | string
  read: boolean
  type?: NotificationTone
  avatar?: { name: string; src?: string }
  href?: string
}

export type NotificationCenterProps = Omit<
  React.ComponentProps<typeof PopoverTrigger>,
  "className" | "render" | "children" | "aria-label"
> & {
  notifications: Notification[]
  onMarkAllRead?: () => void
  onMarkRead?: (id: string) => void
  onClear?: () => void
  onOpenNotification?: (notification: Notification) => void
  trigger?: React.ReactNode
  emptyMessage?: React.ReactNode
  align?: "start" | "end"
  now?: Date
  className?: string
  renderLink?: RenderLink
}

export function unreadCount(notifications: { read: boolean }[]): number {
  return notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0)
}

const TONE_ICON: Record<NotificationTone, React.ComponentType<{ className?: string }>> = {
  default: BellIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  danger: CircleAlertIcon,
  info: InfoIcon,
}

const TONE_CLASS: Record<NotificationTone, string> = {
  default: "bg-white/[0.06] text-zinc-400",
  success: "bg-[var(--accent-soft)] text-[var(--accent)]",
  warning: "bg-amber-500/15 text-amber-400",
  danger: "bg-rose-500/15 text-rose-400",
  info: "bg-cyan-500/15 text-cyan-400",
}

export type NotificationMarkProps = { notification: Notification }

function NotificationMark({ notification }: NotificationMarkProps) {
  if (notification.avatar) {
    return (
      <Avatar size="sm" aria-hidden="true" className="mt-0.5 shrink-0">
        {notification.avatar.src ? <AvatarImage src={notification.avatar.src} alt="" /> : null}
        <AvatarFallback>{getInitials(notification.avatar.name)}</AvatarFallback>
      </Avatar>
    )
  }

  const tone = (notification.type && TONE_ICON[notification.type]) ? notification.type : "default"
  const Icon = TONE_ICON[tone] || BellIcon
  return (
    <span
      data-slot="notification-center-mark"
      data-tone={tone}
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-white/10",
        TONE_CLASS[tone] || TONE_CLASS.default
      )}
    >
      <Icon className="size-3.5 shrink-0" />
    </span>
  )
}

function NotificationCenter({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onClear,
  onOpenNotification,
  trigger,
  emptyMessage = "We'll let you know when something happens.",
  align = "end",
  now,
  className,
  renderLink,
  ...props
}: NotificationCenterProps) {
  const [activeTab, setActiveTab] = React.useState<"all" | "unread">("all")
  const unread = unreadCount(notifications)
  const unreadOnly = notifications.filter((n) => !n.read)
  const displayed = (activeTab === "all" ? notifications : unreadOnly).slice(0, 30)

  function handleOpen(notification: Notification) {
    if (!notification.read) onMarkRead?.(notification.id)
    onOpenNotification?.(notification)
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild {...props}>
          {(trigger as React.ReactElement) ?? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "relative size-8 rounded-[8px] border border-[var(--border)] bg-[var(--raised)] hover:bg-[var(--hover)] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors",
                className
              )}
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <BellIcon className="size-4" />
              {unread > 0 ? (
                <span
                  data-slot="notification-center-count"
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--accent-foreground)] leading-none"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Button>
          )}
        </PopoverTrigger>

        <PopoverContent
          align={align}
          className="w-[380px] max-w-[calc(100vw-2rem)] max-h-[480px] overflow-hidden p-0 border border-[var(--border-strong)] bg-[#0E0E11] shadow-2xl rounded-[14px] flex flex-col font-sans"
        >
          <div className="flex flex-col w-full h-full max-h-[480px]">
            {/* Header: Title + Mark All as Read */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#F4F4F5] font-sans">
                  Notifications
                </span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] bg-[var(--accent)]/15 text-[var(--accent)] rounded-[6px] font-medium">
                    {unread}
                  </span>
                )}
              </div>

              {onMarkAllRead && unread > 0 ? (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-xs text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors font-medium cursor-pointer"
                >
                  Mark all as read
                </button>
              ) : null}
            </div>

            {/* Filter Tabs: All / Unread */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] bg-[#141417] shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "flex-1 text-xs py-1 px-2.5 rounded-[6px] font-medium transition-colors text-center cursor-pointer",
                  activeTab === "all"
                    ? "bg-[#19191D] text-[#F4F4F5] font-semibold border border-[var(--border)]"
                    : "text-[#71717A] hover:text-[#F4F4F5]"
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={cn(
                  "flex-1 text-xs py-1 px-2.5 rounded-[6px] font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5",
                  activeTab === "unread"
                    ? "bg-[#19191D] text-[#F4F4F5] font-semibold border border-[var(--border)]"
                    : "text-[#71717A] hover:text-[#F4F4F5]"
                )}
              >
                <span>Unread</span>
                {unread > 0 && (
                  <span className="text-[10px] px-1 py-0.2 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] font-semibold">
                    {unread}
                  </span>
                )}
              </button>
            </div>

            {/* Notifications List (56px rows, thin dark scrollbar) */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] [scrollbar-width:thin] [scrollbar-color:#2A2A30_transparent]">
              {displayed.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2 text-xs text-[#71717A]">
                  <div className="size-9 rounded-full bg-[#141417] border border-[var(--border)] flex items-center justify-center mx-auto text-[#71717A]">
                    <BellIcon className="size-4 text-[#71717A]" />
                  </div>
                  <p className="font-medium text-[#F4F4F5]">You're all caught up.</p>
                  <p className="text-[12px] text-[#71717A] max-w-[220px] mx-auto leading-relaxed">
                    {emptyMessage}
                  </p>
                </div>
              ) : (
                displayed.map((notification) => {
                  const content = (
                    <div className="flex w-full items-start gap-3">
                      <NotificationMark notification={notification} />
                      <div className="flex min-w-0 flex-1 flex-col justify-start gap-1 text-left">
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate text-[13px] font-medium text-[#F4F4F5] leading-tight">
                            {notification.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <RelativeTime
                              date={notification.time}
                              now={now}
                              className="text-[11px] text-[#71717A] tabular-nums"
                            />
                            {!notification.read && (
                              <span
                                aria-hidden="true"
                                className="size-2 rounded-full bg-[var(--accent)] shrink-0"
                              />
                            )}
                          </div>
                        </div>
                        {notification.description && (
                          <p className="text-[12px] text-[#A1A1AA] line-clamp-2 leading-relaxed">
                            {notification.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )

                  const rowProps = {
                    onClick: () => handleOpen(notification),
                    className: cn(
                      "flex min-h-[56px] w-full items-start px-3.5 py-3 text-start outline-none transition-colors cursor-pointer",
                      !notification.read
                        ? "bg-[#141417]/80 hover:bg-[#19191D]"
                        : "hover:bg-[#141417]/50 opacity-80 hover:opacity-100"
                    ),
                  }

                  if (!notification.href) {
                    return (
                      <button key={notification.id} type="button" {...rowProps}>
                        {content}
                      </button>
                    )
                  }

                  return (
                    <React.Fragment key={notification.id}>
                      {renderLink ? (
                        renderLink(notification.href, { ...rowProps, children: content } as any)
                      ) : (
                        <a href={notification.href} {...rowProps}>
                          {content}
                        </a>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </div>

            {/* Footer: Clear all if present */}
            {onClear && notifications.length > 0 && (
              <div className="p-2 border-t border-[var(--border)] bg-[#0E0E11] flex items-center justify-end text-xs text-[#71717A] px-3 shrink-0">
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

export { NotificationCenter, NotificationMark }
