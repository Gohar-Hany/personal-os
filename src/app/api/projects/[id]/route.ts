import { NextRequest } from "next/server"
import { updateProject, deleteProject } from "@/lib/projects/projectService"
import { route, requiredString, optionalString, oneOf, clean } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  return updateProject(
    id,
    clean({
      name: b.name !== undefined ? requiredString(b.name, "Project name") : undefined,
      description: optionalString(b.description),
      status: oneOf(b.status, PROJECT_STATUSES, "status"),
      priority: oneOf(b.priority, PROJECT_PRIORITIES, "priority"),
      goalId: optionalString(b.goalId),
      deadline: parseDateInput(b.deadline),
      isFocus: typeof b.isFocus === "boolean" ? b.isFocus : undefined,
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteProject((await params).id)
  return { ok: true }
})
