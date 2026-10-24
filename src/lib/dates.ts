import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns"
import { dateOnlyInstant } from "@/lib/zone"

/** The week starts on Saturday (Egyptian calendar). Used by habits and weekly review. */
export const WEEK_STARTS_ON = 6 as const

/** Local "YYYY-MM-DD" key. Never use toISOString() for day keys — it shifts days in UTC+ zones. */
export function dateKey(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd")
}

/** Parse a "YYYY-MM-DD" key as local midnight. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return parseDateKey(v)
  const d = typeof v === "string" ? new Date(v) : v
  return isNaN(d.getTime()) ? null : d
}

/**
 * Normalise a date coming from an API body.
 * - undefined  → field not sent (leave unchanged)
 * - "" / null  → clear the field
 * - "YYYY-MM-DD" → 12:00 UTC of that date (see dateOnlyInstant: same day in every zone,
 *   never the server's local midnight — the server runs in UTC on Vercel)
 * - ISO string → that instant
 */
export function parseDateInput(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return dateOnlyInstant(v)
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d
}

/** Device-local start of today. Browser only — on the server use userClock() from lib/userTime. */
export function todayStart(): Date {
  return startOfDay(new Date())
}

export function weekStartOf(d: Date = new Date()): Date {
  return startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON })
}

/** "Today", "Tomorrow", "Yesterday", "Mon", or "Oct 24". */
export function relativeDay(d: Date, now: Date = new Date()): string {
  const diff = differenceInCalendarDays(d, now)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff > 1 && diff < 7) return format(d, "EEE")
  if (d.getFullYear() !== now.getFullYear()) return format(d, "MMM d, yyyy")
  return format(d, "MMM d")
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const period = h >= 12 ? "pm" : "am"
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`
}

export function daysFromNow(n: number): Date {
  return addDays(todayStart(), n)
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 5) return "Good night"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}
