import { prisma } from "@/lib/prisma"
import { dateKey } from "@/lib/dates"
import { appliesOn } from "@/lib/habits/recurrence"

export async function getAllHabits() {
  return prisma.habit.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
}

/** Active habits that apply today, each with today's completion state. */
export async function getTodayHabits(date: Date = new Date()) {
  const key = dateKey(date)
  const habits = await prisma.habit.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { logs: { where: { date: key }, take: 1 } },
  })
  return habits
    .filter((h) => appliesOn(h, date))
    .map(({ logs, ...h }) => ({ ...h, done: logs[0]?.completed ?? false }))
}

/** Map of `${habitId}_${YYYY-MM-DD}` → completed, for a date range (inclusive keys). */
export async function getHabitLogMap(fromKey: string, toKey: string) {
  const logs = await prisma.habitLog.findMany({
    where: { date: { gte: fromKey, lte: toKey } },
    select: { habitId: true, date: true, completed: true },
  })
  const map: Record<string, boolean> = {}
  for (const l of logs) if (l.completed) map[`${l.habitId}_${l.date}`] = true
  return map
}

export async function logHabit(habitId: string, completed: boolean, date: string = dateKey(), value?: number) {
  return prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date } },
    create: { habitId, date, completed, value },
    update: { completed, value },
  })
}

export async function createHabit(data: {
  name: string
  category?: string
  recurrence?: string
  weekdays?: string | null
  targetValue?: number | null
  unit?: string | null
}) {
  const count = await prisma.habit.count()
  return prisma.habit.create({ data: { ...data, order: count } })
}

export async function updateHabit(id: string, data: Partial<{
  name: string
  category: string
  recurrence: string
  weekdays: string | null
  targetValue: number | null
  unit: string | null
  isActive: boolean
  order: number
}>) {
  return prisma.habit.update({ where: { id }, data })
}

export async function deleteHabit(id: string) {
  return prisma.habit.delete({ where: { id } })
}
