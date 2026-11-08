const DEFAULT_LOCALE = "en-US"

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** Formats a number with locale thousands separators, e.g. 1234567.891 → "1,234,567.89". */
export function formatNumber(
  value: number,
  opts: { locale?: string; maximumFractionDigits?: number; minimumFractionDigits?: number } = {}
): string {
  const { locale = DEFAULT_LOCALE, maximumFractionDigits = 2, minimumFractionDigits } = opts
  return new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits }).format(value)
}

/** Abbreviates a number to its shortest human form, e.g. 1234567 → "1.2M", 950 → "950". */
export function formatCompact(value: number, opts: { locale?: string; maximumFractionDigits?: number } = {}): string {
  const { locale = DEFAULT_LOCALE, maximumFractionDigits = 1 } = opts
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits }).format(value)
}

/** Formats a currency amount, e.g. 1234.5 → "$1,234.50"; pass `compact` to abbreviate large amounts. */
export function formatCurrency(
  value: number,
  currency = "USD",
  opts: { locale?: string; maximumFractionDigits?: number; compact?: boolean } = {}
): string {
  const { locale = DEFAULT_LOCALE, maximumFractionDigits, compact = false } = opts
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: maximumFractionDigits ?? (compact ? 1 : undefined),
  }).format(value)
}

/** Formats a 0..1 ratio as a percentage, e.g. 0.1234 → "12.3%". */
export function formatPercent(value: number, opts: { locale?: string; maximumFractionDigits?: number } = {}): string {
  const { locale = DEFAULT_LOCALE, maximumFractionDigits = 1 } = opts
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits }).format(value)
}

