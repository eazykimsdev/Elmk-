import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      variant: {
        default: "",
        dashed: "rounded-[16px] border border-dashed border-[var(--border)] bg-[#0E0E11]/60",
      },
      size: {
        default: "gap-4 py-12 px-6",
        sm: "gap-3 py-8 px-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  size?: NonNullable<VariantProps<typeof emptyStateVariants>["size"]>
  variant?: NonNullable<VariantProps<typeof emptyStateVariants>["variant"]>
}

function SoftSkeletonIllustration() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-2 w-44 p-3 rounded-[10px] border border-[var(--border)] bg-[#141417]/70 mb-1"
    >
      <div className="flex items-center gap-2">
        <div className="size-5 rounded-md bg-white/[0.06] shrink-0" />
        <div className="h-2.5 w-20 rounded-full bg-white/[0.08]" />
        <div className="ms-auto h-2.5 w-8 rounded-full bg-[var(--accent)]/25" />
      </div>
      <div className="flex items-center gap-2 opacity-60">
        <div className="size-5 rounded-md bg-white/[0.05] shrink-0" />
        <div className="h-2.5 w-16 rounded-full bg-white/[0.06]" />
        <div className="ms-auto h-2.5 w-6 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  )
}

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  variant = "default",
  children,
  ...props
}: EmptyStateProps) {
  const hasActions = Boolean(action) || Boolean(secondaryAction)

  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      data-size={size}
      className={cn(emptyStateVariants({ variant, size }), className)}
      {...props}
    >
      {icon ? (
        <div className="flex items-center justify-center text-[#A1A1AA] [&_svg]:size-5 mb-1">
          {icon}
        </div>
      ) : (
        <SoftSkeletonIllustration />
      )}
      <div className="space-y-1 max-w-md">
        <h3 className="text-[16px] leading-6 font-semibold text-[#F4F4F5] tracking-normal">
          {title}
        </h3>
        {description ? (
          <p className="text-[13px] leading-5 font-normal text-[#A1A1AA]">
            {description}
          </p>
        ) : null}
      </div>
      {hasActions ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export { EmptyState }
