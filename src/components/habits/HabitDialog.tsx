"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { HABIT_CATEGORIES, WEEKDAYS } from "@/lib/constants"
import { parseWeekdays } from "@/lib/habits/recurrence"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/form"
import { Chip, Segmented } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import type { HabitDTO } from "@/types"

export function HabitDialog({
  open,
  onOpenChange,
  habit,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  habit?: HabitDTO | null
  onSaved: (h: HabitDTO) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={habit ? "Edit habit" : "New habit"}>
      <HabitForm habit={habit} onSaved={onSaved} onClose={() => onOpenChange(false)} />
    </Dialog>
  )
}

function HabitForm({ habit, onSaved, onClose }: { habit?: HabitDTO | null; onSaved: (h: HabitDTO) => void; onClose: () => void }) {
  const toast = useToast()
  const initialDays = parseWeekdays(habit?.weekdays)
  const [name, setName] = useState(habit?.name ?? "")
  const [category, setCategory] = useState(habit?.category ?? "Health")
  const [schedule, setSchedule] = useState<"daily" | "days">(habit && habit.recurrence !== "daily" && initialDays.length ? "days" : "daily")
  const [days, setDays] = useState<number[]>(initialDays)
  const [target, setTarget] = useState(habit?.targetValue != null ? String(habit.targetValue) : "")
  const [unit, setUnit] = useState(habit?.unit ?? "")
  const [saving, setSaving] = useState(false)
  const editing = !!habit
  const isPrayer = !!habit?.isPrayer

  const toggleDay = (d: number) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    if (schedule === "days" && days.length === 0) return toast.error("Pick at least one day")
    setSaving(true)
    const body = {
      ...(isPrayer ? {} : { name, category, weekdays: schedule === "days" ? days.sort() : [] }),
      targetValue: target || null,
      unit: unit || null,
    }
    try {
      const saved = editing
        ? await api<HabitDTO>(`/api/habits/${habit!.id}`, { method: "PATCH", body })
        : await api<HabitDTO>("/api/habits", { body })
      toast.success(editing ? "Habit updated" : "Habit added")
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" hint={isPrayer ? "Prayer names are fixed — they're matched to prayer times." : undefined}>
          <Input autoFocus={!editing} value={name} disabled={isPrayer} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workout, Read 10 pages" />
        </Field>
        {!isPrayer && (
          <>
            <Field label="Category">
              <div className="flex flex-wrap gap-1.5">
                {HABIT_CATEGORIES.map((c) => (
                  <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Repeat">
              <Segmented
                value={schedule}
                onChange={setSchedule}
                options={[
                  { value: "daily", label: "Every day" },
                  { value: "days", label: "Specific days" },
                ]}
              />
            </Field>
            {schedule === "days" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <Chip key={d.value} active={days.includes(d.value)} onClick={() => toggleDay(d.value)} className="w-12 justify-center px-0">
                    {d.short}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daily target">
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Optional, e.g. 30" />
          </Field>
          <Field label="Unit">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="minutes, pages…" />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || saving}>{editing ? "Save" : "Add habit"}</Button>
        </div>
      </form>
  )
}
