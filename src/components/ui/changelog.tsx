import * as React from "react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"

export type ChangelogTag = "new" | "improved" | "fixed" | "removed"

const TAG_LABELS: Record<ChangelogTag, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  removed: "Removed",
}

const TAG_TONES: Record<ChangelogTag, string> = {
  new: "border-transparent bg-[var(--accent)]/12 text-[var(--accent)]",
  improved: "border-[var(--border)] bg-[#141417] text-[#A1A1AA]",
  fixed: "border-[var(--border)] bg-[#141417] text-[#A1A1AA]",
  removed: "border-[var(--border)] bg-[#141417] text-[#71717A]",
}

const TAG_ORDER: ChangelogTag[] = ["new", "improved", "fixed", "removed"]

export type ChangelogEntry = {
  version?: string
  date: Date | string
  title: React.ReactNode
  description?: React.ReactNode
  tags?: ChangelogTag[]
  items?: string[]
  href?: string
}

export type ChangelogProps = React.ComponentProps<"div"> & {
  entries: ChangelogEntry[]
}

function Changelog({ className, entries, ...props }: ChangelogProps) {
  return (
    <div
      data-slot="changelog"
      className={cn(
        "grid w-full grid-cols-[max-content_minmax(0,1fr)] gap-x-6 divide-y divide-[var(--border)]",
        className
      )}
      {...props}
    >
      {entries.map((entry, index) => {
        const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
        const tags = entry.tags?.length
          ? TAG_ORDER.filter((tag) => entry.tags?.includes(tag))
          : []

        return (
          <div
            key={index}
            data-slot="changelog-entry"
            className="col-span-full grid grid-cols-subgrid gap-y-2 py-5 first:pt-0 last:pb-0"
          >
            <time
              data-slot="changelog-date"
              dateTime={date.toISOString()}
              className="pt-0.5 text-xs tabular-nums text-[#71717A]"
            >
              {formatDate(date, "medium", { timeZone: "UTC" })}
            </time>

            <div data-slot="changelog-body" className="flex min-w-0 flex-col gap-2">
              {entry.version || tags.length > 0 ? (
                <div data-slot="changelog-badges" className="flex flex-wrap items-center gap-1.5">
                  {entry.version ? (
                    <Badge
                      data-slot="changelog-version"
                      variant="secondary"
                      className="font-sans tabular-nums text-xs"
                    >
                      v{entry.version}
                    </Badge>
                  ) : null}
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      data-slot="changelog-tag"
                      data-tag={tag}
                      variant="outline"
                      className={TAG_TONES[tag]}
                    >
                      {TAG_LABELS[tag]}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div data-slot="changelog-title" className="text-[16px] leading-6 font-semibold text-[#F4F4F5]">
                {entry.href ? (
                  <a
                    href={entry.href}
                    className="rounded-sm hover:underline hover:text-[var(--accent)]"
                  >
                    {entry.title}
                  </a>
                ) : (
                  entry.title
                )}
              </div>

              {entry.description ? (
                <p data-slot="changelog-description" className="text-sm text-[#A1A1AA]">
                  {entry.description}
                </p>
              ) : null}

              {entry.items?.length ? (
                <ul
                  data-slot="changelog-items"
                  className="ms-4 list-disc space-y-1 text-sm text-[#A1A1AA] marker:text-[#71717A]"
                >
                  {entry.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { Changelog }
