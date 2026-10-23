import { NextRequest } from "next/server"
import { createProject, getProjects } from "@/lib/projects/projectService"
import { route, requiredString, optionalString, oneOf } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants"

export const GET = route(async () => getProjects())

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  return createProject({
    name: requiredString(b.name, "Project name"),
    description: optionalString(b.description),
    status: oneOf(b.status, PROJECT_STATUSES, "status") ?? "Active",
    priority: oneOf(b.priority, PROJECT_PRIORITIES, "priority") ?? "P2",
    goalId: optionalString(b.goalId),
    deadline: parseDateInput(b.deadline),
  })
})
