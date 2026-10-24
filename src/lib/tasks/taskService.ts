import { prisma } from "@/lib/prisma"
import { userClock } from "@/lib/userTime"
import { compareTasks } from "@/lib/tasks/taskLogic"
import type { TaskStatus, TaskPriority } from "@/types"

const listInclude = {
  subtasks: { orderBy: { order: "asc" as const }, select: { id: true, title: true, status: true, order: true } },
  project: { select: { id: true, name: true } },
  milestone: { select: { id: true, title: true } },
}

export async function getTasks(filters?: { projectId?: string; status?: TaskStatus }) {
  const tasks = await prisma.task.findMany({
    where: {
      parentId: null,
      ...(filters?.projectId ? { projectId: filters.projectId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: listInclude,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  })
  return tasks.sort(compareTasks)
}

export async function getTask(id: string) {
  return prisma.task.findUnique({ where: { id }, include: listInclude })
}

/**
 * Everything that belongs on Today:
 * open tasks planned for today or earlier (overdue roll over),
 * plus anything completed today so progress doesn't shrink as you work.
 */
export async function getTodayTasks() {
  const clock = await userClock()
  const { start: today, end: tomorrow } = clock.day(clock.today)

  const tasks = await prisma.task.findMany({
    where: {
      parentId: null,
      OR: [
        {
          status: { notIn: ["Completed", "Cancelled"] },
          OR: [
            { scheduledDate: { lt: tomorrow } },
            { scheduledDate: null, dueDate: { lt: tomorrow } },
          ],
        },
        { status: "Completed", completedAt: { gte: today, lt: tomorrow } },
      ],
    },
    include: listInclude,
  })
  return tasks.sort(compareTasks)
}

/** Open tasks with no date at all — candidates for planning a day. */
export async function getBacklogTasks() {
  const tasks = await prisma.task.findMany({
    where: {
      parentId: null,
      status: { notIn: ["Completed", "Cancelled"] },
      scheduledDate: null,
      dueDate: null,
    },
    include: listInclude,
    take: 100,
  })
  return tasks.sort(compareTasks)
}

export async function createTask(data: {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  projectId?: string | null
  milestoneId?: string | null
  parentId?: string | null
  dueDate?: Date | null
  scheduledDate?: Date | null
  startTime?: string | null
  endTime?: string | null
  estimatedMinutes?: number | null
  notes?: string | null
}) {
  // A milestone implies its project
  if (data.milestoneId && !data.projectId) {
    const ms = await prisma.milestone.findUnique({ where: { id: data.milestoneId }, select: { projectId: true } })
    data.projectId = ms?.projectId ?? null
  }
  // Subtasks inherit the parent's project
  if (data.parentId && data.projectId === undefined) {
    const parent = await prisma.task.findUnique({ where: { id: data.parentId }, select: { projectId: true } })
    data.projectId = parent?.projectId ?? null
  }
  const siblings = await prisma.task.count({ where: { parentId: data.parentId ?? null } })

  return prisma.task.create({
    data: {
      ...data,
      order: siblings,
      completedAt: data.status === "Completed" ? new Date() : null,
    },
    include: listInclude,
  })
}

export async function updateTask(id: string, data: Partial<{
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  projectId: string | null
  milestoneId: string | null
  dueDate: Date | null
  scheduledDate: Date | null
  startTime: string | null
  endTime: string | null
  estimatedMinutes: number | null
  notes: string | null
  order: number
}>) {
  const patch: Record<string, unknown> = { ...data }
  if (data.status === "Completed") patch.completedAt = new Date()
  else if (data.status) patch.completedAt = null

  // Moving to another project drops a milestone that belongs to the old one
  if (data.projectId !== undefined && data.milestoneId === undefined) {
    const current = await prisma.task.findUnique({ where: { id }, select: { milestone: { select: { projectId: true } } } })
    if (current?.milestone && current.milestone.projectId !== data.projectId) patch.milestoneId = null
  }

  return prisma.task.update({ where: { id }, data: patch, include: listInclude })
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } })
}
