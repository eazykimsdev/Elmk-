import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, helperText, error, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    const inputEl = (
      <input
        id={inputId}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-[var(--border)] bg-[#141417] px-3.5 py-2 text-sm text-[#F4F4F5] transition-colors duration-150 file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-[#71717A] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[#F87171] focus-visible:border-[#F87171] focus-visible:ring-[#F87171]/25",
          className
        )}
        ref={ref}
        {...props}
      />
    )

    if (!label && !helperText && !error) {
      return inputEl
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[#F4F4F5]"
          >
            {label}
          </label>
        ) : null}
        {inputEl}
        {error ? (
          <p className="text-xs text-[#F87171]">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#71717A]">{helperText}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
