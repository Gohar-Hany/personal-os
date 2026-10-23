"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, CheckSquare, Clock, Flag, FolderKanban, Inbox, Wallet } from "lucide-react"
import { addDays } from "date-fns"
import { api } from "@/lib/api"

import { dateKey } from "@/lib/dates"
import { parseQuickTask } from "@/lib/quickParse"
import { TASK_PRIORITIES, TASK_PRIORITY_META } from "@/lib/constants"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/datepicker"
import { Chip, Kbd, Segmented } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { TransactionForm } from "@/components/finance/TransactionForm"
import type { TaskDTO } from "@/types"

export type QuickAddMode = "task" | "note" | "money"

export interface QuickAddRequest {
  mode?: QuickAddMode
  /** Prefill the text field (e.g. converting an inbox note). */
  text?: string
  /** Default date for new tasks: "today" on the Today page. */
  date?: "today" | null
  projectId?: string
  milestoneId?: string
  onCreated?: (task: TaskDTO) => void
}

export function QuickAdd({ request, onClose }: { request: QuickAddRequest | null; onClose: () => void }) {
  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()} title="Quick add" hideTitle size="md">
      {request && <QuickAddBody request={request} onClose={onClose} />}
    </Dialog>
  )
}

function QuickAddBody({ request, onClose }: { request: QuickAddRequest; onClose: () => void }) {
  const [mode, setMode] = useState<QuickAddMode>(request.mode ?? "task")
  return (
      <div className="space-y-4 pt-2">
        <Segmented
          value={mode}
          onChange={setMode}
          className="flex w-full"
          options={[
            { value: "task", label: <><CheckSquare /> Task</> },
            { value: "note", label: <><Inbox /> Note</> },
            { value: "money", label: <><Wallet /> Money</> },
          ]}
        />
        {mode === "task" && <TaskTab request={request} onDone={onClose} />}
        {mode === "note" && <NoteTab initial={request.text} />}
        {mode === "money" && <TransactionForm onSaved={onClose} />}
      </div>
  )
}

function TaskTab({ request, onDone }: { request: QuickAddRequest; onDone: () => void }) {
  const { projects, refresh } = useApp()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(request.text ?? "")
  const [date, setDate] = useState<string | null>(request.date === "today" ? dateKey() : null)
  const [projectId, setProjectId] = useState(request.projectId ?? "")
  const [priority, setPriority] = useState("Medium")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  const parsed = useMemo(() => parseQuickTask(text, projects), [text, projects])
  const finalDate = parsed.scheduledDate ?? date
  const finalProject = parsed.projectId ?? projectId
  const finalPriority = parsed.priority ?? priority

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!parsed.title || saving) return
    setSaving(true)
    try {
      const task = await api<TaskDTO>("/api/tasks", {
        body: {
          title: parsed.title,
          scheduledDate: finalDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          projectId: finalProject || null,
          milestoneId: finalProject === request.projectId ? request.milestoneId : null,
          priority: finalPriority,
        },
      })
      refresh()
      request.onCreated?.(task)
      toast.success("Task added")
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  const tomorrow = dateKey(addDays(new Date(), 1))
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name, icon: <FolderKanban /> }))

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        aria-label="Task"
        className="h-12 w-full rounded-xl border border-border bg-subtle px-4 text-base outline-none placeholder:text-muted-foreground/60 focus:border-ring focus:ring-3 focus:ring-ring/15"
      />

      {parsed.tokens.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Understood:</span>
          {parsed.tokens.map((t, i) => (
            <span key={i} className="inline-flex h-6 items-center gap-1 rounded-md bg-primary-soft px-2 font-medium text-primary [&_svg]:size-3">
              {t.kind === "date" && <CalendarDays />}
              {t.kind === "time" && <Clock />}
              {t.kind === "priority" && <Flag />}
              {t.kind === "project" && <FolderKanban />}
              {t.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tip: type <span className="font-medium text-foreground">tomorrow 8pm #project !high</span> and it fills in the details.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={finalDate === dateKey()} onClick={() => setDate(date === dateKey() ? null : dateKey())}>
          Today
        </Chip>
        <Chip active={finalDate === tomorrow} onClick={() => setDate(date === tomorrow ? null : tomorrow)}>
          Tomorrow
        </Chip>
        <DatePicker
          size="sm"
          value={finalDate && finalDate !== dateKey() && finalDate !== tomorrow ? finalDate : ""}
          onChange={(v) => setDate(v)}
          placeholder="Other date"
          clearable={false}
          title="Pick a date"
          className="h-7 w-auto rounded-full px-3 text-xs sm:h-7 sm:text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={finalProject} onChange={setProjectId} options={projectOptions} placeholder="No project" size="sm" aria-label="Project" icon={<FolderKanban />} />
        <Select
          value={finalPriority}
          onChange={setPriority}
          size="sm"
          aria-label="Priority"
          options={[...TASK_PRIORITIES].reverse().map((p) => ({ value: p, label: `${TASK_PRIORITY_META[p].label} priority`, dot: TASK_PRIORITY_META[p].dot }))}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          <Kbd>Enter</Kbd> to add · <Kbd>Esc</Kbd> to close
        </span>
        <Button type="submit" variant="primary" disabled={!parsed.title || saving} className="ml-auto">
          Add task
        </Button>
      </div>
    </form>
  )
}

function NoteTab({ initial }: { initial?: string }) {
  const { refresh } = useApp()
  const toast = useToast()
  const [text, setText] = useState(initial ?? "")
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 30)
  }, [])

  const save = async () => {
    const content = text.trim()
    if (!content) return
    setText("")
    try {
      await api("/api/inbox", { body: { content } })
      setCount((c) => c + 1)
      refresh()
    } catch (err) {
      setText(content)
      toast.error((err as Error).message)
    }
    ref.current?.focus()
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            save()
          }
        }}
        rows={3}
        placeholder="Anything on your mind — sort it out later in the Inbox"
        aria-label="Note"
        className="w-full resize-none rounded-xl border border-border bg-subtle px-4 py-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:border-ring focus:ring-3 focus:ring-ring/15"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {count > 0 ? `✓ ${count} saved to Inbox — keep going` : "Enter saves · Shift+Enter for a new line"}
        </span>
        <Button variant="primary" onClick={save} disabled={!text.trim()}>
          Save note
        </Button>
      </div>
    </div>
  )
}
