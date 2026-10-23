import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { updateHabit, deleteHabit } from "@/lib/habits/habitService"
import { route, BadRequest, requiredString, optionalString, optionalNumber, oneOf, clean } from "@/lib/http"
import { HABIT_CATEGORIES } from "@/lib/constants"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  let schedule: { recurrence?: string; weekdays?: string | null } = {}
  if (b.weekdays !== undefined) {
    const days = Array.isArray(b.weekdays) && b.weekdays.length > 0 && b.weekdays.length < 7 ? b.weekdays : null
    schedule = { recurrence: days ? "custom" : "daily", weekdays: days ? JSON.stringify(days) : null }
  }
  return updateHabit(
    id,
    clean({
      name: b.name !== undefined ? requiredString(b.name, "Habit name") : undefined,
      category: oneOf(b.category, HABIT_CATEGORIES, "category"),
      targetValue: optionalNumber(b.targetValue),
      unit: optionalString(b.unit),
      isActive: typeof b.isActive === "boolean" ? b.isActive : undefined,
      ...schedule,
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const habit = await prisma.habit.findUnique({ where: { id } })
  // Prayers, Quran and Adhkar power the Today page — pause them instead of deleting.
  if (habit && (habit.isPrayer || habit.isQuran || habit.isAdhkar)) {
    throw new BadRequest("Built-in religious habits can be paused but not deleted")
  }
  await deleteHabit(id)
  return { ok: true }
})
