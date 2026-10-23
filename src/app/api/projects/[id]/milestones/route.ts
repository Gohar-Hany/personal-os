import { NextRequest } from "next/server"
import { createMilestone } from "@/lib/projects/projectService"
import { route, requiredString, optionalString } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: projectId } = await params
  const b = await req.json()
  return createMilestone({
    projectId,
    title: requiredString(b.title, "Milestone title"),
    description: optionalString(b.description) ?? undefined,
    dueDate: parseDateInput(b.dueDate),
  })
})
