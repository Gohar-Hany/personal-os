import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { route, requiredString, optionalString, oneOf, clean } from "@/lib/http"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  const status = oneOf(b.status, ["Pending", "Processed", "Archived"] as const, "status")
  return prisma.inboxItem.update({
    where: { id },
    data: clean({
      content: b.content !== undefined ? requiredString(b.content, "Note") : undefined,
      status,
      isProcessed: status ? status !== "Pending" : undefined,
      convertedTo: optionalString(b.convertedTo),
      convertedId: optionalString(b.convertedId),
    }),
  })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await prisma.inboxItem.delete({ where: { id: (await params).id } })
  return { ok: true }
})
