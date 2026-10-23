import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { route, optionalString, optionalNumber, clean } from "@/lib/http"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  return prisma.weeklyReview.update({
    where: { id },
    data: clean({
      wins: optionalString(b.wins),
      challenges: optionalString(b.challenges),
      lessonsLearned: optionalString(b.lessonsLearned),
      nextWeekPriorities: optionalString(b.nextWeekPriorities),
      faithReflection: optionalString(b.faithReflection),
      overallRating: optionalNumber(b.overallRating),
    }),
  })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await prisma.weeklyReview.delete({ where: { id: (await params).id } })
  return { ok: true }
})
