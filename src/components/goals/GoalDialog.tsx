"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { dateKey } from "@/lib/dates"
import { CURRENCIES, GOAL_CATEGORIES } from "@/lib/constants"
import { GOAL_CATEGORY_ICONS } from "@/components/goals/goalIcons"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, Input, Textarea } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/datepicker"
import { Chip } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import type { GoalDTO } from "@/types"

interface Form {
  name: string
  description: string
  category: string
  targetValue: string
  currentValue: string
  unit: string
  deadline: string
}

export function GoalDialog({
  open,
  onOpenChange,
  goal,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  goal?: Partial<GoalDTO> | null
  onSaved?: (g: GoalDTO) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={goal?.id ? "Edit goal" : "New goal"}>
      {/* Mounted only while open, so the form starts fresh each time */}
      <GoalForm goal={goal} onSaved={onSaved} onClose={() => onOpenChange(false)} />
    </Dialog>
  )
}

function GoalForm({ goal, onSaved, onClose }: { goal?: Partial<GoalDTO> | null; onSaved?: (g: GoalDTO) => void; onClose: () => void }) {
  const { refresh, settings } = useApp()
  const toast = useToast()
  const editing = !!goal?.id
  const [form, setForm] = useState<Form>(() => ({
    name: goal?.name ?? "",
    description: goal?.description ?? "",
    category: goal?.category ?? "Financial",
    targetValue: goal?.targetValue != null ? String(goal.targetValue) : "",
    currentValue: goal?.currentValue ? String(goal.currentValue) : "",
    unit: goal?.unit ?? (editing ? "" : settings.currency),
    deadline: goal?.deadline ? dateKey(new Date(goal.deadline)) : "",
  }))
  const [saving, setSaving] = useState(false)

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const body = {
        ...form,
        targetValue: form.targetValue || null,
        currentValue: form.currentValue || 0,
        deadline: form.deadline || null,
      }
      const saved = editing
        ? await api<GoalDTO>(`/api/goals/${goal!.id}`, { method: "PATCH", body })
        : await api<GoalDTO>("/api/goals", { body })
      toast.success(editing ? "Goal updated" : "Goal created")
      refresh()
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
      <form onSubmit={submit} className="space-y-4">
        <Field label="Goal">
          <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Save $10,000" />
        </Field>
        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {GOAL_CATEGORIES.map((c) => (
              <Chip key={c} active={form.category === c} onClick={() => set("category", c)}>
                <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
                  {GOAL_CATEGORY_ICONS[c] ?? GOAL_CATEGORY_ICONS.Other}
                  <span>{c}</span>
                </span>
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target">
            <Input inputMode="decimal" value={form.targetValue} onChange={(e) => set("targetValue", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="So far">
            <Input inputMode="decimal" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} placeholder="0" />
          </Field>
          <Field label="Unit">
            <Input list="goal-units" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="USD, books…" />
            <datalist id="goal-units">
              {[...CURRENCIES, "books", "km", "kg", "hours", "courses"].map((u) => <option key={u} value={u} />)}
            </datalist>
          </Field>
        </div>
        <Field label="Deadline">
          <DatePicker value={form.deadline} onChange={(v) => set("deadline", v ?? "")} placeholder="No deadline" quick={[]} title="Deadline" />
        </Field>
        <Field label="Why it matters">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Optional" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!form.name.trim() || saving}>
            {editing ? "Save" : "Create goal"}
          </Button>
        </div>
      </form>
  )
}
