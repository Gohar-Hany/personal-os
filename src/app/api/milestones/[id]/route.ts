import { NextRequest } from "next/server"
import { updateMilestone, deleteMilestone } from "@/lib/projects/projectService"
import { route, requiredString, optionalString, optionalNumber, oneOf, clean } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  return updateMilestone(
    id,
    clean({
      title: b.title !== undefined ? requiredString(b.title, "Milestone title") : undefined,
      description: optionalString(b.description),
      status: oneOf(b.status, ["Active", "Completed", "Cancelled"] as const, "status"),
      dueDate: parseDateInput(b.dueDate),
      order: optionalNumber(b.order) ?? undefined,
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteMilestone((await params).id)
  return { ok: true }
})
