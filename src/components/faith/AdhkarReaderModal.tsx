"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronLeft, ChevronRight, ListChecks, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { ReaderShell } from "@/components/faith/ReaderShell"
import { MORNING_ADHKAR, EVENING_ADHKAR, type DhikrItem } from "@/lib/faith/adhkarData"

interface AdhkarReaderModalProps {
  isOpen: boolean
  onClose: () => void
  type: "morning" | "evening"
  onComplete?: () => void
  /** Day key — progress is remembered per day on this device. */
  today?: string
  /** Already marked done today (e.g. from another device). */
  alreadyDone?: boolean
}

type Remaining = Record<string, number>

const storageKey = (type: string, day: string) => `adhkar:${type}:${day}`

function loadProgress(type: string, day: string | undefined): Remaining | null {
  if (!day) return null
  try {
    const raw = localStorage.getItem(storageKey(type, day))
    return raw ? (JSON.parse(raw) as Remaining) : null
  } catch {
    return null
  }
}

/** Today's remembered progress for a set of adhkar (for the Today page cards). */
export function adhkarProgress(type: "morning" | "evening", day: string) {
  const list = type === "morning" ? MORNING_ADHKAR : EVENING_ADHKAR
  const saved = loadProgress(type, day)
  const done = saved ? list.filter((d) => (saved[d.id] ?? d.count) <= 0).length : 0
  return { done, total: list.length }
}

