// Client-safe task rules shared by every view, so "Today", "Overdue" etc.
// mean exactly the same thing everywhere — on the server and in the browser.
//
// Everything date-related works on "YYYY-MM-DD" keys in the user's time zone
// (see Clock). Server render and browser hydration therefore produce identical
// output, and a server in UTC can never put a task in the wrong day.
import { format } from "date-fns"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { parseDateKey, toDate } from "@/lib/dates"
import { addDaysToKey, zonedKey } from "@/lib/zone"

/** "What day is it, and which day does an instant fall on?" — for the user's zone. */
export interface Clock {
  today: string
  tz: string
}

/** Calendar key of a stored date in the clock's zone. Plain "YYYY-MM-DD" passes through. */
export function keyOf(value: string | Date | null | undefined, clock: Pick<Clock, "tz">): string | null {
  if (!value) return null
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = toDate(value)
  return d ? zonedKey(d, clock.tz) : null
}

export function daysBetween(fromKey: string, toKey: string) {
  const [a, b] = [fromKey, toKey].map((k) => {
    const [y, m, d] = k.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  })
  return Math.round((b - a) / 86_400_000)
}

/** "Today", "Tomorrow", "Yesterday", "Mon" (this week), "Oct 24" or "Oct 24, 2027". */
export function dayLabel(key: string, today: string) {
  const diff = daysBetween(today, key)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  const d = parseDateKey(key)
  if (diff > 1 && diff < 7) return format(d, "EEE")
  return format(d, key.slice(0, 4) === today.slice(0, 4) ? "MMM d" : "MMM d, yyyy")
}

interface DatedTask {
  status: string
  priority: string
  scheduledDate?: string | Date | null
  dueDate?: string | Date | null
  startTime?: string | null
  order?: number
  createdAt?: string | Date
}

export type TaskBucket = "overdue" | "today" | "tomorrow" | "upcoming" | "someday" | "done"

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  upcoming: "Upcoming",
  someday: "No date",
  done: "Completed",
}

export function isDone(t: { status: string }) {
  return t.status === "Completed" || t.status === "Cancelled"
}

/** The day a task is planned for: its scheduled day, otherwise its deadline. */
export function effectiveDate(t: DatedTask): Date | null {
  return toDate(t.scheduledDate) ?? toDate(t.dueDate)
}

export function effectiveKey(t: DatedTask, clock: Clock): string | null {
  return keyOf(t.scheduledDate, clock) ?? keyOf(t.dueDate, clock)
}

export function bucketOf(t: DatedTask, clock: Clock): TaskBucket {
  if (isDone(t)) return "done"
  const k = effectiveKey(t, clock)
  if (!k) return "someday"
  if (k < clock.today) return "overdue"
  if (k === clock.today) return "today"
  if (k === addDaysToKey(clock.today, 1)) return "tomorrow"
  return "upcoming"
}

/** Deadline is today, tomorrow or already passed. */
export function isDeadlineSoon(t: DatedTask, clock: Clock) {
  const due = keyOf(t.dueDate, clock)
  if (!due || isDone(t)) return false
  return daysBetween(clock.today, due) <= 1
}

export function priorityRank(p: string) {
  return TASK_PRIORITY_META[p]?.rank ?? 2
}

/** Overdue/time-of-day first, then priority, then manual order. Pure instants — zone-independent. */
export function compareTasks(a: DatedTask, b: DatedTask) {
  const da = effectiveDate(a)?.getTime() ?? Infinity
  const db = effectiveDate(b)?.getTime() ?? Infinity
  if (da !== db) return da - db
  if ((a.startTime ?? "") !== (b.startTime ?? "")) {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return a.startTime.localeCompare(b.startTime)
  }
  const pr = priorityRank(a.priority) - priorityRank(b.priority)
  if (pr !== 0) return pr
  return (a.order ?? 0) - (b.order ?? 0)
}

/** "[KN-010] Call the clinic" → { code: "KN-010", text: "Call the clinic" }. */
export function splitTicket(title: string): { code: string | null; text: string } {
  const m = title.match(/^\s*\[([A-Za-z][A-Za-z0-9]*-?\d+[A-Za-z]?)\]\s*(.*)$/)
  return m ? { code: m[1].toUpperCase(), text: m[2] || title } : { code: null, text: title }
}
