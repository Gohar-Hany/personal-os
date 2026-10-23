import { addDays, min as minDate } from "date-fns"
import { prisma } from "@/lib/prisma"
import { NOT_ADJUSTMENT } from "@/lib/finance/financeService"
import { dateKey, todayStart, weekStartOf } from "@/lib/dates"
import { appliesOn } from "@/lib/habits/recurrence"
import type { WeekStats } from "@/types"

/** Live stats for the week that starts on `weekStart` (counts only days up to today). */
export async function getWeekStats(weekStart: Date = weekStartOf()): Promise<WeekStats> {
  const weekEnd = addDays(weekStart, 7)
  const lastDay = minDate([addDays(weekStart, 6), todayStart()])

  const [tasksCompleted, tasksCreated, milestonesComplete, habits, logs, money] = await Promise.all([
    prisma.task.count({ where: { parentId: null, status: "Completed", completedAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.task.count({ where: { parentId: null, createdAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.milestone.count({ where: { status: "Completed", updatedAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.habit.findMany({ where: { isActive: true } }),
    prisma.habitLog.findMany({
      where: { completed: true, date: { gte: dateKey(weekStart), lte: dateKey(addDays(weekStart, 6)) } },
      select: { habitId: true, date: true },
    }),
    prisma.transaction.groupBy({ by: ["type"], where: { date: { gte: weekStart, lt: weekEnd }, ...NOT_ADJUSTMENT }, _sum: { amount: true } }),
  ])

  const done = new Set(logs.map((l) => `${l.habitId}_${l.date}`))
  const tally = { all: [0, 0], prayer: [0, 0], quran: [0, 0] }
  let workoutCount = 0

  for (let d = weekStart; d <= lastDay; d = addDays(d, 1)) {
    const key = dateKey(d)
    for (const h of habits) {
      if (!appliesOn(h, d)) continue
      const hit = done.has(`${h.id}_${key}`) ? 1 : 0
      tally.all[0] += hit; tally.all[1] += 1
      if (h.isPrayer) { tally.prayer[0] += hit; tally.prayer[1] += 1 }
      if (h.isQuran) { tally.quran[0] += hit; tally.quran[1] += 1 }
      if (hit && h.category === "Health") workoutCount += 1
    }
  }
  const pct = ([a, b]: number[]) => (b ? Math.round((a / b) * 100) : 0)
  const sum = (t: string) => money.find((r) => r.type === t)?._sum.amount ?? 0

  return {
    tasksCompleted,
    tasksCreated,
    milestonesComplete,
    habitCompletionPct: pct(tally.all),
    prayerCompletionPct: pct(tally.prayer),
    quranCompletionPct: pct(tally.quran),
    workoutCount,
    incomeTotal: sum("Income"),
    expenseTotal: sum("Expense"),
    charityTotal: sum("Charity"),
    savingsTotal: sum("Income") - sum("Expense") - sum("Charity"),
  }
}
