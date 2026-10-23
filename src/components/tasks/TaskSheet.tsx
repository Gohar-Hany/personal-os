"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { CalendarDays, CircleDot, Clock, Flag, FolderKanban, Plus, Trash2, X, Hourglass, Milestone as MilestoneIcon } from "lucide-react"
import { api } from "@/lib/api"
import { cn, calcProgress } from "@/lib/utils"
import { dateKey, toDate } from "@/lib/dates"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, Textarea } from "@/components/ui/form"
import { DatePicker, TimePicker } from "@/components/ui/datepicker"
import { CheckCircle, ProgressBar, Segmented } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { useTaskActions } from "@/components/tasks/useTasks"
import type { SubtaskDTO, TaskDTO } from "@/types"

const ESTIMATES = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
]

export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!taskId}
      onOpenChange={(o) => !o && onClose()}
      title="Task details"
      hideTitle
      side="right"
      initialFocus={false}
    >
      {taskId && <TaskLoader key={taskId} taskId={taskId} onClose={onClose} />}
    </Dialog>
  )
}

function TaskLoader({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [task, setTask] = useState<TaskDTO | null>(null)
  const { refresh, patchTask } = useApp()
  const actions = useTaskActions()
  const toast = useToast()

  useEffect(() => {
    api<TaskDTO>(`/api/tasks/${taskId}`)
      .then(setTask)
      .catch((err) => {
        toast.error(err.message)
        onClose()
      })
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch: Partial<TaskDTO>) => {
    if (!task) return
    const before = task
    setTask({ ...task, ...patch })
    // Mirror the change into every list on screen right away
    const settle = patchTask(task.id, patch)
    try {
      const updated = await api<TaskDTO>(`/api/tasks/${task.id}`, { method: "PATCH", body: patch })
      setTask(updated)
      settle(true)
      refresh()
    } catch (err) {
      setTask(before)
      settle(false)
      toast.error((err as Error).message)
    }
  }

  const remove = () => {
    if (!task) return
    onClose()
    actions.remove(task)
  }

  if (!task) {
    return (
      <div className="space-y-3 pt-6">
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }
  return <TaskDetails task={task} setTask={setTask} save={save} remove={remove} />
}

function TaskDetails({
  task,
  setTask,
  save,
  remove,
}: {
  task: TaskDTO
  setTask: (t: TaskDTO) => void
  save: (patch: Partial<TaskDTO>) => Promise<void>
  remove: () => void
}) {
  const { projects } = useApp()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? task.description ?? "")
  const done = task.status === "Completed"

  const scheduled = toDate(task.scheduledDate)
  const scheduledKey = scheduled ? dateKey(scheduled) : ""
  const project = projects.find((p) => p.id === task.projectId)

  const commitTitle = () => {
    const t = title.trim()
    if (!t) return setTitle(task.title)
    if (t !== task.title) save({ title: t })
  }

  return (
    <div className="space-y-5 pt-1">
      {/* Title */}
      <div className="flex items-start gap-3 pt-1">
        <CheckCircle
          checked={done}
          onChange={() => save({ status: done ? "Todo" : "Completed" })}
          label={done ? "Mark as not done" : "Mark as done"}
          className="mt-1.5"
        />
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLTextAreaElement).blur()
            }
          }}
          rows={1}
          aria-label="Task title"
          className={cn(
            "field-sizing-content min-h-9 w-full resize-none bg-transparent text-lg leading-snug font-semibold outline-none",
            done && "text-muted-foreground line-through",
          )}
        />
      </div>

      {/* Properties */}
      <div className="space-y-3.5 rounded-xl border border-border bg-subtle p-3.5">
        <Prop icon={<CircleDot />} label="Status">
          <Segmented
            size="xs"
            value={task.status === "Cancelled" ? "Todo" : task.status}
            onChange={(v) => save({ status: v })}
            options={[
              { value: "Todo", label: "To do" },
              { value: "InProgress", label: "Doing" },
              { value: "Completed", label: "Done" },
            ]}
          />
        </Prop>

        <Prop icon={<Flag />} label="Priority">
          <Segmented
            size="xs"
            value={task.priority}
            onChange={(v) => save({ priority: v })}
            options={["Low", "Medium", "High", "Critical"].map((p) => ({
              value: p,
              label: <span className={cn(task.priority === p && TASK_PRIORITY_META[p].text)}>{TASK_PRIORITY_META[p].label}</span>,
            }))}
          />
        </Prop>

        <Prop icon={<CalendarDays />} label="Do on">
          <DatePicker
            size="sm"
            value={scheduledKey}
            onChange={(v) => save(v ? { scheduledDate: v } : { scheduledDate: null, startTime: null, endTime: null })}
            placeholder="Someday"
            title="When will you do it?"
            className="max-w-60"
          />
        </Prop>

        {scheduledKey && (
          <Prop icon={<Clock />} label="Time">
            <div className="flex max-w-72 items-center gap-1.5">
              <TimePicker size="sm" value={task.startTime ?? ""} onChange={(v) => save({ startTime: v })} placeholder="Start" aria-label="Start time" />
              <span className="text-muted-foreground">–</span>
              <TimePicker size="sm" value={task.endTime ?? ""} onChange={(v) => save({ endTime: v })} placeholder="End" aria-label="End time" />
            </div>
          </Prop>
        )}

        <Prop icon={<Hourglass />} label="Deadline">
          <DatePicker
            size="sm"
            value={task.dueDate ? dateKey(new Date(task.dueDate)) : ""}
            onChange={(v) => save({ dueDate: v })}
            placeholder="No deadline"
            title="Deadline"
            quick={["today", "tomorrow", "weekend", "nextweek"]}
            className="max-w-60"
          />
        </Prop>

        <Prop icon={<FolderKanban />} label="Project">
          <Select
            size="sm"
            value={task.projectId ?? ""}
            onChange={(v) => save({ projectId: v || null, milestoneId: null })}
            options={projects.map((p) => ({ value: p.id, label: p.name, icon: <FolderKanban /> }))}
            placeholder="No project"
            aria-label="Project"
            className="w-full max-w-60"
          />
        </Prop>

        {project && project.milestones.length > 0 && (
          <Prop icon={<MilestoneIcon />} label="Milestone">
            <Select
              size="sm"
              value={task.milestoneId ?? ""}
              onChange={(v) => save({ milestoneId: v || null })}
              options={project.milestones.map((m) => ({ value: m.id, label: m.title }))}
              placeholder="No milestone"
              className="w-full max-w-60"
            />
          </Prop>
        )}

        <Prop icon={<Clock />} label="Estimate">
          <Select
            size="sm"
            value={task.estimatedMinutes ? String(task.estimatedMinutes) : ""}
            onChange={(v) => save({ estimatedMinutes: v ? Number(v) : null })}
            options={ESTIMATES}
            placeholder="None"
            className="w-32"
          />
        </Prop>
      </div>

      <Subtasks task={task} setTask={setTask} />

      {/* Notes */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Notes</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (task.notes ?? task.description ?? "") && save({ notes })}
          rows={4}
          placeholder="Links, details, anything useful…"
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <span>
          Created {format(new Date(task.createdAt), "MMM d, yyyy")}
          {task.completedAt && ` · Done ${format(new Date(task.completedAt), "MMM d")}`}
        </span>
        <Button variant="ghost" size="xs" onClick={remove} className="text-danger hover:bg-danger-soft hover:text-danger">
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  )
}

