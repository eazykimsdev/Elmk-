import * as React from "react"
import { cn } from "@/lib/utils"

export type SettingsGroupProps = React.ComponentProps<"section"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

/**
 * SettingsGroup:
 * Grouped card pattern from Section 3.
 * Group title is 16px / 600, no big coloured headers, 14px radius, 1px border.
 */
export function SettingsGroup({
  title,
  description,
  action,
  className,
  children,
  ...props
}: SettingsGroupProps) {
  return (
    <section
      data-slot="settings-group"
      className={cn(
        "rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden",
        className
      )}
      {...props}
    >
      {(title || description || action) && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="space-y-0.5 min-w-0">
            {title && (
              <h2 className="text-[16px] leading-6 font-semibold text-[#F4F4F5] tracking-normal">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[13px] leading-5 font-normal text-[#A1A1AA]">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  )
}

export type SettingsRowProps = React.ComponentProps<"div"> & {
  label: React.ReactNode
  description?: React.ReactNode
  control?: React.ReactNode
  vertical?: boolean
}

/**
 * SettingsRow:
 * Label and one muted line of help text on the left, control on the right.
 */
export function SettingsRow({
  label,
  description,
  control,
  vertical = false,
  className,
  children,
  ...props
}: SettingsRowProps) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "p-5",
        vertical
          ? "flex flex-col gap-3"
          : "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        className
      )}
      {...props}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="text-[14px] leading-5 font-medium text-[#F4F4F5]">
          {label}
        </div>
        {description && (
          <p className="text-[13px] leading-5 font-normal text-[#A1A1AA]">
            {description}
          </p>
        )}
      </div>
      {(control || children) && (
        <div className="shrink-0 flex items-center gap-2">
          {control}
          {children}
        </div>
      )}
    </div>
  )
}

