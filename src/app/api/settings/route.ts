import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { route, BadRequest, requiredString, optionalNumber, oneOf, clean } from "@/lib/http"
import { CURRENCIES } from "@/lib/constants"

export const GET = route(async () => prisma.userSettings.findUnique({ where: { id: "default" } }))

export const PATCH = route(async (req: NextRequest) => {
  const b = await req.json()
  const latitude = optionalNumber(b.latitude)
  const longitude = optionalNumber(b.longitude)
  if (latitude != null && Math.abs(latitude) > 90) throw new BadRequest("Latitude must be between -90 and 90")
  if (longitude != null && Math.abs(longitude) > 180) throw new BadRequest("Longitude must be between -180 and 180")
  const charity = optionalNumber(b.charityPercentage)
  if (charity != null && (charity < 0 || charity > 100)) throw new BadRequest("Charity % must be between 0 and 100")

  const data = clean({
    name: b.name !== undefined ? requiredString(b.name, "Name") : undefined,
    location: b.location !== undefined ? String(b.location).trim() : undefined,
    timezone: b.timezone !== undefined ? String(b.timezone).trim() : undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    defaultCurrency: oneOf(b.defaultCurrency, CURRENCIES, "currency"),
    charityPercentage: charity ?? undefined,
    prayerMethod: b.prayerMethod !== undefined ? String(b.prayerMethod) : undefined,
    quranPage: optionalNumber(b.quranPage) ?? undefined,
    theme: oneOf(b.theme, ["light", "dark", "system"] as const, "theme"),
  })
  return prisma.userSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data })
})
