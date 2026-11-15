import * as React from "react"
import { ArrowLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type RenderLink = (href: string, props: React.ComponentProps<"a">) => React.ReactNode

export type PageHeaderVariant = "compact" | "editorial"

export type PageHeaderProps = React.ComponentProps<"div"> & {
  title: React.ReactNode
  titleId?: string
  description?: React.ReactNode
  actions?: React.ReactNode
  badge?: React.ReactNode
  backHref?: string
  onBack?: () => void
  meta?: React.ReactNode
  eyebrow?: React.ReactNode
  tabs?: React.ReactNode
  variant?: PageHeaderVariant
  as?: "h1" | "h2" | "h3"
  renderLink?: RenderLink
}

/**
 * PageHeader:
 * Page title is 24px / 600 weight, normal letter-spacing (0).
 * Subtitle (description) ALWAYS sits on its own line below the title (14px / 400, secondary text).
 */
function PageHeader({
  className,
  title,
  titleId,
  description,
  actions,
  badge,
  backHref,
  onBack,
  meta,
  eyebrow,
  tabs,
  variant = "compact",
  as: Heading = "h1",
  renderLink,
  ...props
}: PageHeaderProps) {
  const backClassName = cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "-ms-1 mt-0.5"
  )
  const backContent = (
    <>
      <ArrowLeftIcon aria-hidden="true" className="rtl:rotate-180" />
      <span className="sr-only">Back</span>
    </>
  )
  const back = backHref ? (
    renderLink ? (
      renderLink(backHref, { className: backClassName, children: backContent })
    ) : (
      <a href={backHref} className={backClassName}>
        {backContent}
      </a>
    )
  ) : onBack ? (
    <button type="button" onClick={onBack} className={backClassName}>
      {backContent}
    </button>
  ) : null

  return (
    <div
      data-slot="page-header"
      data-variant={variant}
      className={cn(
        "flex flex-col gap-4 border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 py-6",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {back}
          <div className="flex min-w-0 flex-col gap-1">
            {eyebrow ? (
              <p
                data-slot="page-header-eyebrow"
                className="text-xs font-medium text-[#71717A] tracking-normal"
              >
                {eyebrow}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2.5">
              <Heading
                id={titleId}
                data-slot="page-header-title"
                className="text-[24px] leading-8 font-semibold tracking-normal text-[#F4F4F5]"
              >
                {title}
              </Heading>
              {badge}
            </div>
            {description ? (
              <p
                data-slot="page-header-description"
                className="text-[14px] leading-5 font-normal text-[#A1A1AA] max-w-2xl"
              >
                {description}
              </p>
            ) : null}
            {meta ? (
              <div
                data-slot="page-header-meta"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#71717A] pt-0.5"
              >
                {meta}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div
            data-slot="page-header-actions"
            className="flex shrink-0 items-center gap-2"
          >
            {actions}
          </div>
        ) : null}
      </div>

      {tabs ? (
        <div data-slot="page-header-tabs" className="-mb-6 pt-2">
          {tabs}
        </div>
      ) : null}
    </div>
  )
}

export { PageHeader }