function Prop({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Subtasks({ task, setTask }: { task: TaskDTO; setTask: (t: TaskDTO) => void }) {
  const { refresh } = useApp()
  const toast = useToast()
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const subtasks = task.subtasks ?? []
  const doneCount = subtasks.filter((s) => s.status === "Completed").length

  const setSubs = (subs: SubtaskDTO[]) => setTask({ ...task, subtasks: subs })

  const add = async () => {
    const title = draft.trim()
    if (!title) return
    setDraft("")
    try {
      const created = await api<SubtaskDTO>("/api/tasks", { body: { title, parentId: task.id } })
      setSubs([...subtasks, created])
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
    inputRef.current?.focus()
  }

  const toggle = (s: SubtaskDTO) => {
    const status = s.status === "Completed" ? "Todo" : "Completed"
    setSubs(subtasks.map((x) => (x.id === s.id ? { ...x, status } : x)))
    api(`/api/tasks/${s.id}`, { method: "PATCH", body: { status } }).then(refresh).catch((err) => toast.error(err.message))
  }

  const remove = (s: SubtaskDTO) => {
    setSubs(subtasks.filter((x) => x.id !== s.id))
    api(`/api/tasks/${s.id}`, { method: "DELETE" }).then(refresh).catch((err) => toast.error(err.message))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Subtasks</p>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground tabular">
            {doneCount}/{subtasks.length}
          </span>
        )}
      </div>
      {subtasks.length > 0 && <ProgressBar value={calcProgress(doneCount, subtasks.length)} />}
      <div className="space-y-0.5">
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted">
            <CheckCircle size="sm" checked={s.status === "Completed"} onChange={() => toggle(s)} label={s.title} />
            <span className={cn("flex-1 text-[13px]", s.status === "Completed" && "text-muted-foreground line-through")}>{s.title}</span>
            <button
              type="button"
              onClick={() => remove(s)}
              aria-label={`Remove ${s.title}`}
              className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <Plus className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            onBlur={add}
            placeholder="Add a subtask"
            className="flex-1 bg-transparent text-base sm:text-[13px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>
    </div>
  )
}
