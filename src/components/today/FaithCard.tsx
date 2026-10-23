"use client"

import { useMemo } from "react"
import { BookOpen, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { PrayerTimeService, type PrayerTimesResult } from "@/lib/prayer/PrayerTimeService"
import { Card, CardHeader } from "@/components/ui/card"
import { CheckCircle } from "@/components/ui/misc"
import { haptic } from "@/lib/hooks"
import type { TodayHabitDTO } from "@/types"

const PRAYERS = [
  { key: "fajr", name: "Fajr", ar: "الفجر" },
  { key: "dhuhr", name: "Dhuhr", ar: "الظهر" },
  { key: "asr", name: "Asr", ar: "العصر" },
  { key: "maghrib", name: "Maghrib", ar: "المغرب" },
  { key: "isha", name: "Isha", ar: "العشاء" },
] as const

export interface PrayerLocation {
  lat: number
  lng: number
  method: string
}

export function usePrayerTimes(loc: PrayerLocation, now: Date | null) {
  const day = now?.toDateString()
  return useMemo(() => {
    if (!now) return null
    return new PrayerTimeService({ latitude: loc.lat, longitude: loc.lng, method: loc.method }).getPrayerTimes(now)
  }, [loc.lat, loc.lng, loc.method, day]) // eslint-disable-line react-hooks/exhaustive-deps
}

const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

/** Next prayer today, or tomorrow's Fajr after Isha. */
export function nextPrayer(times: PrayerTimesResult | null, now: Date | null, loc: PrayerLocation) {
  if (!times || !now) return null
  const upcoming = PRAYERS.find((p) => times[p.key] > now)
  if (upcoming) return { name: upcoming.name, time: times[upcoming.key] }
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const t = new PrayerTimeService({ latitude: loc.lat, longitude: loc.lng, method: loc.method }).getPrayerTimes(tomorrow)
  return t ? { name: "Fajr", time: t.fajr } : null
}

export function untilLabel(target: Date, now: Date) {
  const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000))
  if (mins < 60) return `in ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `in ${h}h ${m}m` : `in ${h}h`
}

/** Quran and adhkar for today. */
export function FaithCard({ habits, onToggle }: { habits: TodayHabitDTO[]; onToggle: (h: TodayHabitDTO) => void }) {
  const others = habits.filter((h) => !h.isPrayer && (h.isQuran || h.isAdhkar || h.category === "Religious"))
  if (others.length === 0) return null

  return (
    <Card>
      <CardHeader title="Quran & adhkar" icon={<BookOpen />} tone="success" meta={`${others.filter((h) => h.done).length}/${others.length}`} href="/habits" hrefLabel="Habits" />
      <div className="pb-2">
        {others.map((h) => (
          <Row
            key={h.id}
            checked={h.done}
            onToggle={() => onToggle(h)}
            title={h.name}
            right={
              <span className="text-xs text-muted-foreground">
                {h.targetValue ? `${h.targetValue} ${h.unit ?? ""}`.trim() : h.name.toLowerCase().includes("morning") ? "after Fajr" : h.name.toLowerCase().includes("evening") ? "after Asr" : ""}
              </span>
            }
          />
        ))}
      </div>
    </Card>
  )
}

function Row({
  checked,
  onToggle,
  title,
  sub,
  right,
  highlight,
}: {
  checked: boolean
  onToggle: () => void
  title: string
  sub?: string
  right?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-subtle",
        highlight && "bg-primary-soft hover:bg-primary-soft",
      )}
    >
      <CheckCircle checked={checked} onChange={onToggle} label={title} />
      <span className={cn("flex-1 text-sm", checked && "text-muted-foreground line-through decoration-muted-foreground/50")}>
        {title}
        {sub && <span className="ml-2 text-xs text-muted-foreground" dir="rtl">{sub}</span>}
      </span>
      {right}
    </div>
  )
}

/** The day's five prayers as a tappable timeline — lives in the Today hero. */
export function PrayerStrip({
  habits,
  onToggle,
  times,
  now,
}: {
  habits: TodayHabitDTO[]
  onToggle: (h: TodayHabitDTO) => void
  times: PrayerTimesResult | null
  now: Date | null
}) {
  const prayerHabits = habits.filter((h) => h.isPrayer)
  const currentKey = useMemo(() => {
    if (!times || !now) return null
    let current: string | null = null
    for (const p of PRAYERS) if (times[p.key] <= now) current = p.key
    if (current === "fajr" && times.sunrise <= now) return null // Fajr window closes at sunrise
    return current
  }, [times, now])
  if (prayerHabits.length === 0) return null

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {PRAYERS.map((p) => {
        const habit = prayerHabits.find((h) => h.name.toLowerCase() === p.key)
        if (!habit) return <div key={p.key} />
        const time = times?.[p.key]
        const isNow = currentKey === p.key
        const upcoming = !!(time && now && time > now)
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              haptic()
              onToggle(habit)
            }}
            aria-pressed={habit.done}
            aria-label={`${p.name}${habit.done ? ", prayed" : ""}`}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 transition-all active:scale-95",
              habit.done
                ? "border-success/30 bg-success-soft"
                : isNow
                  ? "border-primary bg-primary-soft shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                  : "border-border bg-card/70",
            )}
          >
            <span className={cn("text-[13px] font-semibold", habit.done ? "text-success" : isNow ? "text-primary" : upcoming ? "text-foreground" : "text-muted-foreground")}>{p.name}</span>
            <span className="text-[10px] text-muted-foreground" dir="rtl">{p.ar}</span>
            <span className={cn("text-[11px] tabular", isNow && !habit.done ? "font-semibold text-primary" : "text-muted-foreground")}>
              {isNow && !habit.done ? "Now" : time ? fmt(time).replace(/\s?(AM|PM)$/, "") : "—"}
            </span>
            <span
              className={cn(
                "mt-0.5 flex size-5 items-center justify-center rounded-full border-[1.5px]",
                habit.done ? "animate-pop border-success bg-success text-white" : "border-border-strong text-transparent",
              )}
            >
              <Check className="size-3" strokeWidth={3.5} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
