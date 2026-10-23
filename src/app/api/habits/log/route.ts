import { NextRequest } from "next/server"
import { getHabitLogMap, logHabit } from "@/lib/habits/habitService"
import { route, BadRequest, requiredString } from "@/lib/http"
import { dateKey } from "@/lib/dates"

const KEY = /^\d{4}-\d{2}-\d{2}$/

export const GET = route(async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  if (!KEY.test(from) || !KEY.test(to)) throw new BadRequest("from and to must be YYYY-MM-DD")
  return getHabitLogMap(from, to)
})

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  const habitId = requiredString(b.habitId, "habitId")
  const date = typeof b.date === "string" && KEY.test(b.date) ? b.date : dateKey()
  if (date > dateKey()) throw new BadRequest("You can't complete a habit in the future")
  return logHabit(habitId, Boolean(b.completed), date, typeof b.value === "number" ? b.value : undefined)
})
