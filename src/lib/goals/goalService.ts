import { prisma } from "@/lib/prisma"
import type { GoalStatus, GoalCategory, TaskPriority } from "@/types"

function withProgress<T extends { currentValue: number; targetValue: number | null }>(g: T) {
  return {
    ...g,
    progressPct: g.targetValue ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : null,
  }
}

export async function getGoals(filters?: { status?: GoalStatus }) {
  const goals = await prisma.goal.findMany({
    where: filters?.status ? { status: filters.status } : undefined,
    include: { _count: { select: { projects: true } } },
    orderBy: [{ createdAt: "asc" }],
  })
  return goals.map(({ _count, ...g }) => ({ ...withProgress(g), projectCount: _count.projects }))
}

export async function getGoalOptions() {
  return prisma.goal.findMany({
    where: { status: { in: ["Active", "Paused"] } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })
}

export async function createGoal(data: {
  name: string
  description?: string | null
  category?: GoalCategory
  targetValue?: number | null
  currentValue?: number
  unit?: string | null
  deadline?: Date | null
  status?: GoalStatus
  priority?: TaskPriority
}) {
  return prisma.goal.create({ data })
}

export async function updateGoal(id: string, data: Partial<{
  name: string
  description: string | null
  category: GoalCategory
  targetValue: number | null
  currentValue: number
  unit: string | null
  deadline: Date | null
  status: GoalStatus
  priority: TaskPriority
}>) {
  return prisma.goal.update({ where: { id }, data })
}

export async function deleteGoal(id: string) {
  return prisma.goal.delete({ where: { id } })
}
