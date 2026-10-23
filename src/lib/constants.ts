// Labels and colours for every enum-like field, in one place.
// Colour classes use semantic tokens so they work in light and dark mode.

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const
export const TASK_STATUSES = ["Todo", "InProgress", "Completed", "Cancelled"] as const

export const TASK_PRIORITY_META: Record<string, { label: string; rank: number; text: string; dot: string }> = {
  Critical: { label: "Urgent", rank: 0, text: "text-danger", dot: "bg-danger" },
  High: { label: "High", rank: 1, text: "text-warning", dot: "bg-warning" },
  Medium: { label: "Medium", rank: 2, text: "text-info", dot: "bg-info" },
  Low: { label: "Low", rank: 3, text: "text-muted-foreground", dot: "bg-muted-foreground/50" },
}

export const TASK_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  Todo: { label: "To do", tone: "neutral" },
  InProgress: { label: "In progress", tone: "info" },
  Completed: { label: "Done", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "neutral" },
}

export const PROJECT_STATUSES = ["Active", "Planned", "Idea", "Paused", "Completed", "Archived"] as const
export const PROJECT_PRIORITIES = ["P0", "P1", "P2", "P3"] as const

export const PROJECT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  Active: { label: "Active", tone: "info" },
  Planned: { label: "Planned", tone: "primary" },
  Idea: { label: "Idea", tone: "neutral" },
  Paused: { label: "Paused", tone: "warning" },
  Completed: { label: "Completed", tone: "success" },
  Archived: { label: "Archived", tone: "neutral" },
}

export const PROJECT_PRIORITY_META: Record<string, { label: string; short: string; tone: Tone }> = {
  P0: { label: "P0 · Critical", short: "P0", tone: "danger" },
  P1: { label: "P1 · High", short: "P1", tone: "warning" },
  P2: { label: "P2 · Normal", short: "P2", tone: "info" },
  P3: { label: "P3 · Low", short: "P3", tone: "neutral" },
}

export const GOAL_CATEGORIES = ["Financial", "Career", "Learning", "Health", "Personal", "Other"] as const
export const GOAL_STATUSES = ["Active", "Paused", "Completed", "Archived"] as const

export const GOAL_CATEGORY_META: Record<string, { tone: Tone }> = {
  Financial: { tone: "success" },
  Career: { tone: "info" },
  Learning: { tone: "primary" },
  Health: { tone: "danger" },
  Personal: { tone: "warning" },
  Other: { tone: "neutral" },
}

export const HABIT_CATEGORIES = ["Religious", "Health", "Learning", "Personal", "Work", "Other"] as const

export const TRANSACTION_TYPES = ["Expense", "Income", "Charity", "Transfer"] as const

export const EXPENSE_CATEGORIES = [
  "Food", "Cafe", "Supermarket", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Tech", "Family", "Personal", "Other",
]
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Investment", "Other"]

export const CURRENCIES = ["EGP", "USD", "SAR", "EUR", "GBP"] as const

export const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: "Bank", label: "Bank account" },
  { value: "Wallet", label: "Digital wallet" },
  { value: "Cash", label: "Cash" },
  { value: "Other", label: "Other" },
]

export const WEEKDAYS = [
  { value: 6, short: "Sat" },
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
]

export const TONE_DOT: Record<string, string> = {
  neutral: "bg-muted-foreground/60",
  primary: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
}

export type Tone = "neutral" | "primary" | "info" | "success" | "warning" | "danger"
