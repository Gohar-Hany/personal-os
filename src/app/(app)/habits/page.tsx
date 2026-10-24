import { getAllHabits, getHabitLogMap } from "@/lib/habits/habitService"
import { userClock } from "@/lib/userTime"
import { addDaysToKey, weekStartKey } from "@/lib/zone"
import { serialize } from "@/lib/utils"
import { HabitsClient } from "@/components/habits/HabitsClient"

export const dynamic = "force-dynamic"

export default async function HabitsPage() {
  // Enough history for streaks and the 30-day rate; older weeks load on demand.
  const clock = await userClock()
  const from = weekStartKey(addDaysToKey(clock.today, -70))
  const [habits, logs] = await Promise.all([getAllHabits(), getHabitLogMap(from, clock.today)])
  return <HabitsClient habits={serialize(habits)} logs={logs} loadedFrom={from} today={clock.today} />
}
