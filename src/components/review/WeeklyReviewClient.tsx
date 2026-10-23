"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Check, ChevronDown } from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { toDate } from "@/lib/dates"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/form"
import { PageHeader } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import type { WeeklyReviewDTO, WeekStats } from "@/types"

const PROMPTS = [
  { key: "wins", label: "What went well?", placeholder: "Wins, progress, things you're proud of" },
  { key: "challenges", label: "What was hard?", placeholder: "What slowed you down or didn't go to plan" },
  { key: "lessonsLearned", label: "What did you learn?", placeholder: "Something to repeat or avoid next time" },
  { key: "faithReflection", label: "Faith & gratitude", placeholder: "Prayer, Quran, gratitude" },
  { key: "nextWeekPriorities", label: "Top priorities for next week", placeholder: "The 1–3 things that matter most" },
] as const

type TextKey = (typeof PROMPTS)[number]["key"]

const weekRange = (start: string, end: string) => `${format(toDate(start)!, "MMM d")} – ${format(toDate(end)!, "MMM d")}`

export function WeeklyReviewClient({
  weekStart,
  weekEnd,
  stats,
  current,
  past,
}: {
  weekStart: string
  weekEnd: string
  stats: WeekStats
  current: WeeklyReviewDTO | null
  past: WeeklyReviewDTO[]
}) {
  const { refresh } = useApp()
  const toast = useToast()
  const [form, setForm] = useState<Record<TextKey, string>>(() =>
    Object.fromEntries(PROMPTS.map((p) => [p.key, current?.[p.key] ?? ""])) as Record<TextKey, string>,
  )
  const [rating, setRating] = useState<number | null>(current?.overallRating ?? null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(current ? new Date() : null)
  const [dirty, setDirty] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api("/api/reviews", { body: { weekStart, ...form, overallRating: rating } })
      setSavedAt(new Date())
      setDirty(false)
      toast.success("Review saved")
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Weekly review" description={`This week · ${weekRange(weekStart, weekEnd)}`} />

      <StatsGrid stats={stats} />

      <Card className="space-y-5 p-5">
        {PROMPTS.map((p) => (
          <label key={p.key} className="block space-y-1.5">
            <span className="text-[13px] font-medium">{p.label}</span>
            <Textarea
              value={form[p.key]}
              onChange={(e) => {
                setForm((f) => ({ ...f, [p.key]: e.target.value }))
                setDirty(true)
              }}
              rows={2}
              placeholder={p.placeholder}
              className="field-sizing-content min-h-16"
            />
          </label>
        ))}

        <div className="space-y-2">
          <span className="text-[13px] font-medium">How was the week overall?</span>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRating(n)
                  setDirty(true)
                }}
                aria-pressed={rating === n}
                className={cn(
                  "size-9 cursor-pointer rounded-lg border text-[13px] font-medium tabular transition-colors",
                  rating === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-border-strong",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {savedAt && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <Check className="size-3.5" /> Saved
            </span>
          )}
          <Button variant="primary" onClick={save} disabled={saving || (!dirty && !!savedAt)}>
            {current || savedAt ? "Save changes" : "Save review"}
          </Button>
        </div>
      </Card>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold text-muted-foreground">Past weeks</h2>
          {past.map((r) => <PastReview key={r.id} review={r} />)}
        </section>
      )}
    </div>
  )
}

function StatsGrid({ stats }: { stats: WeekStats }) {
  const { settings } = useApp()
  const items = [
    { label: "Tasks done", value: String(stats.tasksCompleted) },
    { label: "Habits", value: `${stats.habitCompletionPct}%` },
    { label: "Prayers", value: `${stats.prayerCompletionPct}%` },
    { label: "Quran", value: `${stats.quranCompletionPct}%` },
    { label: "Workouts", value: String(stats.workoutCount) },
    { label: "Income", value: formatCurrency(stats.incomeTotal, settings.currency, { compact: true }) },
    { label: "Spent", value: formatCurrency(stats.expenseTotal, settings.currency, { compact: true }) },
    { label: "Saved", value: formatCurrency(stats.savingsTotal, settings.currency, { compact: true }) },
  ]
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function PastReview({ review: r }: { review: WeeklyReviewDTO }) {
  const [open, setOpen] = useState(false)
  const filled = PROMPTS.filter((p) => r[p.key])
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-subtle"
      >
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span className="flex-1 text-sm font-medium">{weekRange(r.weekStart, r.weekEnd)}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline tabular">
          {r.tasksCompleted} tasks · {Math.round(r.habitCompletionPct)}% habits
        </span>
        {r.overallRating != null && (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular",
              r.overallRating >= 8 ? "bg-success-soft text-success" : r.overallRating >= 5 ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger",
            )}
          >
            {r.overallRating}/10
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-4">
          {filled.length === 0 && <p className="text-[13px] text-muted-foreground">No notes for this week.</p>}
          {filled.map((p) => (
            <div key={p.key}>
              <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
              <p className="mt-0.5 text-[13px] whitespace-pre-wrap">{r[p.key]}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
