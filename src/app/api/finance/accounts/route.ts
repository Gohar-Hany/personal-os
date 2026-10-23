import { NextRequest } from "next/server"
import { createAccount, getAccounts } from "@/lib/finance/financeService"
import { route, requiredString, optionalNumber, oneOf } from "@/lib/http"
import { CURRENCIES } from "@/lib/constants"

export const GET = route(async () => getAccounts())

export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  return createAccount({
    name: requiredString(b.name, "Account name"),
    type: oneOf(b.type, ["Bank", "Wallet", "Cash", "Other"] as const, "type") ?? "Bank",
    currency: oneOf(b.currency, CURRENCIES, "currency") ?? "EGP",
    openingBalance: optionalNumber(b.openingBalance) ?? 0,
  })
})
