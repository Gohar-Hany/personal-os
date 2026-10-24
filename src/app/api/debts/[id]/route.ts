import { NextRequest } from "next/server"
import { deleteDebt, reopenDebt, settleDebt } from "@/lib/finance/debtService"
import { route, optionalString } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"

type Ctx = { params: Promise<{ id: string }> }

/** `{ settle: { accountId?, date? } }` closes it; `{ reopen: true }` undoes that. */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  if (b.reopen) return reopenDebt(id)
  // accountId left out → back into the account it was paid from
  return settleDebt(id, { accountId: b.settle && "accountId" in b.settle ? optionalString(b.settle.accountId) : undefined, date: parseDateInput(b.settle?.date) })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteDebt((await params).id)
  return { ok: true }
})
