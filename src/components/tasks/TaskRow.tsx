"use client"

import { useRef, useState } from "react"
import {
  Check, CalendarDays, CalendarX2, ChevronRight, CircleDot, Clock, Hourglass, Pencil, Plus, Sun, Sunrise, Trash2, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTime12 } from "@/lib/dates"
import { addDaysToKey, weekStartKey } from "@/lib/zone"
import { bucketOf, dayLabel, effectiveKey, isDeadlineSoon, keyOf, parseTags, splitTitle } from "@/lib/tasks/taskLogic"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { DatePicker } from "@/components/ui/datepicker"
import { Menu, type MenuItem } from "@/components/ui/menu"
import { useApp, useClock } from "@/components/app/AppProvider"
import { useTaskActions } from "@/components/tasks/useTasks"
import { useSubtasks } from "@/components/tasks/useSubtasks"
import { PriorityIcon, StatusCheck } from "@/components/tasks/TaskIcons"
import { LabelList } from "@/components/tasks/TaskLabels"
import { useToast } from "@/components/ui/toast"
import { haptic } from "@/lib/hooks"
import type { SubtaskDTO, TaskDTO } from "@/types"

const PROJECT_DOTS = ["bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500"]

/** A stable colour per project, so the same project always looks the same everywhere. */
export function projectDot(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return PROJECT_DOTS[Math.abs(h) % PROJECT_DOTS.length]
}

/** "Kassem Dental · Send the proposal": who/what first in bold, then the action. No ticket code. */
export function TaskTitle({ title, done, className }: { title: string; done?: boolean; className?: string }) {
  const parts = splitTitle(title)
  return (
    <span className={cn("min-w-0 truncate", done && "text-muted-foreground line-through decoration-muted-foreground/50", className)}>
      {parts.subject && (
        <>
          <span className={cn("font-medium", !done && "text-foreground")}>{parts.subject}</span>
          <span className="px-1.5 text-muted-foreground/60">·</span>
        </>
      )}
      <span className={cn(!done && (parts.subject ? "text-foreground/75" : "text-foreground"))}>{parts.text}</span>
    </span>
  )
}

/**
 * Column widths for the table layout. The list is an `@container/list`, so columns
 * appear as the list gets wider (not the window): opening the side panel hides
 * the least important ones instead of squeezing titles.
 */
export const TASK_COLS = {
  code: "hidden w-[5.75rem] shrink-0 @3xl/list:block",
  labels: "hidden w-52 shrink-0 @4xl/list:flex",
  priority: "hidden w-[5.5rem] shrink-0 @xl/list:flex",
  date: "flex w-24 shrink-0",
  deadline: "hidden w-24 shrink-0 @3xl/list:flex",
  menu: "w-7 shrink-0",
}

/**
 * One task.
 * Desktop: a single dense line; with `table`, aligned columns (labels, priority, dates).
 * Phone: who/what in bold, the action under it, then one line of details;
 * swipe right = done, left = tomorrow, press and hold = actions.
 * Subtasks expand in place. Click the row to open details.
 */
