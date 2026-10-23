// Client-safe task rules shared by every view, so "Today", "Overdue" etc.
// mean exactly the same thing everywhere.
import { differenceInCalendarDays } from "date-fns"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { toDate } from "@/lib/dates"

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

export function bucketOf(t: DatedTask, now: Date = new Date()): TaskBucket {
  if (isDone(t)) return "done"
  const d = effectiveDate(t)
  if (!d) return "someday"
  const diff = differenceInCalendarDays(d, now)
  if (diff < 0) return "overdue"
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  return "upcoming"
}

export function isDeadlineSoon(t: DatedTask, now: Date = new Date()) {
  const due = toDate(t.dueDate)
  if (!due || isDone(t)) return false
  return differenceInCalendarDays(due, now) <= 1
}

export function priorityRank(p: string) {
  return TASK_PRIORITY_META[p]?.rank ?? 2
}

/** Overdue/time-of-day first, then priority, then manual order. */
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
