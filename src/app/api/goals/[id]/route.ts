import { NextRequest } from "next/server"
import { updateGoal, deleteGoal } from "@/lib/goals/goalService"
import { route, requiredString, optionalString, optionalNumber, oneOf, clean } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { GOAL_CATEGORIES, GOAL_STATUSES } from "@/lib/constants"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  return updateGoal(
    id,
    clean({
      name: b.name !== undefined ? requiredString(b.name, "Goal name") : undefined,
      description: optionalString(b.description),
      category: oneOf(b.category, GOAL_CATEGORIES, "category"),
      status: oneOf(b.status, GOAL_STATUSES, "status"),
      targetValue: optionalNumber(b.targetValue),
      currentValue: optionalNumber(b.currentValue) ?? undefined,
      unit: optionalString(b.unit),
      deadline: parseDateInput(b.deadline),
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteGoal((await params).id)
  return { ok: true }
})
