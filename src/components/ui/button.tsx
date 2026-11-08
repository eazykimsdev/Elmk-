import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[14px] font-medium tracking-normal transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] select-none cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[#F4F4F5] text-[#09090B] hover:bg-[#FFFFFF] border border-transparent shadow-xs",
        brand:
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] border border-transparent font-medium shadow-xs",
        secondary:
          "bg-[#141417] text-[#F4F4F5] hover:bg-[#19191D] border border-[rgba(255,255,255,0.07)]",
        ghost:
          "bg-transparent text-[#A1A1AA] hover:bg-[#141417] hover:text-[#F4F4F5] border border-transparent",
        destructive:
          "bg-transparent text-[#F87171] hover:bg-[#F87171]/10 border border-[#F87171]/40",
        icon:
          "bg-[#141417] text-[#F4F4F5] hover:bg-[#19191D] border border-[rgba(255,255,255,0.07)]",
        // Backward compatibility mappings
        default:
          "bg-[#F4F4F5] text-[#09090B] hover:bg-[#FFFFFF] border border-transparent shadow-xs",
        outline:
          "bg-[#141417] text-[#F4F4F5] hover:bg-[#19191D] border border-[rgba(255,255,255,0.07)]",
        link:
          "bg-transparent text-[var(--accent)] underline-offset-4 hover:underline border-transparent px-0 active:scale-100",
      },
      size: {
        default: "h-9 px-3.5 text-[14px]",
        md: "h-9 px-3.5 text-[14px]",
        sm: "h-8 px-3 text-[13px] rounded-[8px]",
        lg: "h-11 px-5 text-[14px]",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0 rounded-[8px]",
        "icon-lg": "size-11 p-0",
        // Legacy size aliases
        xs: "h-8 px-2.5 text-[12px] rounded-[8px]",
        tiny: "h-8 px-2.5 text-[12px] rounded-[8px]",
        small: "h-8 px-3 text-[13px] rounded-[8px]",
        medium: "h-9 px-3.5 text-[14px]",
        large: "h-11 px-5 text-[14px]",
        "icon-xs": "size-8 p-0 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'prefix'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  focusableWhenDisabled?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      prefix,
      suffix,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // If asChild is true, Slot manages its single child element
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          aria-disabled={disabled || loading || undefined}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin shrink-0" />
            <span className="opacity-90">{children}</span>
          </>
        ) : (
          <>
            {prefix && <span className="inline-flex shrink-0">{prefix}</span>}
            {children}
            {suffix && <span className="inline-flex shrink-0">{suffix}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
