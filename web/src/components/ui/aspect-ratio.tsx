import * as React from "react"
import { cn } from "@/lib/utils"

export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number
}

export const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ className, ratio = 16 / 9, style, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative w-full overflow-hidden", className)}
        style={{ aspectRatio: ratio, ...style }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
AspectRatio.displayName = "AspectRatio"
