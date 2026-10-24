import { NextRequest } from "next/server"
import { setManualPrice, resetToLivePrice } from "@/lib/finance/goldService"
import { route, optionalNumber } from "@/lib/http"

/** `{ price, karat }` — a shop's price per gram, used for the rest of today. */
export const POST = route(async (req: NextRequest) => {
  const b = await req.json()
  return setManualPrice(optionalNumber(b.price) ?? 0, optionalNumber(b.karat) ?? 21)
})

/** Back to the live price. */
export const DELETE = route(async () => resetToLivePrice())
