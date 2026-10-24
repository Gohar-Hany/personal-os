"use client"

import { useMemo, useSyncExternalStore } from "react"
import { BookOpen, Check, ChevronLeft, Sparkles, Sunrise, Sunset } from "lucide-react"
import { cn } from "@/lib/utils"
import { adhkarProgress } from "@/components/faith/AdhkarReaderModal"
import { getQuranPageMeta } from "@/lib/faith/quranData"
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

/** Other religious habits (Quran and adhkar have their own cards in the hero). */
export function FaithCard({
  habits,
  onToggle,
  quranPage = 1,
  onOpenAdhkar,
  onOpenQuran,
}: {
  habits: TodayHabitDTO[]
  onToggle: (h: TodayHabitDTO) => void
  quranPage?: number
  onOpenAdhkar?: (type: "morning" | "evening") => void
  onOpenQuran?: () => void
}) {
  // Quran and adhkar live in the Today hero (FaithPractices); this card only holds other religious habits
  const others = habits.filter((h) => !h.isPrayer && !isQuranHabit(h) && !h.isAdhkar && h.category === "Religious")
  if (others.length === 0) return null

  return (
    <Card>
      <CardHeader
        title="Quran & adhkar"
        icon={<BookOpen />}
        tone="success"
        meta={`${others.filter((h) => h.done).length}/${others.length}`}
        href="/habits"
        hrefLabel="Habits"
      />
      <div className="space-y-1 p-2">
        {others.map((h) => {
          const isQuran = h.isQuran || h.name.toLowerCase().includes("quran") || h.name.includes("قرآن")
          const isMorning = h.isAdhkar && (h.name.toLowerCase().includes("morning") || h.name.includes("صباح"))
          const isEvening = h.isAdhkar && (h.name.toLowerCase().includes("evening") || h.name.includes("مساء"))

          let subText = ""
          let actionNode: React.ReactNode = null
          let onRowClick: (() => void) | undefined = undefined

          if (isQuran) {
            subText = `ص ${quranPage} - ${Math.min(604, quranPage + 1)}`
            onRowClick = onOpenQuran
            actionNode = (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenQuran?.()
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
                  h.done
                    ? "border-success/30 bg-success-soft text-success hover:bg-success/20"
                    : "border-primary/25 bg-primary-soft text-primary hover:bg-primary/20",
                )}
              >
                <BookOpen className="size-3.5" />
                <span>{h.done ? "مراجعة الورد" : `اقرأ ص ${quranPage}`}</span>
              </button>
            )
          } else if (isMorning) {
            subText = "بعد الفجر"
            onRowClick = () => onOpenAdhkar?.("morning")
            actionNode = (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenAdhkar?.("morning")
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
                  h.done
                    ? "border-success/30 bg-success-soft text-success hover:bg-success/20"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
                )}
              >
                <Sparkles className="size-3.5" />
                <span>{h.done ? "تمت · اقرأ ثانية" : "ابدأ الأذكار"}</span>
              </button>
            )
          } else if (isEvening) {
            subText = "بعد العصر"
            onRowClick = () => onOpenAdhkar?.("evening")
            actionNode = (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenAdhkar?.("evening")
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
                  h.done
                    ? "border-success/30 bg-success-soft text-success hover:bg-success/20"
                    : "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
                )}
              >
                <Sparkles className="size-3.5" />
                <span>{h.done ? "تمت · اقرأ ثانية" : "ابدأ الأذكار"}</span>
              </button>
            )
          } else {
            subText = h.targetValue ? `${h.targetValue} ${h.unit ?? ""}`.trim() : ""
            onRowClick = () => onToggle(h)
          }

          return (
            <Row
              key={h.id}
              checked={h.done}
              onToggle={() => onToggle(h)}
              onRowClick={onRowClick}
              title={h.name}
              sub={subText}
              right={actionNode}
            />
          )
        })}
      </div>
    </Card>
  )
}

function Row({
  checked,
  onToggle,
  onRowClick,
  title,
  sub,
  right,
  highlight,
}: {
  checked: boolean
  onToggle: () => void
  onRowClick?: () => void
  title: string
  sub?: string
  right?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      onClick={onRowClick || onToggle}
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 transition-all hover:bg-subtle",
        highlight && "bg-primary-soft hover:bg-primary-soft",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="shrink-0"
        >
          <CheckCircle checked={checked} onChange={onToggle} label={title} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium leading-tight truncate", checked && "text-muted-foreground line-through decoration-muted-foreground/50")}>
            {title}
          </p>
          {sub && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{sub}</p>}
        </div>
      </div>
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
              "relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 transition-all active:scale-95 lg:flex-row lg:gap-2.5 lg:px-3 lg:py-2 lg:text-left",
              habit.done
                ? "border-success/30 bg-success-soft"
                : isNow
                  ? "border-primary bg-primary-soft shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                  : "border-border bg-card/70",
            )}
          >
            <span className="flex flex-col items-center gap-1 lg:min-w-0 lg:flex-1 lg:items-start lg:gap-0">
              <span className={cn("text-[13px] font-semibold", habit.done ? "text-success" : isNow ? "text-primary" : upcoming ? "text-foreground" : "text-muted-foreground")}>{p.name}</span>
              <span className="text-[10px] text-muted-foreground" dir="rtl">{p.ar}</span>
            </span>
            <span className={cn("text-[11px] tabular lg:text-xs", isNow && !habit.done ? "font-semibold text-primary" : "text-muted-foreground")}>
              {isNow && !habit.done ? "Now" : time ? fmt(time).replace(/\s?(AM|PM)$/, "") : "—"}
            </span>
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] lg:order-first lg:mt-0",
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

