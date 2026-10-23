import { getGoals } from "@/lib/goals/goalService"
import { serialize } from "@/lib/utils"
import { GoalsClient } from "@/components/goals/GoalsClient"

export const dynamic = "force-dynamic"

export default async function GoalsPage() {
  const goals = await getGoals()
  return <GoalsClient goals={serialize(goals)} />
}
