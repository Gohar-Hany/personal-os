import { NextRequest } from "next/server"
import { createHolding, getGoldOverview } from "@/lib/finance/goldService"
import { route, optionalNumber, optionalString, BadRequest } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"

export const GET = route(async () => getGoldOverview())

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  const grams = optionalNumber(b.grams)
  if (!grams) throw new BadRequest("Enter the weight")
  return createHolding({
    kind: optionalString(b.kind) ?? undefined,
    karat: optionalNumber(b.karat) ?? undefined,
    grams,
    name: optionalString(b.name),
    boughtAt: parseDateInput(b.boughtAt),
    paid: optionalNumber(b.paid),
    fromAccountId: optionalString(b.fromAccountId),
  })
})
