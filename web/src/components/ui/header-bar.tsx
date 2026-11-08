"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export type RenderLink = (href: string, props: React.ComponentProps<"a">) => React.ReactNode

export type Crumb = { label: React.ReactNode; href?: string }

export type HeaderBarProps = React.ComponentProps<"header"> & {
  breadcrumbs?: Crumb[]
  title?: React.ReactNode
  search?: React.ReactNode
  actions?: React.ReactNode
  sticky?: boolean
  lastCrumbIsPage?: boolean
  showSidebarTrigger?: boolean | "auto"
  breadcrumbLabel?: string
  renderLink?: RenderLink
}

/**
 * HeaderBar:
 * 48px (h-12) bar across the top of a dashboard page.
 * Left: sidebar collapse button and breadcrumb (Server name > Page).
 * Right: credits chip, notification bell, Docs link, Discord support link.
 */
function HeaderBar({
  className,
  breadcrumbs,
  title,
  search,
  actions,
  sticky = false,
  lastCrumbIsPage = true,
  showSidebarTrigger = true,
  breadcrumbLabel,
  renderLink,
  ...props
}: HeaderBarProps) {
  const showTrigger = showSidebarTrigger !== false
  const link = (href: string, linkProps: React.ComponentProps<"a">) =>
    (renderLink ? renderLink(href, linkProps) : <a href={href} {...linkProps} />) as React.ReactElement

  return (
    <header
      data-slot="header-bar"
      data-sticky={sticky || undefined}
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur-md",
        sticky && "sticky top-0 z-30",
        className
      )}
      {...props}
    >
      {showTrigger ? (
        <>
          <SidebarTrigger className="-ms-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]" />
          <Separator orientation="vertical" className="me-1 h-4 self-center bg-[var(--border)]" />
        </>
      ) : null}

      {breadcrumbs?.length ? (
        <Breadcrumb className="min-w-0" {...(breadcrumbLabel ? { "aria-label": breadcrumbLabel } : {})}>
          <BreadcrumbList className="flex-nowrap text-[13px]">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1
              const isPage = last && lastCrumbIsPage
              return (
                <React.Fragment key={index}>
                  <BreadcrumbItem className="min-w-0">
                    {isPage ? (
                      <BreadcrumbPage className="truncate font-medium text-[#F4F4F5]">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : crumb.href ? (
                      <BreadcrumbLink
                        className="truncate text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
                        render={link(crumb.href, { children: crumb.label })}
                      />
                    ) : (
                      <span className="truncate text-[#A1A1AA]">{crumb.label}</span>
                    )}
                  </BreadcrumbItem>
                  {last ? null : <BreadcrumbSeparator className="text-[#71717A]" />}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : title ? (
        <div data-slot="header-bar-title" className="truncate text-sm font-medium text-[#F4F4F5]">
          {title}
        </div>
      ) : null}

      {search || actions ? (
        <div data-slot="header-bar-actions" className="ms-auto flex items-center gap-2">
          {search}
          {actions}
        </div>
      ) : null}
    </header>
  )
}

export { HeaderBar }
