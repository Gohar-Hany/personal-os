// Central types for Personal OS.
// Enum-like unions are used by the services; the *DTO* shapes describe data
// as client components receive it (dates are ISO strings after serialisation).

export type Priority = "P0" | "P1" | "P2" | "P3"
export type TaskPriority = "Low" | "Medium" | "High" | "Critical"
export type ProjectStatus = "Idea" | "Planned" | "Active" | "Paused" | "Completed" | "Archived"
export type TaskStatus = "Todo" | "InProgress" | "Completed" | "Cancelled"
export type GoalStatus = "Active" | "Paused" | "Completed" | "Archived"
export type GoalCategory = "Financial" | "Career" | "Learning" | "Health" | "Personal" | "Other"
export type TransactionType = "Income" | "Expense" | "Transfer" | "Charity"
export type HabitRecurrence = "daily" | "weekly" | "custom"
export type AccountType = "Cash" | "Bank" | "Wallet" | "DigitalWallet" | "Other"
export type Currency = "EGP" | "USD" | "SAR" | "EUR" | "GBP"

export interface SubtaskDTO {
  id: string
  title: string
  status: string
  order: number
}

export interface TaskDTO {
  id: string
  title: string
  description?: string | null
  notes?: string | null
  status: string
  priority: string
  projectId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueDate?: string | null
  scheduledDate?: string | null
  startTime?: string | null
  endTime?: string | null
  estimatedMinutes?: number | null
  completedAt?: string | null
  order: number
  createdAt: string
  project?: { id: string; name: string } | null
  milestone?: { id: string; title: string } | null
  subtasks?: SubtaskDTO[]
}

export interface ProjectLite {
  id: string
  name: string
  status: string
  milestones: { id: string; title: string }[]
}

export interface ProjectDTO {
  id: string
  name: string
  description?: string | null
  status: string
  priority: string
  deadline?: string | null
  isFocus: boolean
  goalId?: string | null
  goal?: { id: string; name: string } | null
  taskCount: number
  completedTaskCount: number
  milestoneCount?: number
  /** Only on the projects list. */
  openCount?: number
  overdueCount?: number
  dueThisWeek?: number
  inProgressCount?: number
  milestones?: { id: string; title: string; status: string; total?: number; done?: number }[]
  nextTask?: { id: string; title: string } | null
  createdAt: string
}

export interface MilestoneDTO {
  id: string
  title: string
  description?: string | null
  status: string
  dueDate?: string | null
  order: number
  tasks: TaskDTO[]
}

export interface ProjectDetailDTO extends ProjectDTO {
  milestones: MilestoneDTO[]
  tasks: TaskDTO[]
}

export interface GoalDTO {
  id: string
  name: string
  description?: string | null
  category: string
  targetValue?: number | null
  currentValue: number
  unit?: string | null
  deadline?: string | null
  status: string
  priority: string
  progressPct: number | null
  projectCount?: number
}

export interface HabitDTO {
  id: string
  name: string
  category: string
  recurrence: string
  weekdays?: string | null
  targetValue?: number | null
  unit?: string | null
  isActive: boolean
  startDate?: string | null
  endDate?: string | null
  order: number
  isPrayer: boolean
  isAdhkar: boolean
  isQuran: boolean
}

export interface TodayHabitDTO extends HabitDTO {
  done: boolean
}

export interface AccountDTO {
  id: string
  name: string
  type: string
  currency: string
  openingBalance: number
  isActive: boolean
  color?: string | null
  currentBalance: number
}

export interface TransactionDTO {
  id: string
  type: string
  amount: number
  currency: string
  category?: string | null
  accountId?: string | null
  fromAccountId?: string | null
  toAccountId?: string | null
  date: string
  description?: string | null
  isCharity: boolean
  account?: { id: string; name: string } | null
  fromAccount?: { id: string; name: string } | null
  toAccount?: { id: string; name: string } | null
  balanceBefore?: number | null
  balanceAfter?: number | null
  fromBalanceBefore?: number | null
  fromBalanceAfter?: number | null
  toBalanceBefore?: number | null
  toBalanceAfter?: number | null
}

export interface MonthSummary {
  month: string // YYYY-MM
  income: number
  expenses: number
  charity: number
  savings: number
  byCategory: { category: string; amount: number }[]
}

export interface InboxItemDTO {
  id: string
  content: string
  status: string
  type?: string | null
  convertedTo?: string | null
  convertedId?: string | null
  createdAt: string
}

export interface WeekStats {
  tasksCompleted: number
  tasksCreated: number
  milestonesComplete: number
  habitCompletionPct: number
  prayerCompletionPct: number
  quranCompletionPct: number
  workoutCount: number
  incomeTotal: number
  expenseTotal: number
  charityTotal: number
  savingsTotal: number
}

export interface WeeklyReviewDTO extends WeekStats {
  id: string
  weekStart: string
  weekEnd: string
  wins?: string | null
  challenges?: string | null
  lessonsLearned?: string | null
  nextWeekPriorities?: string | null
  faithReflection?: string | null
  overallRating?: number | null
}

export interface SettingsDTO {
  id: string
  name: string
  timezone: string
  location: string
  latitude: number
  longitude: number
  defaultCurrency: string
  charityPercentage: number
  theme: string
  prayerMethod: string
}
