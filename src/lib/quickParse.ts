// Natural-language quick add:
//   "Call BOTIPIA owner tomorrow 8pm #botipia !high"
// → title "Call BOTIPIA owner", scheduled tomorrow at 20:00, project BOTIPIA, priority High.
import { addDays, nextDay, type Day } from "date-fns"
import { dateKey, todayStart } from "@/lib/dates"

export interface ParsedTask {
  title: string
  scheduledDate?: string // YYYY-MM-DD
  startTime?: string // HH:MM
  endTime?: string
  priority?: string
  projectId?: string
  tokens: { kind: "date" | "time" | "priority" | "project"; label: string }[]
}

const WEEKDAY_WORDS: Record<string, Day> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
}

const PRIORITY_WORDS: Record<string, string> = {
  "!!!": "Critical", "!1": "Critical", "!urgent": "Critical", "!critical": "Critical",
  "!!": "High", "!2": "High", "!high": "High",
  "!3": "Medium", "!med": "Medium", "!medium": "Medium",
  "!4": "Low", "!low": "Low",
}

function to24h(h: number, m: number, mer?: string) {
  if (mer === "pm" && h < 12) h += 12
  if (mer === "am" && h === 12) h = 0
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")

export function parseQuickTask(
  input: string,
  projects: { id: string; name: string }[] = [],
): ParsedTask {
  let text = ` ${input} `
  const result: ParsedTask = { title: "", tokens: [] }
  const today = todayStart()

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    const m = text.match(re)
    if (m && fn(m)) text = text.replace(m[0], " ")
  }

  // Project: #name — matched against project names (prefix, ignoring spaces/case)
  take(/\s#([^\s#!]+)/u, (m) => {
    const q = norm(m[1])
    const p =
      projects.find((p) => norm(p.name) === q) ??
      projects.find((p) => norm(p.name).startsWith(q)) ??
      projects.find((p) => norm(p.name).includes(q))
    if (!p) return false
    result.projectId = p.id
    result.tokens.push({ kind: "project", label: p.name })
    return true
  })

  // Priority: !high, !!, !1 …
  take(/\s(!!!|!!|![a-z0-9]+)(?=\s)/i, (m) => {
    const p = PRIORITY_WORDS[m[1].toLowerCase()]
    if (!p) return false
    result.priority = p
    result.tokens.push({ kind: "priority", label: p === "Critical" ? "Urgent" : p })
    return true
  })

  // Time range "20:00-21:30", "8pm-9pm", or single "at 8pm" / "8:30pm" / "20:00"
  take(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\s?[-–]\s?(\d{1,2})(?::(\d{2}))?\s?(am|pm)?(?=\s)/i, (m) => {
    if (!m[2] && !m[3] && !m[5] && !m[6]) return false
    const endMer = m[6]?.toLowerCase()
    const startMer = m[3]?.toLowerCase() ?? endMer
    result.startTime = to24h(Number(m[1]), Number(m[2] ?? 0), startMer)
    result.endTime = to24h(Number(m[4]), Number(m[5] ?? 0), endMer)
    result.tokens.push({ kind: "time", label: `${result.startTime}–${result.endTime}` })
    return true
  })
  if (!result.startTime) {
    take(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)|\s(?:at\s)?(\d{1,2}):(\d{2})(?=\s)/i, (m) => {
      const h = Number(m[1] ?? m[4])
      const min = Number(m[2] ?? m[5] ?? 0)
      if (h > 23 || min > 59) return false
      result.startTime = to24h(h, min, m[3]?.toLowerCase())
      result.tokens.push({ kind: "time", label: result.startTime })
      return true
    })
  }

  // Dates
  const setDate = (d: Date, label: string) => {
    result.scheduledDate = dateKey(d)
    result.tokens.push({ kind: "date", label })
  }
  take(/\s(today|tod|tonight|النهارده|اليوم)(?=\s)/i, () => (setDate(today, "Today"), true))
  if (!result.scheduledDate)
    take(/\s(tomorrow|tmr|tmrw|بكرة|بكره|غدا)(?=\s)/i, () => (setDate(addDays(today, 1), "Tomorrow"), true))
  if (!result.scheduledDate)
    take(/\s(next week)(?=\s)/i, () => (setDate(addDays(today, 7), "Next week"), true))
  // Full weekday names anywhere ("friday"); short forms only after "on" ("on fri"),
  // so ordinary words like "sun" or "sat" in a title are left alone.
  if (!result.scheduledDate)
    take(/\s(?:on\s)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?=\s)|\son\s(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?=\s)/i, (m) => {
      const day = WEEKDAY_WORDS[(m[1] ?? m[2]).toLowerCase()]
      if (day === undefined) return false
      const d = nextDay(today, day)
      setDate(d, d.toLocaleDateString("en-US", { weekday: "short" }))
      return true
    })

  // A time without a date means today
  if (result.startTime && !result.scheduledDate) {
    result.scheduledDate = dateKey(today)
    result.tokens.push({ kind: "date", label: "Today" })
  }

  result.title = text.replace(/\s+/g, " ").trim()
  return result
}
