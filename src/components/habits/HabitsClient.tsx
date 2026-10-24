"use client"

import { useMemo, useState } from "react"
import { addDays, format, isSameDay } from "date-fns"
import { Activity, Check, ChevronLeft, ChevronRight, Flame, Minus, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { dateKey, parseDateKey } from "@/lib/dates"
import { weekStartKey } from "@/lib/zone"
import { appliesOn, describeRecurrence } from "@/lib/habits/recurrence"
import { useSynced } from "@/lib/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"
import { useApp } from "@/components/app/AppProvider"
import { HabitDialog } from "@/components/habits/HabitDialog"
import type { HabitDTO } from "@/types"

type Logs = Record<string, boolean>

/** Consecutive applicable days completed, ending today (or yesterday if today isn't done yet). */
function streakOf(h: HabitDTO, logs: Logs, today: Date) {
  let streak = 0
  let d = today
  if (!logs[`${h.id}_${dateKey(d)}`]) d = addDays(d, -1)
  for (let i = 0; i < 365; i++, d = addDays(d, -1)) {
    if (!appliesOn(h, d)) continue
    if (!logs[`${h.id}_${dateKey(d)}`]) break
    streak++
  }
  return streak
}

/** Completion over the last 30 days the habit applied. */
function rate30(h: HabitDTO, logs: Logs, today: Date) {
  let hit = 0
  let total = 0
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i)
    if (!appliesOn(h, d)) continue
    total++
    if (logs[`${h.id}_${dateKey(d)}`]) hit++
  }
  return total ? Math.round((hit / total) * 100) : 0
}

