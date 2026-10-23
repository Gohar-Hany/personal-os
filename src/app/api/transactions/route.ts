import { NextRequest } from "next/server"
import { createTransaction, getTransactions } from "@/lib/finance/financeService"
import { route, optionalString } from "@/lib/http"
import { parseTransaction } from "@/lib/finance/parseTransaction"

export const GET = route(async (req: NextRequest) => {
  const params = new URL(req.url).searchParams
  const month = params.get("month") ?? undefined
  return getTransactions({ month, limit: month ? undefined : Number(params.get("limit")) || 50 })
})

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  const t = parseTransaction(b, false)
  return createTransaction({
    ...t,
    type: t.type!,
    amount: t.amount!,
    currency: optionalString(b.currency) ?? "EGP",
    date: t.date ?? new Date(),
  })
})
