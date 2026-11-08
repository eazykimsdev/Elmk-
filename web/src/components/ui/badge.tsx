import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-normal transition-colors duration-150",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)]/12 text-[var(--accent)]",
        success:
          "border-transparent bg-[var(--accent)]/12 text-[var(--accent)]",
        secondary:
          "border-[var(--border)] bg-[#141417] text-[#A1A1AA]",
        outline:
          "border-[var(--border)] bg-[#141417] text-[#A1A1AA]",
        warning:
          "border-transparent bg-[#FBBF24]/12 text-[#FBBF24]",
        destructive:
          "border-transparent bg-[#F87171]/12 text-[#F87171]",
        info:
          "border-transparent bg-[#60A5FA]/12 text-[#60A5FA]",
        ghost:
          "border-transparent bg-transparent text-[#A1A1AA]",
        link:
          "border-transparent text-[var(--accent)] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
