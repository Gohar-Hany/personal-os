"use client"

import { useRef, useState } from "react"
import { addDays } from "date-fns"
import { Check, CalendarDays, CalendarX2, Clock, Flag, FolderKanban, ListChecks, Pencil, Sun, Sunrise, Trash2, Hourglass } from "lucide-react"
import { cn } from "@/lib/utils"
import { dateKey, formatTime12, relativeDay, toDate } from "@/lib/dates"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { bucketOf, effectiveDate, isDeadlineSoon } from "@/lib/tasks/taskLogic"
import { CheckCircle } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useApp } from "@/components/app/AppProvider"
import { useTaskActions } from "@/components/tasks/useTasks"
import { useToast } from "@/components/ui/toast"
import { haptic } from "@/lib/hooks"
import type { TaskDTO } from "@/types"

/**
 * A single task line. Click opens details; the circle completes it;
 * the "…" menu reschedules or deletes. Meta only shows what's useful.
 */
export function TaskRow({
  task,
  showProject = true,
  showDate = true,
  className,
}: {
  task: TaskDTO
  showProject?: boolean
  showDate?: boolean
  className?: string
}) {
  const { openTask } = useApp()
  const actions = useTaskActions()
  const toast = useToast()
  const swipe = useSwipe({
    onRight: () => {
      haptic(12)
      actions.toggle(task)
    },
    onLeft: () => {
      haptic(12)
      const before = { scheduledDate: task.scheduledDate ?? null, startTime: task.startTime ?? null, endTime: task.endTime ?? null }
      actions.reschedule(task, dateKey(addDays(new Date(), 1)))
      toast.success("Moved to tomorrow", { label: "Undo", onClick: () => actions.update(task, before) })
    },
  })
  const done = task.status === "Completed"
  const bucket = bucketOf(task)
  const date = effectiveDate(task)
  const subs = task.subtasks ?? []
  const subsDone = subs.filter((s) => s.status === "Completed").length
  const prio = TASK_PRIORITY_META[task.priority]
  const urgent = task.priority === "Critical" || task.priority === "High"
  const deadline = toDate(task.dueDate)

  const meta: React.ReactNode[] = []
  if (showDate && date && bucket !== "today" && !done) {
    meta.push(
      <span key="d" className={cn("inline-flex items-center gap-1", bucket === "overdue" && "font-medium text-danger")}>
        <CalendarDays /> {relativeDay(date)}
      </span>,
    )
  }
  if (task.startTime) {
    meta.push(
      <span key="t" className="inline-flex items-center gap-1">
        <Clock /> {formatTime12(task.startTime)}
        {task.endTime && `–${formatTime12(task.endTime)}`}
      </span>,
    )
  }
  if (deadline && task.scheduledDate && !done) {
    meta.push(
      <span key="dl" className={cn("inline-flex items-center gap-1", isDeadlineSoon(task) && "font-medium text-danger")}>
        <Hourglass /> Due {relativeDay(deadline)}
      </span>,
    )
  }
  if (subs.length > 0) {
    meta.push(
      <span key="s" className="inline-flex items-center gap-1 tabular">
        <ListChecks /> {subsDone}/{subs.length}
      </span>,
    )
  }
  if (showProject && task.project) {
    meta.push(
      <span key="p" className="inline-flex max-w-40 items-center gap-1 truncate">
        <FolderKanban className="shrink-0" /> <span className="truncate">{task.project.name}</span>
      </span>,
    )
  }

  return (
    <div className="relative overflow-hidden">
      {/* Revealed behind the row while swiping on a phone */}
      {swipe.dx !== 0 && (
        <div
          className={cn(
            "absolute inset-0 flex items-center px-5 text-sm font-medium text-white",
            swipe.dx > 0 ? "justify-start bg-success" : "justify-end bg-info",
          )}
        >
          {swipe.dx > 0 ? <><Check className="mr-1.5 size-4" /> {done ? "Not done" : "Done"}</> : <><Sunrise className="mr-1.5 size-4" /> Tomorrow</>}
        </div>
      )}
    <div
      {...swipe.handlers}
      style={swipe.dx ? { transform: `translateX(${swipe.dx}px)` } : undefined}
      role="button"
      tabIndex={0}
      onClick={() => !swipe.consumeClick() && openTask(task.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter") openTask(task.id)
        if (e.key === " ") {
          e.preventDefault()
          actions.toggle(task)
        }
      }}
      className={cn(
        "group relative flex cursor-pointer touch-pan-y items-start gap-3 bg-card px-4 py-3 outline-none hover:bg-subtle focus-visible:bg-subtle active:bg-subtle sm:py-2.5",
        swipe.dragging ? "" : "transition-[transform,background-color] duration-200",
        className,
      )}
    >
      <CheckCircle checked={done} onChange={() => actions.toggle(task)} label={done ? "Mark as not done" : "Complete task"} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className={cn("min-w-0 flex-1 text-sm leading-snug break-words", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>
            {task.title}
          </span>
          {urgent && !done && (
            <Flag className={cn("mt-0.5 size-3.5 shrink-0", prio.text)} aria-label={`${prio.label} priority`} />
          )}
        </div>
        {meta.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground [&_svg]:size-3">{meta}</div>
        )}
      </div>
      <Menu
        label={task.title}
        className="-my-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
        items={[
          { heading: "Do it" },
          { label: "Today", icon: <Sun />, onSelect: () => actions.reschedule(task, dateKey()) },
          { label: "Tomorrow", icon: <Sunrise />, onSelect: () => actions.reschedule(task, dateKey(addDays(new Date(), 1))) },
          { label: "Next week", icon: <CalendarDays />, onSelect: () => actions.reschedule(task, dateKey(addDays(new Date(), 7))) },
          { label: "No date", icon: <CalendarX2 />, onSelect: () => actions.reschedule(task, null) },
          { separator: true },
          { label: "Edit details", icon: <Pencil />, onSelect: () => openTask(task.id) },
          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => actions.remove(task) },
        ]}
      />
    </div>
    </div>
  )
}

/** Horizontal swipe on touch screens; vertical scrolling is left alone. */
function useSwipe({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const swiped = useRef(false)
  const THRESHOLD = 80

  return {
    dx,
    dragging,
    /** True (once) if the last gesture was a swipe, so it doesn't also open the task. */
    consumeClick: () => {
      const s = swiped.current
      swiped.current = false
      return s
    },
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0]
        start.current = { x: t.clientX, y: t.clientY, locked: null }
      },
      onTouchMove: (e: React.TouchEvent) => {
        const s = start.current
        if (!s) return
        const t = e.touches[0]
        const mx = t.clientX - s.x
        const my = t.clientY - s.y
        if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.locked = Math.abs(mx) > Math.abs(my)
        if (s.locked) {
          setDragging(true)
          setDx(Math.max(-140, Math.min(140, mx)))
        }
      },
      onTouchEnd: () => {
        if (start.current?.locked) {
          swiped.current = true
          if (dx > THRESHOLD) onRight()
          else if (dx < -THRESHOLD) onLeft()
        }
        start.current = null
        setDragging(false)
        setDx(0)
      },
    },
  }
}
