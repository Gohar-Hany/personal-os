import { addDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { dateKey, weekStartOf } from "@/lib/dates"
import { getWeekStats } from "@/lib/review/reviewService"
import { serialize } from "@/lib/utils"
import { WeeklyReviewClient } from "@/components/review/WeeklyReviewClient"

export const dynamic = "force-dynamic"

export default async function WeeklyReviewPage() {
  const weekStart = weekStartOf()
  const [stats, reviews] = await Promise.all([
    getWeekStats(weekStart),
    prisma.weeklyReview.findMany({ orderBy: { weekStart: "desc" }, take: 30 }),
  ])
  const current = reviews.find((r) => r.weekStart.getTime() === weekStart.getTime()) ?? null

  return (
    <WeeklyReviewClient
      weekStart={dateKey(weekStart)}
      weekEnd={dateKey(addDays(weekStart, 6))}
      stats={stats}
      current={current ? serialize(current) : null}
      past={serialize(reviews.filter((r) => r !== current))}
    />
  )
}