export function AdhkarReaderModal({ isOpen, onClose, type, onComplete, today, alreadyDone }: AdhkarReaderModalProps) {
  const list = type === "morning" ? MORNING_ADHKAR : EVENING_ADHKAR
  const title = type === "morning" ? "أذكار الصباح" : "أذكار المساء"

  const fresh = () => Object.fromEntries(list.map((d) => [d.id, d.count])) as Remaining
  const [remaining, setRemaining] = useState<Remaining>(fresh)
  const [index, setIndex] = useState(0)
  const [showList, setShowList] = useState(false)
  const [notified, setNotified] = useState(false)

  // Restore the day's progress each time the reader opens (state adjusted during render)
  const openKey = isOpen ? `${type}:${today ?? ""}` : null
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (openKey !== openedFor) {
    setOpenedFor(openKey)
    if (openKey) {
      const saved = loadProgress(type, today)
      const restored = { ...fresh(), ...(saved ?? {}) }
      if (!saved && alreadyDone) for (const d of list) restored[d.id] = 0
      setRemaining(restored)
      const firstOpen = list.findIndex((d) => (restored[d.id] ?? d.count) > 0)
      setIndex(firstOpen === -1 ? 0 : firstOpen)
      setShowList(false)
      setNotified(!!alreadyDone)
    }
  }

  // Remember progress on this device for today
  useEffect(() => {
    if (!isOpen || !today) return
    try {
      localStorage.setItem(storageKey(type, today), JSON.stringify(remaining))
      window.dispatchEvent(new Event("adhkar-progress"))
    } catch {}
  }, [remaining, isOpen, type, today])

  const doneCount = useMemo(() => list.filter((d) => remaining[d.id] <= 0).length, [list, remaining])
  const allDone = doneCount === list.length
  const item: DhikrItem = list[index] ?? list[0]
  const left = remaining[item.id] ?? item.count
  const itemDone = left <= 0

  const go = (i: number) => setIndex(Math.max(0, Math.min(list.length - 1, i)))
  const nextOpenAfter = (i: number, state: Remaining) => {
    for (let k = 1; k <= list.length; k++) {
      const j = (i + k) % list.length
      if (state[list[j].id] > 0) return j
    }
    return -1
  }

  const count = () => {
    if (itemDone) return
    haptic(10)
    const next = { ...remaining, [item.id]: left - 1 }
    setRemaining(next)
    if (left - 1 === 0) {
      haptic(25)
      const j = nextOpenAfter(index, next)
      if (j === -1) {
        if (!notified) {
          setNotified(true)
          onComplete?.()
        }
      } else {
        setTimeout(() => setIndex(j), 450)
      }
    }
  }

  const resetAll = () => {
    setRemaining(fresh())
    setIndex(0)
    setNotified(true) // don't log the habit twice
  }

  // Keyboard: Space/Enter counts, arrows move (RTL: left = next)
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        count()
      } else if (e.key === "ArrowLeft") go(index + 1)
      else if (e.key === "ArrowRight") go(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const ringPct = ((item.count - Math.max(0, left)) / item.count) * 100

  return (
    <ReaderShell
      open={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`${doneCount} من ${list.length} مكتمل`}
      progress={(doneCount / list.length) * 100}
      actions={
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          aria-pressed={showList}
          aria-label="كل الأذكار"
          title="كل الأذكار"
          className={cn("flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", showList && "bg-primary-soft text-primary")}
        >
          <ListChecks className="size-5" />
        </button>
      }
      footer={
        !showList && !allDone ? (
          <div className="flex items-center justify-between gap-4">
            <NavButton label="السابق" onClick={() => go(index - 1)} disabled={index === 0}><ChevronRight className="size-5" /></NavButton>
            <button
              type="button"
              onClick={count}
              aria-label={itemDone ? "تم" : `اضغط للعدّ، المتبقي ${left}`}
              className="group relative flex size-[88px] shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95"
            >
              <CounterRing pct={ringPct} done={itemDone} />
              <span className="relative flex flex-col items-center leading-none">
                {itemDone ? (
                  <Check className="size-8 text-success" strokeWidth={3} />
                ) : (
                  <>
                    <span className="text-3xl font-semibold tabular">{left}</span>
                    <span className="mt-1 text-[10px] text-muted-foreground">من {item.count}</span>
                  </>
                )}
              </span>
            </button>
            <NavButton label="التالي" onClick={() => go(index + 1)} disabled={index === list.length - 1}><ChevronLeft className="size-5" /></NavButton>
          </div>
        ) : undefined
      }
    >
      {allDone && !showList ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-success-soft text-success">
            <Sparkles className="size-10" />
          </div>
          <h3 className="font-arabic text-3xl font-bold">تقبّل الله منك</h3>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">أتممت {title} كاملة، وتم تسجيلها في يومك.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" size="md" onClick={onClose} className="rounded-xl px-8">تم</Button>
            <Button variant="outline" size="md" onClick={resetAll} className="rounded-xl"><RotateCcw /> قراءة مرة أخرى</Button>
          </div>
        </div>
      ) : showList ? (
        <div className="h-full overflow-y-auto p-3 sm:p-4">
          {list.map((d, i) => {
            const l = remaining[d.id] ?? d.count
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setIndex(i)
                  setShowList(false)
                }}
                className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-right hover:bg-muted", i === index && "bg-primary-soft")}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular", l <= 0 ? "bg-success text-white" : "bg-muted text-muted-foreground")}>
                  {l <= 0 ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-arabic text-lg leading-snug">{d.title ?? d.text.slice(0, 40)}</span>
                  <span className="block text-xs text-muted-foreground">{l <= 0 ? "تم" : d.count > 1 ? `متبقي ${l} من ${d.count}` : "مرة واحدة"}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div
          onClick={count}
          className={cn("h-full cursor-pointer overflow-y-auto select-none", itemDone && "cursor-default")}
          role="button"
          aria-label="اضغط في أي مكان للعدّ"
          tabIndex={-1}
        >
          <article className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-5 px-5 py-8 text-center sm:px-8">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="tabular">{index + 1} / {list.length}</span>
              {item.title && <span className="rounded-full bg-primary-soft px-3 py-1 font-arabic text-sm font-bold text-primary">{item.title}</span>}
            </div>
            <p className={cn("font-arabic text-[23px] leading-[2.15] whitespace-pre-line text-foreground sm:text-[27px]", itemDone && "text-muted-foreground")}>{item.text}</p>
            {item.virtue && (
              <p className="mx-auto max-w-md rounded-2xl bg-success-soft px-4 py-2.5 font-arabic text-base leading-relaxed text-success">{item.virtue}</p>
            )}
            {item.reference && <p className="text-xs text-muted-foreground">{item.reference}</p>}
            <p className="text-[11px] text-muted-foreground/70">{itemDone ? "تم هذا الذكر ✓" : "اضغط في أي مكان للعدّ"}</p>
          </article>
        </div>
      )}
    </ReaderShell>
  )
}

function CounterRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 88 88" className="absolute inset-0 -rotate-90">
      <circle cx="44" cy="44" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        className={cn("transition-[stroke-dashoffset] duration-300", done ? "stroke-success" : "stroke-primary")}
      />
    </svg>
  )
}

function NavButton({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1 rounded-2xl border border-border bg-card text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
      <span>{label}</span>
    </button>
  )
}
