import { NextRequest } from "next/server"
import { updateAccount, deleteAccount } from "@/lib/finance/financeService"
import { route, requiredString, optionalNumber, oneOf, clean } from "@/lib/http"
import { CURRENCIES } from "@/lib/constants"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  return updateAccount(
    id,
    clean({
      name: b.name !== undefined ? requiredString(b.name, "Account name") : undefined,
      type: oneOf(b.type, ["Bank", "Wallet", "DigitalWallet", "Cash", "Other"] as const, "type"),
      currency: oneOf(b.currency, CURRENCIES, "currency"),
      openingBalance: optionalNumber(b.openingBalance) ?? undefined,
      isActive: typeof b.isActive === "boolean" ? b.isActive : undefined,
    }),
  )
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  await deleteAccount((await params).id)
  return { ok: true }
})
