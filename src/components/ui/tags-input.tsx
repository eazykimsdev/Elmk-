import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TagsInputContextType {
  value: string[]
  removeTag: (index: number) => void
  addTag: (tag: string) => void
  inputValue: string
  setInputValue: (val: string) => void
}

const Context = React.createContext<TagsInputContextType | null>(null)

export interface TagsInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (tags: string[]) => void
  blurBehavior?: "add" | "clear"
  max?: number
  placeholder?: string
}

export const TagsInput = React.forwardRef<HTMLDivElement, TagsInputProps>(
  ({ className, value: controlledValue, defaultValue = [], onValueChange, blurBehavior = "add", max = 5, placeholder = "Type tag and press Enter...", children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue)
    const [inputValue, setInputValue] = React.useState("")

    const isControlled = controlledValue !== undefined
    const tags = isControlled ? controlledValue : internalValue

    const updateTags = (newTags: string[]) => {
      if (!isControlled) {
        setInternalValue(newTags)
      }
      onValueChange?.(newTags)
    }

    const addTag = (rawTag: string) => {
      const clean = rawTag.trim().replace(/^#/, "")
      if (!clean) return
      if (tags.some(t => t.toLowerCase() === clean.toLowerCase())) return
      if (tags.length >= max) return
      updateTags([...tags, clean])
      setInputValue("")
    }

    const removeTag = (index: number) => {
      updateTags(tags.filter((_, i) => i !== index))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1)
      }
    }

    const handleBlur = () => {
      if (blurBehavior === "add" && inputValue.trim()) {
        addTag(inputValue)
      } else if (blurBehavior === "clear") {
        setInputValue("")
      }
    }

    return (
      <Context.Provider value={{ value: tags, removeTag, addTag, inputValue, setInputValue }}>
        <div
          ref={ref}
          className={cn(
            "flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition-colors focus-within:border-[var(--accent-border)]",
            className
          )}
          {...props}
        >
          {children}

          {tags.length < max && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={tags.length === 0 ? placeholder : "Add another tag..."}
              className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none px-1 py-1 font-sans"
            />
          )}
        </div>
      </Context.Provider>
    )
  }
)
TagsInput.displayName = "TagsInput"

export interface TagsInputContextProps {
  children: (context: { value: string[]; removeTag: (index: number) => void }) => React.ReactNode
}

export function TagsInputContext({ children }: TagsInputContextProps) {
  const ctx = React.useContext(Context)
  if (!ctx) return null
  return <div className="flex flex-wrap gap-1.5">{children(ctx)}</div>
}

export interface TagsInputItemProps extends React.HTMLAttributes<HTMLSpanElement> {
  index: number
  value: string
}

export const TagsInputItem = React.forwardRef<HTMLSpanElement, TagsInputItemProps>(
  ({ className, index, value, children, ...props }, ref) => {
    const ctx = React.useContext(Context)

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1 text-xs font-sans text-zinc-200 transition-colors",
          className
        )}
        {...props}
      >
        <span>#{children || value}</span>
        {ctx && (
          <button
            type="button"
            onClick={() => ctx.removeTag(index)}
            className="text-zinc-400 hover:text-white cursor-pointer -mr-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="size-3" />
          </button>
        )}
      </span>
    )
  }
)
TagsInputItem.displayName = "TagsInputItem"
