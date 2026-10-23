"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { dateKey } from "@/lib/dates"
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META, TONE_DOT } from "@/lib/constants"
import { Target } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Textarea } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/datepicker"
import { Segmented } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"

export interface ProjectFormValue {
  id?: string
  name: string
  description?: string | null
  status: string
  priority: string
  goalId?: string | null
  deadline?: string | null
}

type SavedProject = { id: string; name: string }

/** Create (no `project.id`) or edit a project. */
export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project?: Partial<ProjectFormValue> | null
  onSaved?: (p: SavedProject) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={project?.id ? "Edit project" : "New project"}>
      {/* Mounted only while open, so the form starts fresh each time */}
      <ProjectForm project={project} onSaved={onSaved} onClose={() => onOpenChange(false)} />
    </Dialog>
  )
}

function ProjectForm({
  project,
  onSaved,
  onClose,
}: {
  project?: Partial<ProjectFormValue> | null
  onSaved?: (p: SavedProject) => void
  onClose: () => void
}) {
  const { refresh } = useApp()
  const toast = useToast()
  const editing = !!project?.id
  const [form, setForm] = useState<ProjectFormValue>(() => ({
    name: "",
    description: "",
    status: "Active",
    priority: "P2",
    goalId: "",
    ...project,
    deadline: project?.deadline ? dateKey(new Date(project.deadline)) : "",
  }))
  const [goals, setGoals] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<{ id: string; name: string; status: string }[]>("/api/goals")
      .then((g) => setGoals(g.filter((x) => x.status !== "Archived")))
      .catch(() => {})
  }, [])

  const set = <K extends keyof ProjectFormValue>(k: K, v: ProjectFormValue[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const body = {
        name: form.name,
        description: form.description,
        status: form.status,
        priority: form.priority,
        goalId: form.goalId || null,
        deadline: form.deadline || null,
      }
      const saved = editing
        ? await api<SavedProject>(`/api/projects/${project!.id}`, { method: "PATCH", body })
        : await api<SavedProject>("/api/projects", { body })
      toast.success(editing ? "Project updated" : "Project created")
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
      <Field label="Name">
        <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Saudi Jobs Platform" />
      </Field>
      <Field label="Description">
        <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="What is it and why does it matter?" />
      </Field>
      <Field label="Priority" hint={PROJECT_PRIORITY_META[form.priority]?.label}>
        <Segmented
          value={form.priority}
          onChange={(v) => set("priority", v)}
          className="flex w-full"
          options={PROJECT_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select value={form.status} onChange={(v) => set("status", v)} options={PROJECT_STATUSES.map((s) => ({ value: s, label: s, dot: TONE_DOT[PROJECT_STATUS_META[s].tone] }))} />
        </Field>
        <Field label="Deadline">
          <DatePicker value={form.deadline ?? ""} onChange={(v) => set("deadline", v ?? "")} placeholder="None" quick={[]} title="Deadline" />
        </Field>
      </div>
      <Field label="Supports goal" hint="Optional — link it to one of your goals.">
        <Select value={form.goalId ?? ""} onChange={(v) => set("goalId", v)} options={goals.map((g) => ({ value: g.id, label: g.name, icon: <Target /> }))} placeholder="No goal" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!form.name.trim() || saving}>
          {editing ? "Save" : "Create project"}
        </Button>
      </div>
    </form>
  )
}
