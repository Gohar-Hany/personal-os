import { prisma } from "@/lib/prisma"
import { compareTasks } from "@/lib/tasks/taskLogic"
import type { ProjectStatus, Priority } from "@/types"

const OPEN = { notIn: ["Completed", "Cancelled"] }

/** { projectId: { total, completed } } for top-level tasks, in a single query. */
async function taskCounts(projectIds: string[]) {
  const rows = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: { parentId: null, projectId: { in: projectIds }, status: { not: "Cancelled" } },
    _count: { _all: true },
  })
  const counts: Record<string, { total: number; completed: number }> = {}
  for (const r of rows) {
    if (!r.projectId) continue
    const c = (counts[r.projectId] ??= { total: 0, completed: 0 })
    c.total += r._count._all
    if (r.status === "Completed") c.completed += r._count._all
  }
  return counts
}

export async function getProjects(filters?: { status?: ProjectStatus }) {
  const projects = await prisma.project.findMany({
    where: filters?.status ? { status: filters.status } : undefined,
    include: {
      goal: { select: { id: true, name: true } },
      _count: { select: { milestones: true } },
      tasks: {
        where: { parentId: null, status: OPEN },
        select: { id: true, title: true, status: true, priority: true, scheduledDate: true, dueDate: true, startTime: true, order: true },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })
  const counts = await taskCounts(projects.map((p) => p.id))

  return projects.map(({ tasks, _count, ...p }) => {
    const next = [...tasks].sort(compareTasks)[0]
    return {
      ...p,
      taskCount: counts[p.id]?.total ?? 0,
      completedTaskCount: counts[p.id]?.completed ?? 0,
      milestoneCount: _count.milestones,
      nextTask: next ? { id: next.id, title: next.title } : null,
    }
  })
}

/** Lightweight list for pickers (quick add, task sheet). */
export async function getProjectOptions() {
  return prisma.project.findMany({
    where: { status: { not: "Archived" } },
    select: {
      id: true,
      name: true,
      status: true,
      milestones: { select: { id: true, title: true }, orderBy: { order: "asc" } },
    },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  })
}

const detailTaskInclude = {
  subtasks: { orderBy: { order: "asc" as const }, select: { id: true, title: true, status: true, order: true } },
  project: { select: { id: true, name: true } },
  milestone: { select: { id: true, title: true } },
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      goal: { select: { id: true, name: true } },
      milestones: {
        orderBy: { order: "asc" },
        include: { tasks: { where: { parentId: null }, include: detailTaskInclude } },
      },
      tasks: { where: { parentId: null, milestoneId: null }, include: detailTaskInclude },
    },
  })
  if (!project) return null
  const counts = await taskCounts([id])
  return {
    ...project,
    milestones: project.milestones.map((m) => ({ ...m, tasks: m.tasks.sort(compareTasks) })),
    tasks: project.tasks.sort(compareTasks),
    taskCount: counts[id]?.total ?? 0,
    completedTaskCount: counts[id]?.completed ?? 0,
  }
}

/** The pinned focus project, with its current milestone and next few tasks. */
export async function getFocusProject() {
  const project = await prisma.project.findFirst({
    where: { isFocus: true, status: { notIn: ["Archived", "Completed"] } },
    include: {
      milestones: { where: { status: "Active" }, orderBy: { order: "asc" }, take: 1, select: { id: true, title: true } },
      tasks: {
        where: { parentId: null, status: OPEN },
        select: { id: true, title: true, status: true, priority: true, scheduledDate: true, dueDate: true, startTime: true, order: true },
      },
    },
  })
  if (!project) return null
  const counts = await taskCounts([project.id])
  const { tasks, milestones, ...rest } = project
  return {
    ...rest,
    currentMilestone: milestones[0] ?? null,
    nextTasks: tasks.sort(compareTasks).slice(0, 3).map((t) => ({ id: t.id, title: t.title })),
    taskCount: counts[project.id]?.total ?? 0,
    completedTaskCount: counts[project.id]?.completed ?? 0,
  }
}

export async function createProject(data: {
  name: string
  description?: string | null
  status?: ProjectStatus
  priority?: Priority
  deadline?: Date | null
  goalId?: string | null
}) {
  return prisma.project.create({ data })
}

export async function updateProject(id: string, data: Partial<{
  name: string
  description: string | null
  status: ProjectStatus
  priority: Priority
  deadline: Date | null
  isFocus: boolean
  goalId: string | null
}>) {
  // Only one focus project at a time
  if (data.isFocus === true) {
    await prisma.project.updateMany({ where: { id: { not: id } }, data: { isFocus: false } })
  }
  // A finished or archived project can't stay the focus
  if (data.status === "Archived" || data.status === "Completed") data.isFocus = false
  return prisma.project.update({ where: { id }, data })
}

/** Deletes the project together with its milestones and tasks. */
export async function deleteProject(id: string) {
  return prisma.$transaction([
    prisma.task.deleteMany({ where: { projectId: id, parentId: { not: null } } }),
    prisma.task.deleteMany({ where: { projectId: id } }),
    prisma.project.delete({ where: { id } }),
  ])
}

// ─── Milestones ─────────────────────────────────────────

export async function createMilestone(data: { title: string; description?: string; projectId: string; dueDate?: Date | null }) {
  const order = await prisma.milestone.count({ where: { projectId: data.projectId } })
  return prisma.milestone.create({ data: { ...data, order } })
}

export async function updateMilestone(id: string, data: Partial<{
  title: string
  description: string | null
  status: string
  dueDate: Date | null
  order: number
}>) {
  return prisma.milestone.update({ where: { id }, data })
}

/** Deleting a milestone keeps its tasks in the project (they become "no milestone"). */
export async function deleteMilestone(id: string) {
  return prisma.milestone.delete({ where: { id } })
}
