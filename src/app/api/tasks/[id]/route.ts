import { NextRequest } from "next/server"
import { getTask, updateTask, deleteTask, tagsInput } from "@/lib/tasks/taskService"
import { route, BadRequest, requiredString, optionalString, optionalNumber, oneOf, clean } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants"

type Ctx = { params: Promise<{ id: string }> }

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const task = await getTask((await params).id)
  if (!task) throw new BadRequest("Task not found")
  return task
})

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  return updateTask(
    id,
    clean({
      title: b.title !== undefined ? requiredString(b.title, "Title") : undefined,
      description: optionalString(b.description),
      notes: optionalString(b.notes),
      status: oneOf(b.status, TASK_STATUSES, "status"),
      priority: oneOf(b.priority, TASK_PRIORITIES, "priority"),
      projectId: optionalString(b.projectId),
      milestoneId: optionalString(b.milestoneId),
      dueDate: parseDateInput(b.dueDate),
      scheduledDate: parseDateInput(b.scheduledDate),
      startTime: optionalString(b.startTime),
      endTime: optionalString(b.endTime),
      estimatedMinutes: optionalNumber(b.estimatedMinutes),
      tags: tagsInput(b.tags),
      order: optionalNumber(b.order) ?? undefined,
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteTask((await params).id)
  return { ok: true }
})
