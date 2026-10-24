import { prisma } from "@/lib/prisma"
import { userClock } from "@/lib/userTime"
import { addDaysToKey, weekStartKey } from "@/lib/zone"
import { getWeekStats } from "@/lib/review/reviewService"
import { serialize } from "@/lib/utils"
import { WeeklyReviewClient } from "@/components/review/WeeklyReviewClient"

export const dynamic = "force-dynamic"

export default async function WeeklyReviewPage() {
  const clock = await userClock()
  const weekKey = clock.weekStart
  const [stats, reviews] = await Promise.all([
    getWeekStats(weekKey),
    prisma.weeklyReview.findMany({ orderBy: { weekStart: "desc" }, take: 30 }),
  ])
  // Match by calendar week in the user's zone — stored instants differ by where they were saved
  const current = reviews.find((r) => weekStartKey(clock.keyOf(r.weekStart)) === weekKey) ?? null

  return (
    <WeeklyReviewClient
      weekStart={weekKey}
      weekEnd={addDaysToKey(weekKey, 6)}
      stats={stats}
      current={current ? serialize(current) : null}
      past={serialize(reviews.filter((r) => r !== current))}
    />
  )
}
