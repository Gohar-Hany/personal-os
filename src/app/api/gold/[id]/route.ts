import { NextRequest } from "next/server"
import { deleteHolding, sellHolding, updateHolding } from "@/lib/finance/goldService"
import { route, optionalNumber, optionalString, clean } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"

type Ctx = { params: Promise<{ id: string }> }

/** Edit a gold item, or `{ sell: { soldFor, toAccountId?, date? } }` to sell it. */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  if (b.sell) {
    return sellHolding(id, {
      soldFor: optionalNumber(b.sell.soldFor) ?? 0,
      toAccountId: optionalString(b.sell.toAccountId),
      date: parseDateInput(b.sell.date),
    })
  }
  return updateHolding(
    id,
    clean({
      kind: optionalString(b.kind) ?? undefined,
      karat: optionalNumber(b.karat) ?? undefined,
      grams: optionalNumber(b.grams) ?? undefined,
      name: optionalString(b.name),
      boughtAt: parseDateInput(b.boughtAt),
      paid: optionalNumber(b.paid),
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteHolding((await params).id)
  return { ok: true }
})
