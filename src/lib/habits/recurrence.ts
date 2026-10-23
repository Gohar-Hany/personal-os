// Client-safe recurrence rules for habits.

interface RecurringHabit {
  recurrence: string
  weekdays?: string | null
  isActive?: boolean
  startDate?: string | Date | null
  endDate?: string | Date | null
}

export function parseWeekdays(weekdays?: string | null): number[] {
  if (!weekdays) return []
  try {
    const parsed = JSON.parse(weekdays)
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : []
  } catch {
    return []
  }
}

/** Does this habit apply on the given day? Daily habits apply every day. */
export function appliesOn(habit: RecurringHabit, date: Date): boolean {
  if (habit.endDate && new Date(habit.endDate) < date) return false
  // Days before the habit existed don't count against it
  if (habit.startDate) {
    const start = new Date(habit.startDate)
    start.setHours(0, 0, 0, 0)
    if (date < start) return false
  }
  if (habit.recurrence === "daily") return true
  const days = parseWeekdays(habit.weekdays)
  if (days.length === 0) return true
  return days.includes(date.getDay())
}

export function describeRecurrence(habit: RecurringHabit): string {
  if (habit.recurrence === "daily") return "Every day"
  const days = parseWeekdays(habit.weekdays)
  if (days.length === 0 || days.length === 7) return "Every day"
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  // Show in Saturday-first order
  const order = [6, 0, 1, 2, 3, 4, 5]
  return order.filter((d) => days.includes(d)).map((d) => names[d]).join(", ")
}
