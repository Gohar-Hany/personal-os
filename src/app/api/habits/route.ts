import { NextRequest } from "next/server"
import { createHabit, getAllHabits } from "@/lib/habits/habitService"
import { route, requiredString, optionalString, optionalNumber, oneOf } from "@/lib/http"
import { HABIT_CATEGORIES } from "@/lib/constants"

export const GET = route(async () => getAllHabits())

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  const weekdays = Array.isArray(b.weekdays) && b.weekdays.length > 0 && b.weekdays.length < 7 ? b.weekdays : null
  return createHabit({
    name: requiredString(b.name, "Habit name"),
    category: oneOf(b.category, HABIT_CATEGORIES, "category") ?? "Other",
    recurrence: weekdays ? "custom" : "daily",
    weekdays: weekdays ? JSON.stringify(weekdays) : null,
    targetValue: optionalNumber(b.targetValue),
    unit: optionalString(b.unit),
  })
})
