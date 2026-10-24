import { NextRequest } from "next/server"
import { getHabitLogMap, logHabit } from "@/lib/habits/habitService"
import { route, BadRequest, requiredString } from "@/lib/http"
import { userClock } from "@/lib/userTime"

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
  const { today } = await userClock()
  const date = typeof b.date === "string" && KEY.test(b.date) ? b.date : today
  if (date > today) throw new BadRequest("You can't complete a habit in the future")
  return logHabit(habitId, Boolean(b.completed), date, typeof b.value === "number" ? b.value : undefined)
})