export function HabitsClient({
  habits: serverHabits,
  logs: serverLogs,
  loadedFrom,
  today: todayKey,
}: {
  habits: HabitDTO[]
  logs: Logs
  loadedFrom: string
  /** The user's today from the server, so the grid and the server agree on which day is "today". */
  today: string
}) {
  const today = parseDateKey(todayKey)
  const thisWeek = parseDateKey(weekStartKey(todayKey))
  const { refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [habits, setHabits] = useSynced(serverHabits)
  // Recent logs come from the server (and reset on refresh); older weeks are fetched on demand.
  const [recent, setRecent] = useSynced(serverLogs)
  const [older, setOlder] = useState<Logs>({})
  const [from, setFrom] = useState(loadedFrom)
  const logs = useMemo(() => ({ ...older, ...recent }), [older, recent])
  const setLog = (key: string, value: boolean) =>
    key.slice(-10) < loadedFrom ? setOlder((l) => ({ ...l, [key]: value })) : setRecent((l) => ({ ...l, [key]: value }))
  const [weekOffset, setWeekOffset] = useState(0)
  const [dialog, setDialog] = useState<{ habit: HabitDTO | null } | null>(null)

  const weekStart = addDays(thisWeek, weekOffset * 7)
  const weekKey = weekStart.getTime()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(weekKey), i)), [weekKey])

  const goWeek = async (delta: number) => {
    const next = weekOffset + delta
    if (next > 0) return
    setWeekOffset(next)
    const start = dateKey(addDays(thisWeek, next * 7))
    if (start < from) {
      try {
        const more = await api<Logs>(`/api/habits/log?from=${start}&to=${from}`)
        setOlder((l) => ({ ...more, ...l }))
        setFrom(start)
      } catch (err) {
        toast.error((err as Error).message)
      }
    }
  }

  const toggle = async (h: HabitDTO, d: Date) => {
    const key = `${h.id}_${dateKey(d)}`
    const done = !logs[key]
    setLog(key, done)
    try {
      await api("/api/habits/log", { body: { habitId: h.id, completed: done, date: dateKey(d) } })
      refresh()
    } catch (err) {
      setLog(key, !done)
      toast.error((err as Error).message)
    }
  }

  const setActive = async (h: HabitDTO, isActive: boolean) => {
    setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, isActive } : x)))
    try {
      await api(`/api/habits/${h.id}`, { method: "PATCH", body: { isActive } })
      toast.success(isActive ? `${h.name} resumed` : `${h.name} paused — it won't appear on Today`)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
      refresh()
    }
  }

  const remove = async (h: HabitDTO) => {
    const ok = await confirm({ title: `Delete “${h.name}”?`, message: "Its history will be deleted too. Pausing keeps the history.", confirmLabel: "Delete", danger: true })
    if (!ok) return
    setHabits((list) => list.filter((x) => x.id !== h.id))
    api(`/api/habits/${h.id}`, { method: "DELETE" }).then(refresh).catch((err) => {
      toast.error(err.message)
      refresh()
    })
  }

  const active = habits.filter((h) => h.isActive)
  const paused = habits.filter((h) => !h.isActive)
  const groups = [
    { title: "Faith", items: active.filter((h) => h.category === "Religious") },
    { title: "Personal", items: active.filter((h) => h.category !== "Religious") },
  ].filter((g) => g.items.length)

  const rangeLabel = `${format(days[0], "MMM d")} – ${format(days[6], "MMM d")}`

  return (
    <div className="space-y-5">
      <PageHeader
        title="Habits"
        description={<span className="hidden sm:inline">Tick any day of the week. Dashes are days a habit isn&apos;t scheduled.</span>}
        actions={
          <Button variant="primary" onClick={() => setDialog({ habit: null })}>
            <Plus /> New habit
          </Button>
        }
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => goWeek(-1)} aria-label="Previous week"><ChevronLeft /></Button>
          <Button size="icon-sm" variant="ghost" onClick={() => goWeek(1)} disabled={weekOffset === 0} aria-label="Next week"><ChevronRight /></Button>
          <span className="ml-1 text-[13px] font-medium">{weekOffset === 0 ? "This week" : rangeLabel}</span>
          {weekOffset === 0 && <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{rangeLabel}</span>}
        </div>
        {weekOffset !== 0 && <Button size="xs" variant="ghost" onClick={() => setWeekOffset(0)}>Back to this week</Button>}
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState icon={<Activity />} title="No active habits" description="Add something you want to do regularly — it shows up on Today when it's due." />
        </Card>
      ) : (
        <>
        <MobileHabits
          groups={groups}
          days={days}
          today={today}
          logs={logs}
          onToggle={toggle}
          onEdit={(h) => setDialog({ habit: h })}
          onPause={(h) => setActive(h, false)}
          onDelete={remove}
        />
        {groups.map((g) => (
          <Card key={g.title} className="hidden overflow-hidden sm:block">
            {/* Day header */}
            <div className="flex items-center border-b border-border bg-subtle px-4 py-2">
              <span className="flex-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</span>
              <div className="hidden grid-cols-7 gap-1 sm:grid">
                {days.map((d) => <DayHead key={d.getTime()} date={d} today={today} />)}
              </div>
              <span className="hidden w-28 sm:block" />
            </div>
            <div className="divide-y divide-border">
              {g.items.map((h) => {
                const streak = streakOf(h, logs, today)
                const rate = rate30(h, logs, today)
                return (
                  <div key={h.id} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-0">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{h.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {describeRecurrence(h)}
                          {h.targetValue ? ` · ${h.targetValue} ${h.unit ?? ""}` : ""}
                        </p>
                      </div>
                      <Stats streak={streak} rate={rate} className="sm:hidden" />
                      <HabitMenu habit={h} onEdit={() => setDialog({ habit: h })} onPause={() => setActive(h, false)} onDelete={() => remove(h)} className="sm:hidden" />
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((d) => (
                        <div key={d.getTime()} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground sm:hidden">{format(d, "EEEEE")}</span>
                          <Cell habit={h} date={d} today={today} done={!!logs[`${h.id}_${dateKey(d)}`]} onToggle={() => toggle(h, d)} />
                        </div>
                      ))}
                    </div>
                    <div className="hidden w-28 items-center justify-end gap-1 sm:flex">
                      <Stats streak={streak} rate={rate} />
                      <HabitMenu habit={h} onEdit={() => setDialog({ habit: h })} onPause={() => setActive(h, false)} onDelete={() => remove(h)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
        </>
      )}

      {paused.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold text-muted-foreground">Paused</h2>
          <Card className="divide-y divide-border">
            {paused.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm text-muted-foreground">{h.name}</span>
                <Button size="xs" variant="outline" onClick={() => setActive(h, true)}><Play /> Resume</Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <HabitDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        habit={dialog?.habit}
        onSaved={(saved) => {
          setHabits((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]))
          refresh()
        }}
      />
    </div>
  )
}

function DayHead({ date, today }: { date: Date; today: Date }) {
  const isToday = isSameDay(date, today)
  return (
    <div className={cn("flex w-9 flex-col items-center text-[10px] leading-tight", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>
      <span>{format(date, "EEE")}</span>
      <span className="tabular">{format(date, "d")}</span>
    </div>
  )
}

function Cell({ habit, date, today, done, onToggle }: { habit: HabitDTO; date: Date; today: Date; done: boolean; onToggle: () => void }) {
  const applies = appliesOn(habit, date)
  const future = date > today
  const isToday = isSameDay(date, today)
  const label = `${habit.name}, ${format(date, "EEEE MMM d")}`

  if (!applies && !done) {
    return (
      <span className="flex size-9 items-center justify-center text-muted-foreground/40" title="Not scheduled">
        <Minus className="size-3.5" />
      </span>
    )
  }
  return (
    <button
      type="button"
      disabled={future}
      onClick={onToggle}
      aria-pressed={done}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-lg border transition-all disabled:cursor-default disabled:opacity-30",
        done
          ? "border-success bg-success text-white"
          : cn("border-border bg-card text-transparent hover:border-success hover:text-success/60", isToday && "border-primary/60 ring-2 ring-primary/15"),
      )}
    >
      <Check className="size-4" strokeWidth={3} />
    </button>
  )
}

function Stats({ streak, rate, className }: { streak: number; rate: number; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground tabular", className)}>
      <span className={cn("inline-flex items-center gap-0.5", streak >= 3 && "font-medium text-warning")} title="Current streak">
        <Flame className="size-3.5" />
        {streak}
      </span>
      <span title="Last 30 days">{rate}%</span>
    </div>
  )
}

function HabitMenu({ habit, onEdit, onPause, onDelete, className }: { habit: HabitDTO; onEdit: () => void; onPause: () => void; onDelete: () => void; className?: string }) {
  const builtIn = habit.isPrayer || habit.isQuran || habit.isAdhkar
  return (
    <Menu
      className={className}
      items={[
        { label: "Edit", icon: <Pencil />, onSelect: onEdit },
        { label: "Pause", icon: <Pause />, onSelect: onPause },
        ...(builtIn ? [] : [{ separator: true } as const, { label: "Delete", icon: <Trash2 />, danger: true, onSelect: onDelete }]),
      ]}
    />
  )
}

/**
 * Phones: pick a day (today by default), then one big check per habit.
 * The week shows as small dots so the row stays one line tall.
 */
function MobileHabits({
  groups,
  days,
  today,
  logs,
  onToggle,
  onEdit,
  onPause,
  onDelete,
}: {
  groups: { title: string; items: HabitDTO[] }[]
  days: Date[]
  today: Date
  logs: Logs
  onToggle: (h: HabitDTO, d: Date) => void
  onEdit: (h: HabitDTO) => void
  onPause: (h: HabitDTO) => void
  onDelete: (h: HabitDTO) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const keys = days.map(dateKey)
  const todayKey = dateKey(today)
  const selKey = picked && keys.includes(picked) ? picked : keys.includes(todayKey) ? todayKey : keys[6]
  const sel = days[keys.indexOf(selKey)]
  const all = groups.flatMap((g) => g.items)

  const dayStats = (d: Date) => {
    const due = all.filter((h) => appliesOn(h, d))
    return { due: due.length, done: due.filter((h) => logs[`${h.id}_${dateKey(d)}`]).length }
  }

  return (
    <div className="space-y-4 sm:hidden">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = dateKey(d)
          const { due, done } = dayStats(d)
          const future = d > today
          const pct = due ? done / due : 0
          const isSel = k === selKey
          return (
            <button
              key={k}
              type="button"
              disabled={future}
              onClick={() => setPicked(k)}
              aria-pressed={isSel}
              aria-label={format(d, "EEEE MMM d")}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-2xl py-2 transition-colors disabled:cursor-default disabled:opacity-35",
                isSel ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <span className="text-[11px] font-medium">{format(d, "EEEEE")}</span>
              <span className="relative flex size-8 items-center justify-center">
                <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
                  <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" className={isSel ? "stroke-white/25" : "stroke-muted"} />
                  {pct > 0 && (
                    <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 13} strokeDashoffset={2 * Math.PI * 13 * (1 - pct)} className={isSel ? "stroke-white" : pct === 1 ? "stroke-success" : "stroke-primary"} />
                  )}
                </svg>
                <span className={cn("text-[13px] font-semibold tabular", !isSel && isSameDay(d, today) && "text-primary")}>{format(d, "d")}</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[13px] text-muted-foreground">
        {isSameDay(sel, today) ? "Today" : format(sel, "EEEE, MMM d")} · <span className="font-medium text-foreground tabular">{dayStats(sel).done}/{dayStats(sel).due}</span> done
      </p>

      {groups.map((g) => (
        <Card key={g.title} className="overflow-hidden">
          <div className="border-b border-border bg-subtle px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</div>
          <div className="divide-y divide-border">
            {g.items.map((h) => {
              const applies = appliesOn(h, sel)
              const done = !!logs[`${h.id}_${selKey}`]
              const streak = streakOf(h, logs, today)
              return (
                <div key={h.id} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[15px] font-medium", done && "text-muted-foreground")}>{h.name}</p>
                    <div className="mt-1 flex items-center gap-2.5">
                      <span className="flex gap-[3px]" aria-label="This week">
                        {days.map((d) => {
                          const k = dateKey(d)
                          const hit = logs[`${h.id}_${k}`]
                          return (
                            <span
                              key={k}
                              className={cn(
                                "size-1.5 rounded-full",
                                hit ? "bg-success" : !appliesOn(h, d) || d > today ? "bg-border" : "bg-border-strong",
                                k === selKey && "ring-1 ring-primary ring-offset-1 ring-offset-card",
                              )}
                            />
                          )
                        })}
                      </span>
                      {streak > 0 && (
                        <span className={cn("inline-flex items-center gap-0.5 text-xs tabular", streak >= 3 ? "font-medium text-warning" : "text-muted-foreground")}>
                          <Flame className="size-3" />{streak}
                        </span>
                      )}
                      {h.targetValue ? <span className="truncate text-xs text-muted-foreground">{h.targetValue} {h.unit ?? ""}</span> : null}
                    </div>
                  </div>
                  <HabitMenu habit={h} onEdit={() => onEdit(h)} onPause={() => onPause(h)} onDelete={() => onDelete(h)} />
                  {applies || done ? (
                    <button
                      type="button"
                      onClick={() => onToggle(h, sel)}
                      aria-pressed={done}
                      aria-label={`${h.name}${done ? ", done" : ""}`}
                      className={cn(
                        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 transition-all active:scale-90",
                        done ? "animate-pop border-success bg-success text-white" : "border-border-strong text-transparent",
                      )}
                    >
                      <Check className="size-5" strokeWidth={3} />
                    </button>
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center text-[11px] text-muted-foreground">Off</span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}
