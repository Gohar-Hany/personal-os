import { addDays } from "date-fns"
import { getAllHabits, getHabitLogMap } from "@/lib/habits/habitService"
import { dateKey, todayStart, weekStartOf } from "@/lib/dates"
import { serialize } from "@/lib/utils"
import { HabitsClient } from "@/components/habits/HabitsClient"

export const dynamic = "force-dynamic"

export default async function HabitsPage() {
  // Enough history for streaks and the 30-day rate; older weeks load on demand.
  const from = dateKey(weekStartOf(addDays(todayStart(), -70)))
  const [habits, logs] = await Promise.all([getAllHabits(), getHabitLogMap(from, dateKey())])
  return <HabitsClient habits={serialize(habits)} logs={logs} loadedFrom={from} />
}
