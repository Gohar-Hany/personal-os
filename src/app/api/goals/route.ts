import { NextRequest } from "next/server"
import { createGoal, getGoals } from "@/lib/goals/goalService"
import { route, requiredString, optionalString, optionalNumber, oneOf } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { GOAL_CATEGORIES, GOAL_STATUSES } from "@/lib/constants"

export const GET = route(async () => getGoals())

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  return createGoal({
    name: requiredString(b.name, "Goal name"),
    description: optionalString(b.description),
    category: oneOf(b.category, GOAL_CATEGORIES, "category") ?? "Other",
    status: oneOf(b.status, GOAL_STATUSES, "status"),
    targetValue: optionalNumber(b.targetValue),
    currentValue: optionalNumber(b.currentValue) ?? 0,
    unit: optionalString(b.unit),
    deadline: parseDateInput(b.deadline ?? b.targetDate),
  })
})