export function TaskRow({
  task,
  showProject = true,
  showDate = true,
  table,
  codeColumn,
  selected,
  onOpen,
  className,
}: {
  task: TaskDTO
  showProject?: boolean
  showDate?: boolean
  /** Desktop table layout with columns (Tasks page). */
  table?: boolean
  /** Table only: ticket codes get their own column so titles line up. */
  codeColumn?: boolean
  /** Highlighted as the one shown in the side panel. */
  selected?: boolean
  /** Defaults to the global task sheet. */
  onOpen?: (id: string) => void
  className?: string
}) {
  const { openTask } = useApp()
  const clock = useClock()
  const open = onOpen ?? openTask
  const actions = useTaskActions()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const tomorrow = addDaysToKey(clock.today, 1)

  const swipe = useSwipe({
    onRight: () => {
      haptic(12)
      actions.toggle(task)
    },
    onLeft: () => {
      haptic(12)
      const before = { scheduledDate: task.scheduledDate ?? null, startTime: task.startTime ?? null, endTime: task.endTime ?? null }
      actions.reschedule(task, tomorrow)
      toast.success("Moved to tomorrow", { label: "Undo", onClick: () => actions.update(task, before) })
    },
    onLongPress: () => {
      haptic(20)
      setSheetOpen(true)
    },
  })

  const done = task.status === "Completed"
  const bucket = bucketOf(task, clock)
  const key = effectiveKey(task, clock)
  const schedKey = keyOf(task.scheduledDate, clock)
  const dueKey = keyOf(task.dueDate, clock)
  const subs = task.subtasks ?? []
  const subsDone = subs.filter((s) => s.status === "Completed").length
  const showDateChip = showDate && key && !done && !(bucket === "today" && !task.startTime)
  const parts = splitTitle(task.title)
  const labels = parseTags(task.tags)
  const mobilePriority = task.priority === "High" || task.priority === "Critical"
  const dueSoon = isDeadlineSoon(task, clock)
  const struck = "text-muted-foreground line-through decoration-muted-foreground/50"

  const codeChip = parts.code ? (
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-tight text-muted-foreground">{parts.code}</span>
  ) : null


  const subtaskPill = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setExpanded((v) => !v)
      }}
      onTouchStart={(e) => e.stopPropagation()}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Hide" : "Show"} ${subs.length} subtasks`}
      className={cn(
        "-my-1 inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-medium tabular transition-colors sm:my-0 sm:h-6",
        subsDone === subs.length && subs.length > 0 ? "text-success" : "text-muted-foreground",
        expanded ? "bg-muted text-foreground" : "bg-muted/60 hover:bg-muted sm:bg-transparent",
      )}
    >
      <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
      {subsDone}/{subs.length}
    </button>
  )

  const menuItems: MenuItem[] = [
    { heading: "Do it" },
    { label: "Today", icon: <Sun />, onSelect: () => actions.reschedule(task, clock.today) },
    { label: "Tomorrow", icon: <Sunrise />, onSelect: () => actions.reschedule(task, tomorrow) },
    { label: "Next week", icon: <CalendarDays />, onSelect: () => actions.reschedule(task, addDaysToKey(weekStartKey(clock.today), 7)) },
    { label: "No date", icon: <CalendarX2 />, onSelect: () => actions.reschedule(task, null) },
    { separator: true },
    task.status === "InProgress"
      ? { label: "Mark as to do", icon: <CircleDot />, onSelect: () => actions.update(task, { status: "Todo" }) }
      : { label: "Start (in progress)", icon: <CircleDot />, onSelect: () => actions.update(task, { status: "InProgress" }) },
    { label: "Add subtask", icon: <Plus />, onSelect: () => setExpanded(true) },
    { label: "Edit details", icon: <Pencil />, onSelect: () => open(task.id) },
    { separator: true },
    { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => actions.remove(task) },
  ]

  const dateChip = showDateChip ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap tabular",
        bucket === "overdue" ? "font-medium text-danger" : bucket === "today" ? "font-medium text-primary" : "text-muted-foreground",
      )}
    >
      {task.startTime ? <Clock /> : <CalendarDays />}
      {bucket !== "today" && dayLabel(key!, clock.today)}
      {task.startTime && <span>{bucket !== "today" && " · "}{formatTime12(task.startTime)}{task.endTime && `–${formatTime12(task.endTime)}`}</span>}
    </span>
  ) : null

  const deadlineChip =
    dueKey && task.scheduledDate && !done ? (
      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", dueSoon ? "font-medium text-danger" : "text-muted-foreground")}>
        <Hourglass /> Due {dayLabel(dueKey, clock.today)}
      </span>
    ) : null

  const projectChip =
    showProject && task.project ? (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className={cn("size-2 shrink-0 rounded-full", projectDot(task.project.id))} />
        <span className="truncate">{task.project.name}</span>
      </span>
    ) : null

  const priorityMenu = (withLabel: boolean) => (
    <Menu
      label="Priority"
      trigger={
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Priority: ${TASK_PRIORITY_META[task.priority]?.label}. Change`}
          className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md hover:bg-muted", withLabel ? "-mx-1.5 -my-1 px-1.5 py-1" : "-m-1 p-1")}
        >
          <PriorityIcon priority={task.priority} className={cn(done && "opacity-40")} />
          {withLabel && (
            <span className={cn("text-xs", task.priority === "Critical" ? "font-medium text-danger" : "text-muted-foreground")}>{TASK_PRIORITY_META[task.priority]?.label}</span>
          )}
        </button>
      }
      align="start"
      items={["Critical", "High", "Medium", "Low"].map((pr) => ({
        label: TASK_PRIORITY_META[pr].label,
        icon: <PriorityIcon priority={pr} />,
        hint: pr === task.priority ? "✓" : undefined,
        onSelect: () => actions.update(task, { priority: pr }),
      }))}
    />
  )

  /** A date you can click to change (desktop). Empty cells show a hint on hover. */
  const dateCell = (value: string | null, onChange: (v: string | null) => void, display: React.ReactNode, empty: string, title: string) => (
    <DatePicker
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
      title={title}
      trigger={
        <button type="button" onClick={(e) => e.stopPropagation()} aria-label={title} className="-mx-1.5 -my-1 max-w-full cursor-pointer rounded-md px-1.5 py-1 hover:bg-muted">
          {display ?? (
            <span className="inline-flex items-center gap-1 text-muted-foreground/0 group-hover:text-muted-foreground">
              <CalendarDays /> {done ? "" : empty}
            </span>
          )}
        </button>
      }
    />
  )

  const schedCell =
    schedKey && !done ? (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap tabular",
          schedKey < clock.today ? "font-medium text-danger" : schedKey === clock.today ? "font-medium text-primary" : "text-foreground/80",
        )}
      >
        {task.startTime ? <Clock /> : <CalendarDays />}
        {dayLabel(schedKey, clock.today)}
        {task.startTime && <span className="text-muted-foreground">{formatTime12(task.startTime)}</span>}
      </span>
    ) : null

  const dueCell =
    dueKey && !done ? (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap tabular",
          dueKey < clock.today ? "font-medium text-danger" : dueSoon ? "font-medium text-warning" : "text-muted-foreground",
        )}
      >
        <Hourglass />
        {dayLabel(dueKey, clock.today)}
      </span>
    ) : null

  return (
    <div className={cn("relative", className)}>
      <div className="relative overflow-hidden">
        {/* Revealed behind the row while swiping on a phone */}
        {swipe.dx !== 0 && (
          <div className={cn("absolute inset-0 flex items-center px-5 text-sm font-medium text-white", swipe.dx > 0 ? "justify-start bg-success" : "justify-end bg-info")}>
            {swipe.dx > 0 ? <><Check className="mr-1.5 size-4" /> {done ? "Not done" : "Done"}</> : <><Sunrise className="mr-1.5 size-4" /> Tomorrow</>}
          </div>
        )}
        <div
          {...swipe.handlers}
          style={swipe.dx ? { transform: `translateX(${swipe.dx}px)` } : undefined}
          role="button"
          tabIndex={0}
          data-task-row={task.id}
          aria-current={selected || undefined}
          onClick={() => !swipe.consumeClick() && open(task.id)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === "Enter") open(task.id)
            if (e.key === " " || e.key.toLowerCase() === "x") {
              e.preventDefault()
              actions.toggle(task)
            }
            if (e.key === "ArrowRight" && subs.length) setExpanded(true)
            if (e.key === "ArrowLeft") setExpanded(false)
          }}
          className={cn(
            "group relative flex cursor-pointer touch-pan-y items-start gap-3 bg-card px-4 py-3 outline-none sm:items-center sm:py-2",
            table && "sm:min-h-11",
            "hover:bg-subtle focus-visible:bg-subtle active:bg-subtle",
            selected && "bg-primary-soft/60 hover:bg-primary-soft/70 before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary",
            swipe.dragging ? "" : "transition-[transform,background-color] duration-150",
          )}
        >
          <StatusCheck status={task.status} onToggle={() => actions.toggle(task)} label={done ? "Mark as not done" : "Complete task"} className="mt-px sm:mt-0" />

          {/* ── Phone ── */}
          <div className="min-w-0 flex-1 sm:hidden">
            {parts.subject ? (
              <>
                <p className={cn("text-[15px] leading-snug font-semibold", done && struck)}>{parts.subject}</p>
                <p className={cn("mt-0.5 line-clamp-2 text-sm leading-snug", done ? struck : "text-foreground/70")}>{parts.text}</p>
              </>
            ) : (
              <p className={cn("text-[15px] leading-snug", done && struck)}>{parts.text}</p>
            )}
            {(mobilePriority || parts.code || dateChip || deadlineChip || projectChip || subs.length > 0 || labels.length > 0 || task.status === "InProgress") && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs [&_svg]:size-3">
                {mobilePriority && <PriorityIcon priority={task.priority} className={cn("size-3.5", done && "opacity-40")} />}
                {task.status === "InProgress" && <span className="font-medium text-warning">In progress</span>}
                {codeChip}
                {dateChip}
                {deadlineChip}
                {labels.length > 0 && <LabelList labels={labels} max={2} />}
                {projectChip}
                {subs.length > 0 && subtaskPill}
              </div>
            )}
          </div>

          {/* ── Desktop ── */}
          {table && codeColumn && <span className={cn(TASK_COLS.code, "truncate font-mono text-[11px] text-muted-foreground max-sm:hidden")}>{parts.code}</span>}
          <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            {!table && priorityMenu(false)}
            {codeChip && <span className={cn("inline-flex shrink-0", table && codeColumn && "@3xl/list:hidden")}>{codeChip}</span>}
            <TaskTitle title={task.title} done={done} className="text-sm" />
            {task.status === "InProgress" && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                <CircleDot className="size-3" /> In progress
              </span>
            )}
            {subs.length > 0 && subtaskPill}
          </div>

          {table ? (
            <div className="hidden shrink-0 items-center gap-3 text-xs sm:flex [&_svg]:size-3.5">
              <span className={cn(TASK_COLS.labels, "min-w-0 overflow-hidden")}>
                <LabelList labels={labels} />
              </span>
              <span className={TASK_COLS.priority}>{priorityMenu(true)}</span>
              {showDate && <span className={TASK_COLS.date}>{dateCell(schedKey, (v) => actions.reschedule(task, v), schedCell, "Set date", "Do on")}</span>}
              <span className={TASK_COLS.deadline}>{dateCell(dueKey, (v) => actions.update(task, { dueDate: v }), dueCell, "Deadline", "Deadline")}</span>
            </div>
          ) : (
            <div className="hidden min-w-0 shrink-0 items-center gap-4 text-xs [&_svg]:size-3.5 sm:flex sm:max-w-[55%]">
              {labels.length > 0 && <LabelList labels={labels} max={2} className="hidden 2xl:flex" />}
              {deadlineChip && <span className="hidden shrink-0 xl:inline-flex">{deadlineChip}</span>}
              {showProject && <span className="hidden min-w-0 max-w-40 justify-end md:flex">{projectChip}</span>}
              {showDate && (
                <span className="flex min-w-[5.5rem] shrink-0 justify-end">
                  {dateCell(schedKey, (v) => actions.reschedule(task, v), dateChip, bucket === "today" ? "Today" : "Set date", "Reschedule")}
                </span>
              )}
            </div>
          )}

          <span className={cn("hidden sm:flex", table && TASK_COLS.menu)}>
            <Menu label={task.title} className="-my-0.5 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100" items={menuItems} />
          </span>
          {/* Phones: press and hold the row for actions */}
          <Menu label={parts.subject ?? parts.text} sheetOnly open={sheetOpen} onOpenChange={setSheetOpen} items={menuItems} />
        </div>
      </div>

      {expanded && <InlineSubtasks task={task} />}
    </div>
  )
}

/** Subtasks under their parent: indented, a thread line, check/rename/delete in place. */
function InlineSubtasks({ task }: { task: TaskDTO }) {
  const s = useSubtasks(task)
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState<string | null>(null)

  const commit = () => {
    const t = draft.trim()
    if (t) s.add(t)
    setDraft("")
  }

  return (
    <div className="relative bg-card pb-1.5 before:absolute before:top-0 before:bottom-3 before:left-[25px] before:w-px before:bg-border">
      {s.subtasks.map((sub) => (
        <SubtaskLine key={sub.id} sub={sub} editing={editing === sub.id} setEditing={(v) => setEditing(v ? sub.id : null)} onToggle={() => s.toggle(sub)} onRename={(t) => s.rename(sub, t)} onRemove={() => s.remove(sub)} />
      ))}
      <div className="flex items-center gap-2.5 py-1.5 pr-4 pl-[46px]">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          placeholder="Add subtask"
          aria-label={`Add a subtask to ${task.title}`}
          className="h-7 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70 sm:text-[13px]"
        />
      </div>
    </div>
  )
}

function SubtaskLine({
  sub,
  editing,
  setEditing,
  onToggle,
  onRename,
  onRemove,
}: {
  sub: SubtaskDTO
  editing: boolean
  setEditing: (v: boolean) => void
  onToggle: () => void
  onRename: (title: string) => void
  onRemove: () => void
}) {
  const [value, setValue] = useState(sub.title)
  const done = sub.status === "Completed"
  const save = () => {
    setEditing(false)
    const t = value.trim()
    if (t && t !== sub.title) onRename(t)
    else setValue(sub.title)
  }
  return (
    <div className="group/sub flex items-center gap-2.5 py-1 pr-3 pl-[40px] hover:bg-subtle">
      <StatusCheck size="sm" status={sub.status} onToggle={onToggle} label={sub.title} className="relative z-[1] bg-card group-hover/sub:bg-subtle" />
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") {
              setValue(sub.title)
              setEditing(false)
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-md bg-muted px-2 text-base outline-none sm:text-[13px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn("min-w-0 flex-1 cursor-text py-1 text-left text-[15px] leading-snug sm:truncate sm:text-[13px]", done && "text-muted-foreground line-through decoration-muted-foreground/50")}
          title="Click to rename"
        >
          {sub.title}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete ${sub.title}`}
        className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:group-hover/sub:opacity-100 sm:focus:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** Horizontal swipe + long-press on touch screens; vertical scrolling is left alone. */
function useSwipe({ onLeft, onRight, onLongPress }: { onLeft: () => void; onRight: () => void; onLongPress?: () => void }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const swiped = useRef(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const THRESHOLD = 80
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

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
        longPressed.current = false
        if (onLongPress) {
          cancelPress()
          pressTimer.current = setTimeout(() => {
            pressTimer.current = null
            longPressed.current = true
            swiped.current = true // swallow the click that follows
            onLongPress()
          }, 480)
        }
      },
      onTouchMove: (e: React.TouchEvent) => {
        const s = start.current
        if (!s) return
        const t = e.touches[0]
        const mx = t.clientX - s.x
        const my = t.clientY - s.y
        if (Math.abs(mx) > 8 || Math.abs(my) > 8) cancelPress()
        if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.locked = Math.abs(mx) > Math.abs(my)
        if (s.locked) {
          setDragging(true)
          setDx(Math.max(-140, Math.min(140, mx)))
        }
      },
      onTouchEnd: (e: React.TouchEvent) => {
        cancelPress()
        // After a long-press the sheet is already open: stop the browser's follow-up
        // click, which would otherwise land on the sheet's overlay and close it.
        if (longPressed.current) {
          e.preventDefault()
          longPressed.current = false
        }
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
