"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { CalendarDays, ChevronRight, CircleDot, Clock, Flag, FolderKanban, Plus, Trash2, X, Hourglass, Milestone as MilestoneIcon, Tag } from "lucide-react"
import { api } from "@/lib/api"
import { cn, calcProgress } from "@/lib/utils"
import { keyOf, parseTags } from "@/lib/tasks/taskLogic"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, Textarea } from "@/components/ui/form"
import { DatePicker, TimePicker } from "@/components/ui/datepicker"
import { ProgressBar, Segmented } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp, useClock } from "@/components/app/AppProvider"
import { useTaskActions } from "@/components/tasks/useTasks"
import { useSubtasks } from "@/components/tasks/useSubtasks"
import { PriorityIcon, StatusCheck } from "@/components/tasks/TaskIcons"
import { projectDot } from "@/components/tasks/TaskRow"
import { LabelEditor } from "@/components/tasks/TaskLabels"
import type { TaskDTO } from "@/types"

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
      {taskId && <TaskDetailPanel key={taskId} taskId={taskId} onClose={onClose} />}
    </Dialog>
  )
}

/** Task details for a task id — used inside the sheet and as the inline side panel on wide screens. */
export function TaskDetailPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
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

  const clock = useClock()
  const scheduledKey = keyOf(task.scheduledDate, clock) ?? ""
  const project = projects.find((p) => p.id === task.projectId)

  const commitTitle = () => {
    const t = title.trim()
    if (!t) return setTitle(task.title)
    if (t !== task.title) save({ title: t })
  }

  return (
    <div className="space-y-5 pt-1">
      {/* Where this task lives: Project › Milestone */}
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {task.project ? (
          <>
            <Link href={`/projects/${task.project.id}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground">
              <span className={cn("size-2 shrink-0 rounded-full", projectDot(task.project.id))} />
              <span className="truncate">{task.project.name}</span>
            </Link>
            {task.milestone && (
              <>
                <ChevronRight className="size-3 shrink-0" />
                <span className="truncate">{task.milestone.title}</span>
              </>
            )}
          </>
        ) : (
          <span className="px-1.5 py-0.5">No project</span>
        )}
      </div>

      {/* Title */}
      <div className="flex items-start gap-3">
        <StatusCheck
          status={task.status}
          onToggle={() => save({ status: done ? "Todo" : "Completed" })}
          label={done ? "Mark as not done" : "Mark as done"}
          className="mt-1"
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
          <Select
            size="sm"
            value={task.priority}
            onChange={(v) => save({ priority: v })}
            aria-label="Priority"
            className="max-w-60"
            options={["Critical", "High", "Medium", "Low"].map((p) => ({ value: p, label: TASK_PRIORITY_META[p].label, icon: <PriorityIcon priority={p} /> }))}
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
            <div className="grid max-w-72 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
              <TimePicker size="sm" icon={false} value={task.startTime ?? ""} onChange={(v) => save({ startTime: v })} placeholder="Start" aria-label="Start time" />
              <span className="text-muted-foreground">–</span>
              <TimePicker size="sm" icon={false} value={task.endTime ?? ""} onChange={(v) => save({ endTime: v })} placeholder="End" aria-label="End time" />
            </div>
          </Prop>
        )}

        <Prop icon={<Hourglass />} label="Deadline">
          <DatePicker
            size="sm"
            value={keyOf(task.dueDate, clock) ?? ""}
            onChange={(v) => save({ dueDate: v })}
            placeholder="No deadline"
            title="Deadline"
            quick={["today", "tomorrow", "weekend", "nextweek"]}
            className="max-w-60"
          />
        </Prop>

        <Prop icon={<Tag />} label="Labels">
          <LabelEditor value={parseTags(task.tags)} onChange={(labels) => save({ tags: labels.length ? JSON.stringify(labels) : null })} />
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
  const sub = useSubtasks(task, (subs) => setTask({ ...task, subtasks: subs }))
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const subtasks = sub.subtasks

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setDraft("")
    sub.add(title)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Subtasks</p>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground tabular">
            {sub.done}/{subtasks.length} · {calcProgress(sub.done, subtasks.length)}%
          </span>
        )}
      </div>
      {subtasks.length > 0 && <ProgressBar value={calcProgress(sub.done, subtasks.length)} />}
      <div className="space-y-0.5">
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted">
            <StatusCheck size="sm" status={s.status} onToggle={() => sub.toggle(s)} label={s.title} />
            <span className={cn("flex-1 text-[15px] sm:text-[13px]", s.status === "Completed" && "text-muted-foreground line-through")}>{s.title}</span>
            <button
              type="button"
              onClick={() => sub.remove(s)}
              aria-label={`Remove ${s.title}`}
              className="cursor-pointer rounded p-1.5 text-muted-foreground hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
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
