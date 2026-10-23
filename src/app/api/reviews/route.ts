import { NextRequest } from "next/server"
import { addDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { route, optionalString, optionalNumber } from "@/lib/http"
import { parseDateInput, weekStartOf } from "@/lib/dates"
import { getWeekStats } from "@/lib/review/reviewService"

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
  const weekStart = weekStartOf(parseDateInput(b.weekStart) ?? new Date())
  const stats = await getWeekStats(weekStart)
  const data = { ...reviewText(b), ...stats, weekStart, weekEnd: addDays(weekStart, 6) }

  const existing = await prisma.weeklyReview.findFirst({ where: { weekStart } })
  if (existing) return prisma.weeklyReview.update({ where: { id: existing.id }, data })
  return prisma.weeklyReview.create({ data })
})