export const isQuranHabit = (h: { isQuran?: boolean; name: string }) => !!h.isQuran || h.name.toLowerCase().includes("quran") || h.name.includes("قرآن")
export const adhkarHabit = (habits: TodayHabitDTO[], type: "morning" | "evening") =>
  habits.find((h) => h.isAdhkar && (type === "morning" ? /morning|صباح/i.test(h.name) : /evening|مساء/i.test(h.name)))

/** Saved adhkar progress on this device, as "done/total" (read without hydration mismatch). */
function useAdhkarProgress(type: "morning" | "evening", day: string) {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb)
      window.addEventListener("adhkar-progress", cb)
      return () => {
        window.removeEventListener("storage", cb)
        window.removeEventListener("adhkar-progress", cb)
      }
    },
    () => {
      const p = adhkarProgress(type, day)
      return `${p.done}/${p.total}`
    },
    () => "",
  )
}

/**
 * Morning adhkar, evening adhkar and the Quran portion as three cards under the prayers.
 * The one that's due now is highlighted.
 */
export function FaithPractices({
  habits,
  today,
  quranPage,
  times,
  now,
  onOpenAdhkar,
  onOpenQuran,
}: {
  habits: TodayHabitDTO[]
  today: string
  quranPage: number
  times: PrayerTimesResult | null
  now: Date | null
  onOpenAdhkar: (type: "morning" | "evening") => void
  onOpenQuran: () => void
}) {
  const morning = adhkarHabit(habits, "morning")
  const evening = adhkarHabit(habits, "evening")
  const quran = habits.find(isQuranHabit)
  const mProg = useAdhkarProgress("morning", today)
  const eProg = useAdhkarProgress("evening", today)
  if (!morning && !evening && !quran) return null

  const afterFajr = !!(times && now && now >= times.fajr)
  const afterAsr = !!(times && now && now >= times.asr)
  const per = Math.max(1, Math.round(quran?.targetValue ?? 2))
  const start = quran?.done ? Math.max(1, quranPage - per) : quranPage
  const end = Math.min(604, start + per - 1)
  const surah = getQuranPageMeta(start).surahNameAr

  return (
    <div className="grid grid-cols-3 gap-2" dir="rtl">
      {morning && (
        <PracticeCard
          title="أذكار الصباح"
          sub="بعد الفجر"
          icon={<Sunrise />}
          done={morning.done}
          due={afterFajr && !afterAsr}
          progress={mProg}
          onOpen={() => onOpenAdhkar("morning")}
        />
      )}
      {evening && (
        <PracticeCard
          title="أذكار المساء"
          sub="بعد العصر"
          icon={<Sunset />}
          done={evening.done}
          due={afterAsr}
          progress={eProg}
          onOpen={() => onOpenAdhkar("evening")}
        />
      )}
      {quran && (
        <PracticeCard
          title="ورد القرآن"
          sub={`${surah} · ص ${start}${end !== start ? `–${end}` : ""}`}
          icon={<BookOpen />}
          done={quran.done}
          due={!quran.done}
          bar={(end / 604) * 100}
          barLabel={`${Math.round((end / 604) * 100)}% من الختمة`}
          onOpen={onOpenQuran}
        />
      )}
    </div>
  )
}

function PracticeCard({
  title,
  sub,
  icon,
  done,
  due,
  progress,
  bar,
  barLabel,
  onOpen,
}: {
  title: string
  sub: string
  icon: React.ReactNode
  done: boolean
  due: boolean
  progress?: string
  bar?: number
  barLabel?: string
  onOpen: () => void
}) {
  const [d, t] = (progress ?? "").split("/").map(Number)
  const started = !done && d > 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-center transition-all active:scale-[0.98] sm:flex-row sm:gap-3 sm:p-3 sm:text-right",
        done ? "border-success/30 bg-success-soft/60" : due ? "border-primary/40 bg-card/80 ring-2 ring-primary/10" : "border-border bg-card/60",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 [&_svg]:size-5", done ? "bg-success text-white" : "bg-primary-soft text-primary")}>
        {done ? <Check strokeWidth={3} /> : icon}
      </span>
      <span className="w-full min-w-0 flex-1">
        <span className="block font-arabic text-[15px] leading-tight font-bold sm:text-lg">{title}</span>
        <span className="block truncate text-[10px] text-muted-foreground sm:text-xs">
          {done ? "تمّ اليوم ✓" : started ? `${d} من ${t} · أكمل` : sub}
        </span>
        {bar !== undefined && (
          <span className="mt-1.5 hidden items-center gap-2 sm:flex">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-success" style={{ width: `${bar}%` }} /></span>
            <span className="shrink-0 text-[10px] text-muted-foreground tabular">{barLabel}</span>
          </span>
        )}
        {started && t > 0 && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(d / t) * 100}%` }} /></span>
        )}
      </span>
      <ChevronLeft className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 sm:block" />
    </button>
  )
}
