import { NextRequest } from "next/server"
import { updateTransaction, deleteTransaction } from "@/lib/finance/financeService"
import { route, clean } from "@/lib/http"
import { parseTransaction } from "@/lib/finance/parseTransaction"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  return updateTransaction(id, clean(parseTransaction(await req.json(), true)))
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteTransaction((await params).id)
  return { ok: true }
})
