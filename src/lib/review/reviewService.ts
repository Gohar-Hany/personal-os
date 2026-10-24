import { prisma } from "@/lib/prisma"
import { countedWhere } from "@/lib/finance/financeService"
import { parseDateKey } from "@/lib/dates"
import { addDaysToKey, dateOnlyInstant } from "@/lib/zone"
import { userClock } from "@/lib/userTime"
import { appliesOn } from "@/lib/habits/recurrence"
import type { WeekStats } from "@/types"

/**
 * Live stats for the week starting on Saturday `weekKey` ("YYYY-MM-DD"), counting
 * only days up to today. Every boundary is in the user's time zone.
 */
export async function getWeekStats(weekKey?: string): Promise<WeekStats> {
  const clock = await userClock()
  weekKey ??= clock.weekStart
  const weekStart = clock.day(weekKey).start
  const weekEnd = clock.day(addDaysToKey(weekKey, 7)).start
  const lastKey = [addDaysToKey(weekKey, 6), clock.today].sort()[0]

  const [tasksCompleted, tasksCreated, milestonesComplete, habits, logs, money] = await Promise.all([
    prisma.task.count({ where: { parentId: null, status: "Completed", completedAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.task.count({ where: { parentId: null, createdAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.milestone.count({ where: { status: "Completed", updatedAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.habit.findMany({ where: { isActive: true } }),
    prisma.habitLog.findMany({
      where: { completed: true, date: { gte: weekKey, lte: addDaysToKey(weekKey, 6) } },
      select: { habitId: true, date: true },
    }),
    prisma.transaction.groupBy({ by: ["type"], where: { date: { gte: weekStart, lt: weekEnd }, ...(await countedWhere()) }, _sum: { amount: true } }),
  ])

  const done = new Set(logs.map((l) => `${l.habitId}_${l.date}`))
  const tally = { all: [0, 0], prayer: [0, 0], quran: [0, 0] }
  let workoutCount = 0

  for (let key = weekKey; key <= lastKey; key = addDaysToKey(key, 1)) {
    const d = parseDateKey(key)
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

/** The review saved for week `weekKey`, however its date was stored (Cairo midnight, UTC midnight or noon). */
export async function findReviewForWeek(weekKey: string) {
  const clock = await userClock()
  const { start, end } = clock.day(weekKey)
  return prisma.weeklyReview.findFirst({
    where: { weekStart: { gte: new Date(start.getTime() - 6 * 3600_000), lt: end } },
    orderBy: { updatedAt: "desc" },
  })
}

export const weekBounds = (weekKey: string) => ({ weekStart: dateOnlyInstant(weekKey), weekEnd: dateOnlyInstant(addDaysToKey(weekKey, 6)) })