/** Formats a signed change: a leading "+" for positive values, U+2212 (not a hyphen) for negative, and a plain "0%"/"0" for exactly zero. */
export function formatDelta(
  value: number,
  opts: { style?: "percent" | "number" | "compact"; locale?: string; maximumFractionDigits?: number } = {}
): string {
  const { style = "percent", locale = DEFAULT_LOCALE, maximumFractionDigits } = opts
  if (value === 0) return style === "percent" ? "0%" : "0"

  const sign = value > 0 ? "+" : "−"
  const magnitude = Math.abs(value)

  if (style === "compact") return `${sign}${formatCompact(magnitude, { locale, maximumFractionDigits: maximumFractionDigits ?? 1 })}`
  if (style === "number") {
    const digits = maximumFractionDigits ?? 0
    return `${sign}${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(magnitude)}`
  }
  const digits = maximumFractionDigits ?? 1
  return `${sign}${new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(magnitude)}`
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const

/** Formats a byte count at the largest binary unit that keeps it readable, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B"
  let value = bytes
  let unitIndex = 0
  while (Math.abs(value) >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const rounded = parseFloat(value.toFixed(Math.max(0, decimals)))
  return `${rounded} ${BYTE_UNITS[unitIndex]}`
}

// Rounds once, to whole seconds, then derives every coarser unit by exact integer floor/modulo — never
// re-rounding a remainder — so a value that rounds up to a unit's modulus (e.g. 59.5s → 60s) carries over
// ("1m") instead of overshooting ("60s").
/** Formats a millisecond duration as a short human string, e.g. 5400000 → "1h 30m". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`

  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) return seconds > 0 ? `${totalMinutes}m ${seconds}s` : `${totalMinutes}m`

  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

/** How a date is rendered: which locale writes it, and which zone decides what day it is. */
export type DateFormatOptions = {
  locale?: string
  /**
   * IANA zone the instant is read in. Left off, the runtime's own zone decides
   * — right for a date the reader picked off a calendar, wrong for an instant
   * stored in UTC, which lands on the previous day west of Greenwich. Pass
   * `"UTC"` whenever the value came from a database rather than a date picker.
   */
  timeZone?: string
}

// Constructing an Intl.DateTimeFormat is the expensive part and each one is
// immutable, so they are shared by their options: a strip of 720 day tooltips
// built 720 formatters before this.
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${options.dateStyle ?? ""}|${options.timeStyle ?? ""}|${options.timeZone ?? ""}`
  const cached = dateTimeFormatters.get(key)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(locale, options)
  dateTimeFormatters.set(key, formatter)
  return formatter
}

/**
 * Safely parses any date input (Date object, ISO string, seconds timestamp, milliseconds timestamp, or null/undefined).
 * Always returns a valid Date or null. Never throws or returns an invalid Date.
 */
export function parseDateSafe(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return null;
    // Seconds vs milliseconds heuristic: timestamps before ~2286 in seconds are < 10,000,000,000
    const ms = input < 10_000_000_000 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.toLowerCase() === 'never') return null;
    // Pure numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      const ms = num < 10_000_000_000 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Formats a date safely, returning "Never" if null/invalid. */
export function formatDate(
  date: Date | string | number | null | undefined,
  style: "short" | "medium" | "long" = "medium",
  options: string | DateFormatOptions = {}
): string {
  const parsed = parseDateSafe(date);
  if (!parsed) return "Never";
  const { locale = DEFAULT_LOCALE, timeZone } =
    typeof options === "string" ? { locale: options, timeZone: undefined } : options;
  return dateTimeFormat(locale, { dateStyle: style, timeZone }).format(parsed);
}

/** Formats a date and time safely, returning "Never" if null/invalid. */
export function formatDateTime(
  date: Date | string | number | null | undefined,
  options: DateFormatOptions & {
    dateStyle?: "short" | "medium" | "long"
    timeStyle?: "short" | "medium"
  } = {}
): string {
  const parsed = parseDateSafe(date);
  if (!parsed) return "Never";
  const { locale = DEFAULT_LOCALE, timeZone, dateStyle = "medium", timeStyle = "short" } = options;
  return dateTimeFormat(locale, { dateStyle, timeStyle, timeZone }).format(parsed);
}

/**
 * Formats a date relative to `now`, returning "Never" if null/invalid.
 */
export function formatRelative(
  date: Date | string | number | null | undefined,
  now: Date = new Date(),
  options: DateFormatOptions = {}
): string {
  const target = parseDateSafe(date);
  if (!target || Number.isNaN(now.getTime())) return "Never";

  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);

  if (abs < 45_000) return "just now";
  if (abs >= 7 * DAY) return formatDate(target, "short", { timeZone: "UTC", ...options });

  const magnitude = abs < HOUR ? `${Math.round(abs / MINUTE)}m` : abs < DAY ? `${Math.round(abs / HOUR)}h` : `${Math.round(abs / DAY)}d`;
  return diff < 0 ? `${magnitude} ago` : `in ${magnitude}`;
}

/**
 * Helper specifically for last bump formatting:
 * Returns { relative, exact } with "Never" fallback and formatted relative time.
 */
export function formatLastBump(
  date: Date | string | number | null | undefined,
  now: Date = new Date()
): { relative: string; exact: string } {
  const parsed = parseDateSafe(date);
  if (!parsed) {
    return { relative: 'Never', exact: 'Never' };
  }
  const exact = formatDateTime(parsed, { timeZone: 'UTC' });
  const relative = formatRelative(parsed, now);
  return {
    relative: relative || 'just now',
    exact
  };
}

/**
 * How a component formats a number it is handed: a function, or — what a
 * server component can pass across to a client one, since a function cannot
 * cross — the options of an `Intl.NumberFormat`, with the locale among them.
 */
export type NumberFormat = ((value: number) => string) | (Intl.NumberFormatOptions & { locale?: string })

/** The function a NumberFormat stands for; plain options become an `Intl.NumberFormat`. */
export function numberFormatter(format: NumberFormat): (value: number) => string {
  if (typeof format === "function") return format
  const { locale = DEFAULT_LOCALE, ...options } = format
  const formatter = new Intl.NumberFormat(locale, options)
  return (value) => formatter.format(value)
}

/** Clamps `n` to the inclusive [min, max] range. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Returns what percentage `part` is of `total`, or 0 when `total` is zero or negative. */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0
  return (part / total) * 100
}

/** Extracts a single alphanumeric character initial for a server, skipping symbols (e.g. "@ConnectingERLC" -> "C"). */
export function getServerInitial(name?: string | null): string {
  if (!name) return 'S';
  const cleaned = name.trim().replace(/^[^a-zA-Z0-9]+/, '');
  const char = cleaned.charAt(0);
  return char ? char.toUpperCase() : 'S';
}

/** Extracts up to `max` (default 2) uppercase alphanumeric initials from a name, skipping leading symbols. */
export function getInitials(name: string, max = 2): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, max)
    .map((part) => {
      const cleaned = part.replace(/^[^a-zA-Z0-9]+/, '');
      return cleaned.charAt(0)?.toUpperCase() ?? '';
    })
    .filter(Boolean)
    .join("");
  return initials || 'S';
}
