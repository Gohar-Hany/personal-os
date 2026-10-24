import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { route, optionalString, optionalNumber } from "@/lib/http"
import { findReviewForWeek, getWeekStats, weekBounds } from "@/lib/review/reviewService"
import { userClock } from "@/lib/userTime"
import { weekStartKey } from "@/lib/zone"

export const GET = route(async () => prisma.weeklyReview.findMany({ orderBy: { weekStart: "desc" }, take: 52 }))

function reviewText(b: Record<string, unknown>) {
  return {
    wins: optionalString(b.wins),
    challenges: optionalString(b.challenges),
    lessonsLearned: optionalString(b.lessonsLearned),
    nextWeekPriorities: optionalString(b.nextWeekPriorities),
    faithReflection: optionalString(b.faithReflection),
    overallRating: optionalNumber(b.overallRating),
  }
}

/** Creates the review for the given week, or updates it if one exists. Stats are snapshotted. */
export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  const clock = await userClock()
  const weekKey = weekStartKey(typeof b.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.weekStart) ? b.weekStart : clock.today)
  const stats = await getWeekStats(weekKey)
  const data = { ...reviewText(b), ...stats, ...weekBounds(weekKey) }

  const existing = await findReviewForWeek(weekKey)
  if (existing) return prisma.weeklyReview.update({ where: { id: existing.id }, data })
  return prisma.weeklyReview.create({ data })
})
