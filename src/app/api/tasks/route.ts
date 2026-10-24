import { NextRequest } from "next/server"
import { createTask, getBacklogTasks, getTasks, tagsInput } from "@/lib/tasks/taskService"
import { route, requiredString, optionalString, optionalNumber, oneOf } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants"

export const GET = route(async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  if (params.get("view") === "backlog") return getBacklogTasks()
  return getTasks({ projectId: params.get("projectId") ?? undefined })
})

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  return createTask({
    title: requiredString(b.title, "Title"),
    description: optionalString(b.description) ?? undefined,
    notes: optionalString(b.notes),
    status: oneOf(b.status, TASK_STATUSES, "status"),
    priority: oneOf(b.priority, TASK_PRIORITIES, "priority"),
    projectId: optionalString(b.projectId) ?? undefined,
    milestoneId: optionalString(b.milestoneId),
    parentId: optionalString(b.parentId),
    dueDate: parseDateInput(b.dueDate),
    scheduledDate: parseDateInput(b.scheduledDate),
    startTime: optionalString(b.startTime),
    endTime: optionalString(b.endTime),
    estimatedMinutes: optionalNumber(b.estimatedMinutes),
    tags: tagsInput(b.tags) ?? undefined,
  })
})
