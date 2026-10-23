import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { route, requiredString, optionalString } from "@/lib/http"

export const GET = route(async () =>
  prisma.inboxItem.findMany({
    where: { status: { not: "Archived" } },
    orderBy: { createdAt: "desc" },
    take: 200,
  }),
)

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  return prisma.inboxItem.create({
    data: { content: requiredString(b.content, "Note"), type: optionalString(b.type) },
  })
})
