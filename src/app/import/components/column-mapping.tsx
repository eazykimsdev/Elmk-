import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

import { FIELDS, UNMAPPED, type FieldKey } from "../fields"

export type Mapping = Record<number, FieldKey | null>

/**
 * One row per column in the file: what it is called there, the first value it
 * holds, and the field it goes into.
 *
 * A field can only be filled from one column, so a select offers the fields
 * nothing else has taken plus its own — otherwise two columns could both claim
 * "Email" and the second would silently win. "Do not import" is always there,
 * because a spreadsheet always has a column nothing here wants.
 */
export function ColumnMapping({
  columns,
  sample,
  mapping,
  onChange,
}: {
  columns: string[]
  /** The first row of the file, so each select is decided beside a real value. */
  sample: string[]
  mapping: Mapping
  onChange: (index: number, field: FieldKey | null) => void
}) {
  const taken = new Set(Object.values(mapping).filter((field): field is FieldKey => field !== null))

  return (
    <ul className="flex flex-col divide-y panel">
      {columns.map((column, index) => {
        const current = mapping[index] ?? null
        const field = FIELDS.find((entry) => entry.key === current)

        return (
          <li key={`${column}-${index}`} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex min-w-0 flex-1 basis-48 flex-col">
              <span className="truncate font-medium">{column || `Column ${index + 1}`}</span>
              <span className="truncate text-xs text-muted-foreground">
                {sample[index]?.trim() || "— empty in the first row"}
              </span>
            </span>

            <span className="flex flex-col items-end gap-1">
              <Select
                value={current ?? UNMAPPED}
                onValueChange={(val) =>
                  onChange(index, val === UNMAPPED ? null : (val as FieldKey))
                }
              >
                <SelectTrigger className="w-44 h-8 text-xs bg-[#0E0E11] border-[var(--border)]">
                  <SelectValue placeholder="Map field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNMAPPED}>Do not import</SelectItem>
                  {FIELDS.filter((entry) => entry.key === current || !taken.has(entry.key)).map(
                    (entry) => (
                      <SelectItem key={entry.key} value={entry.key}>
                        {entry.label}
                        {entry.required ? " (required)" : ""}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {field ? field.hint : "This column will be left out"}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
