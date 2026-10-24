import { NextRequest } from "next/server"
import { createDebt, getDebts, DIRECTIONS } from "@/lib/finance/debtService"
import { route, requiredString, optionalString, optionalNumber, oneOf, BadRequest } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"

export const GET = route(async () => getDebts())

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  const direction = oneOf(b.direction, DIRECTIONS, "direction")
  if (!direction) throw new BadRequest("Pick who owes whom")
  return createDebt({
    direction,
    person: requiredString(b.person, "Name"),
    amount: optionalNumber(b.amount) ?? 0,
    description: optionalString(b.description),
    category: optionalString(b.category),
    date: parseDateInput(b.date),
    accountId: optionalString(b.accountId),
  })
})
