// Server-side "what day is it for the user?" — the single source of truth for
// every day/week/month boundary computed on the server.
import { cache } from "react"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_TIME_ZONE, addDaysToKey, isValidTimeZone, weekStartKey, weekdayOfKey,
  zonedDayRange, zonedKey, zonedMonthRange,
} from "@/lib/zone"

/** Cookie the browser sets with its own IANA time zone (see AppProvider). */
export const TZ_COOKIE = "tz"

/**
 * The user's time zone: the device's zone (cookie) → the zone in Settings → Cairo.
 * Cached per request.
 */
export const getUserTimeZone = cache(async (): Promise<string> => {
  try {
    const fromCookie = (await cookies()).get(TZ_COOKIE)?.value
    if (fromCookie && isValidTimeZone(decodeURIComponent(fromCookie))) return decodeURIComponent(fromCookie)
  } catch {
    // Not in a request (scripts) — fall through
  }
  try {
    const s = await prisma.userSettings.findUnique({ where: { id: "default" }, select: { timezone: true } })
    if (isValidTimeZone(s?.timezone)) return s!.timezone
  } catch {}
  return DEFAULT_TIME_ZONE
})

export interface UserClock {
  tz: string
  /** Today's "YYYY-MM-DD" in the user's zone. */
  today: string
  /** "YYYY-MM" of today. */
  month: string
  /** Saturday that starts this week. */
  weekStart: string
  /** 0 = Sunday … 6 = Saturday for today. */
  weekday: number
  day: (key: string) => { start: Date; end: Date }
  monthRange: (month: string) => { start: Date; end: Date }
  /** Key of an instant in the user's zone. */
  keyOf: (instant: Date) => string
}

export const userClock = cache(async (): Promise<UserClock> => {
  const tz = await getUserTimeZone()
  const today = zonedKey(new Date(), tz)
  return {
    tz,
    today,
    month: today.slice(0, 7),
    weekStart: weekStartKey(today),
    weekday: weekdayOfKey(today),
    day: (key) => zonedDayRange(key, tz),
    monthRange: (month) => zonedMonthRange(month, tz),
    keyOf: (instant) => zonedKey(instant, tz),
  }
})

export { addDaysToKey }
