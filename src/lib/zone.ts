// Time-zone-aware calendar math. Pure functions — safe on the server and in the browser.
//
// Why this exists: the app is deployed on Vercel, whose servers run in UTC, while
// the user lives in Cairo (UTC+2/+3). Anything that asks the *server's* clock
// "what day is it?" is wrong for 2–3 hours every night. All day/week/month
// boundaries on the server must be computed in the user's zone with these helpers.

export const DEFAULT_TIME_ZONE = "Africa/Cairo"

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** "YYYY-MM-DD" of an instant as seen in `tz`. */
export function zonedKey(instant: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}

/** Milliseconds `tz` is ahead of UTC at `instant` (e.g. +3h for Cairo in summer). */
function offsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** The instant when calendar day `key` begins in `tz` (handles DST changes). */
export function zonedMidnight(key: string, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  const guess = Date.UTC(y, m - 1, d)
  let t = guess - offsetMs(new Date(guess), tz)
  const corrected = guess - offsetMs(new Date(t), tz)
  if (corrected !== t) t = corrected
  return new Date(t)
}

// ─── Pure calendar arithmetic on "YYYY-MM-DD" keys (no time zone involved) ───

export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday, for the calendar date itself. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Saturday that starts the week containing `key` (Egyptian week: Sat–Fri). */
export function weekStartKey(key: string): string {
  const back = (weekdayOfKey(key) - 6 + 7) % 7
  return addDaysToKey(key, -back)
}

/**
 * Canonical storage for a date-only value ("do on", deadline, transaction day):
 * 12:00 UTC of that calendar date. It reads as the same day in every zone from
 * UTC−11 to UTC+11, so it never drifts when shown on a phone or compared on a server.
 */
export function dateOnlyInstant(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

/** [start, end) of calendar day `key` in `tz`. */
export function zonedDayRange(key: string, tz: string) {
  return { start: zonedMidnight(key, tz), end: zonedMidnight(addDaysToKey(key, 1), tz) }
}

/** [start, end) of month "YYYY-MM" in `tz`. */
export function zonedMonthRange(month: string, tz: string) {
  const [y, m] = month.split("-").map(Number)
  const first = `${month}-01`
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
  return { start: zonedMidnight(first, tz), end: zonedMidnight(next, tz) }
}
