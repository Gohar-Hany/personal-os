"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarClock, CalendarX2, ChevronDown, CircleDot, Columns3, FolderKanban, Layers, List, Plus, Search, SlidersHorizontal, Sparkles, Sun, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { BUCKET_LABELS, bucketOf, dayLabel, effectiveKey, priorityRank, type TaskBucket, splitTicket } from "@/lib/tasks/taskLogic"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { useIsMobile, useMediaQuery } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { EmptyState, Kbd, PageHeader, Segmented } from "@/components/ui/misc"
import { useApp, useClock } from "@/components/app/AppProvider"
import { TaskRow, projectDot } from "@/components/tasks/TaskRow"
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd"
import { TaskDetailPanel } from "@/components/tasks/TaskSheet"
import { PriorityIcon } from "@/components/tasks/TaskIcons"
import { useLiveTasks, useTaskActions } from "@/components/tasks/useTasks"
import type { TaskDTO } from "@/types"

type SmartView = "all" | "overdue" | "today" | "doing" | "someday" | "important"
type GroupBy = "date" | "project" | "priority"

const DATE_ORDER: TaskBucket[] = ["overdue", "today", "tomorrow", "upcoming", "someday"]

interface Group {
  key: string
  title: string
  icon?: React.ReactNode
  tone?: "danger"
  tasks: TaskDTO[]
}

export function TasksClient({ tasks: serverTasks }: { tasks: TaskDTO[] }) {
  const { projects, quickAdd, openTask } = useApp()
  const clock = useClock()
  const all = useLiveTasks(serverTasks)
  const wide = useMediaQuery("(min-width: 1280px)")
  const [view, setView] = useState<"list" | "board">("list")
  const [smart, setSmart] = useState<SmartView>("all")
  const [groupBy, setGroupBy] = useState<GroupBy>("date")
  const [search, setSearch] = useState("")
  const [projectId, setProjectId] = useState("")
  const [showDone, setShowDone] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const mobile = useIsMobile()
  const [showTools, setShowTools] = useState(false)
  // Groups the user folded/unfolded; otherwise long "later" groups start folded on phones
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const isFolded = (key: string, count: number) => folded[key] ?? (mobile && (key === "upcoming" || key === "someday") && count > 3)

  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter(
      (t) =>
        t.status !== "Cancelled" &&
        (!q || t.title.toLowerCase().includes(q) || t.project?.name.toLowerCase().includes(q)) &&
        (!projectId || (projectId === "none" ? !t.projectId : t.projectId === projectId)),
    )
  }, [all, search, projectId])

  const counts = useMemo(() => {
    const c = { all: 0, overdue: 0, today: 0, doing: 0, someday: 0, important: 0 }
    for (const t of base) {
      const b = bucketOf(t, clock)
      if (b === "done") continue
      c.all++
      if (b === "overdue") c.overdue++
      if (b === "today") c.today++
      if (b === "someday") c.someday++
      if (t.status === "InProgress") c.doing++
      if (t.priority === "High" || t.priority === "Critical") c.important++
    }
    return c
  }, [base, clock])

  const matchesSmart = useCallback(
    (t: TaskDTO) => {
      const b = bucketOf(t, clock)
      switch (smart) {
        case "overdue": return b === "overdue"
        case "today": return b === "today" || b === "overdue"
        case "doing": return t.status === "InProgress"
        case "someday": return b === "someday"
        case "important": return t.priority === "High" || t.priority === "Critical"
        default: return true
      }
    },
    [smart, clock],
  )

  const open = useMemo(() => base.filter((t) => bucketOf(t, clock) !== "done" && matchesSmart(t)), [base, clock, matchesSmart])
  const done = useMemo(
    () => base.filter((t) => t.status === "Completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [base],
  )

  const groups: Group[] = useMemo(() => {
    if (groupBy === "project") {
      const map = new Map<string, TaskDTO[]>()
      for (const t of open) map.set(t.projectId ?? "", [...(map.get(t.projectId ?? "") ?? []), t])
      const order = [...projects.map((p) => p.id), ""]
      return order
        .filter((id) => map.has(id))
        .map((id) => {
          const p = projects.find((x) => x.id === id)
          return {
            key: id || "none",
            title: p?.name ?? "No project",
            icon: p ? <span className={cn("size-2 rounded-full", projectDot(p.id))} /> : <FolderKanban className="size-3.5" />,
            tasks: map.get(id)!,
          }
        })
    }
    if (groupBy === "priority") {
      return ["Critical", "High", "Medium", "Low"]
        .map((p) => ({ key: p, title: TASK_PRIORITY_META[p].label, icon: <PriorityIcon priority={p} className="size-3.5" />, tasks: open.filter((t) => t.priority === p) }))
        .filter((g) => g.tasks.length)
    }
    const by: Record<TaskBucket, TaskDTO[]> = { overdue: [], today: [], tomorrow: [], upcoming: [], someday: [], done: [] }
    for (const t of open) by[bucketOf(t, clock)].push(t)
    return DATE_ORDER.filter((b) => by[b].length).map((b) => ({ key: b, title: BUCKET_LABELS[b], tone: b === "overdue" ? ("danger" as const) : undefined, tasks: by[b] }))
  }, [groupBy, open, projects, clock])

  const ordered = useMemo(() => [...groups.flatMap((g) => g.tasks), ...(showDone ? done.slice(0, 50) : [])], [groups, done, showDone])

  // Side panel on wide screens, sheet elsewhere
  const openFn = useCallback((id: string) => (wide ? setSelected(id) : openTask(id)), [wide, openTask])
  const selectedTask = wide && selected ? all.find((t) => t.id === selected) : undefined

  useListKeyboard(ordered, selected, wide ? setSelected : undefined)

  const filtering = !!(search || projectId || smart !== "all")
  const SMART: { value: SmartView; label: string; icon: React.ReactNode; count: number; tone?: string }[] = [
    { value: "all", label: "All open", icon: <Layers />, count: counts.all },
    { value: "overdue", label: "Overdue", icon: <AlertCircle />, count: counts.overdue, tone: "text-danger" },
    { value: "today", label: "Today", icon: <Sun />, count: counts.today + counts.overdue },
    { value: "doing", label: "In progress", icon: <CircleDot />, count: counts.doing },
    { value: "important", label: "Important", icon: <Zap />, count: counts.important },
    { value: "someday", label: "No date", icon: <CalendarX2 />, count: counts.someday },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description={
          <span className="hidden sm:inline">
            Navigate with <Kbd>↑</Kbd> <Kbd>↓</Kbd> · <Kbd>X</Kbd> complete · <Kbd>→</Kbd> subtasks · <Kbd>N</Kbd> new
          </span>
        }
        actions={
          <>
            <Segmented
              className="hidden sm:inline-flex"
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: <><List /> List</> },
                { value: "board", label: <><Columns3 /> Board</> },
              ]}
            />
            <Button variant="primary" onClick={() => quickAdd({ mode: "task" })} className="hidden sm:inline-flex">
              <Plus /> New task
            </Button>
          </>
        }
        className="max-sm:hidden"
      />

      {/* Phones: compact title row — search and filters only when asked for */}
      <div className="flex items-center gap-2 sm:hidden">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">Tasks</h1>
        <Button
          size="icon"
          variant={showTools || search ? "secondary" : "ghost"}
          aria-label="Search and filters"
          aria-pressed={showTools}
          onClick={() => setShowTools((v) => !v)}
          className="relative"
        >
          <SlidersHorizontal />
          {(search || projectId || groupBy !== "date") && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
        </Button>
      </div>

      {/* Smart views — one tap to what matters */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        {SMART.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSmart(s.value)}
            aria-pressed={smart === s.value}
            disabled={s.count === 0 && s.value !== "all" && smart !== s.value}
            className={cn(
              "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-default disabled:opacity-40 sm:h-auto sm:gap-2 sm:rounded-xl sm:py-2 [&_svg]:size-4",
              smart === s.value ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn(smart !== s.value && s.tone)}>{s.icon}</span>
            {s.label}
            <span className={cn("rounded-md px-1.5 text-xs tabular", smart === s.value ? "bg-primary/15" : "bg-muted", s.tone && s.count > 0 && smart !== s.value && s.tone)}>{s.count}</span>
          </button>
        ))}
      </div>

      {/* Search, project, grouping — always shown on desktop, on demand on phones */}
      <div className={cn("flex-col gap-2 sm:flex sm:flex-row", showTools || search ? "flex" : "hidden")}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or projects"
            aria-label="Search tasks"
            className="h-10 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/15 sm:h-9 sm:text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder="All projects"
            icon={<FolderKanban />}
            options={[{ value: "none", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name, icon: <span className={cn("size-2 rounded-full", projectDot(p.id))} /> }))]}
            className="sm:w-48"
            aria-label="Filter by project"
          />
          {view === "list" && (
            <Select
              value={groupBy}
              onChange={(v) => setGroupBy(v as GroupBy)}
              icon={<Layers />}
              options={[
                { value: "date", label: "By date", icon: <CalendarClock /> },
                { value: "project", label: "By project", icon: <FolderKanban /> },
                { value: "priority", label: "By priority", icon: <Zap /> },
              ]}
              className="sm:w-44"
              aria-label="Group tasks"
            />
          )}
        </div>
      </div>

      {view === "list" ? (
        <div className={cn("grid items-start gap-5", wide && "grid-cols-[minmax(0,1fr)_420px]")}>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <TaskInlineAdd
              className="border-b border-border"
              defaults={{
                projectId: projectId && projectId !== "none" ? projectId : undefined,
                scheduledDate: smart === "today" ? clock.today : undefined,
              }}
              placeholder={smart === "today" ? "Add a task for today" : mobile ? "Add a task" : "Add a task — try “Review PR tomorrow 8pm #saudi !high”"}
            />
            {open.length === 0 && done.length === 0 ? (
              <EmptyState
                icon={<Sparkles />}
                title={filtering ? "Nothing here" : "No tasks yet"}
                description={filtering ? "Try another view, project or search." : "Add your first task above."}
                action={filtering && <Button variant="outline" onClick={() => { setSmart("all"); setSearch(""); setProjectId("") }}>Show all tasks</Button>}
              />
            ) : (
              <div className="pb-2">
                {groups.map((g) => (
                  <section key={g.key}>
                    <button
                      type="button"
                      onClick={() => setFolded((f) => ({ ...f, [g.key]: !isFolded(g.key, g.tasks.length) }))}
                      aria-expanded={!isFolded(g.key, g.tasks.length)}
                      className={cn("sticky top-0 z-[2] flex w-full cursor-pointer items-center gap-2 border-b border-border bg-subtle/95 px-4 py-2.5 text-left text-xs font-semibold backdrop-blur sm:py-2", g.tone === "danger" ? "text-danger" : "text-muted-foreground")}
                    >
                      <ChevronDown className={cn("size-3.5 transition-transform", isFolded(g.key, g.tasks.length) && "-rotate-90")} />
                      {g.icon}
                      <span className="tracking-wide uppercase">{g.title}</span>
                      <span className="font-medium tabular opacity-70">{g.tasks.length}</span>
                    </button>
                    {!isFolded(g.key, g.tasks.length) && <div className="divide-y divide-border/60">
                      {g.tasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          onOpen={openFn}
                          selected={selectedTask?.id === t.id}
                          showDate={!(groupBy === "date" && g.key === "today")}
                          showProject={groupBy !== "project" && !projectId}
                        />
                      ))}
                    </div>}
                  </section>
                ))}
                {open.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing open in this view. 🎉</p>}
                {done.length > 0 && smart === "all" && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setShowDone((v) => !v)}
                      aria-expanded={showDone}
                      className="flex w-full cursor-pointer items-center gap-1.5 border-t border-border px-4 pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
                    >
                      <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                      Completed <span className="font-medium tabular opacity-70">{done.length}</span>
                    </button>
                    {showDone && (
                      <div className="divide-y divide-border/60">
                        {done.slice(0, 50).map((t) => <TaskRow key={t.id} task={t} onOpen={openFn} selected={selectedTask?.id === t.id} showProject={!projectId} />)}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>

          {wide && (
            <aside className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              {selectedTask ? (
                <TaskDetailPanel key={selectedTask.id} taskId={selectedTask.id} onClose={() => setSelected(null)} />
              ) : (
                <SummaryPanel tasks={open} />
              )}
            </aside>
          )}
        </div>
      ) : (
        <Board tasks={base.filter((t) => matchesSmart(t) || t.status === "Completed")} />
      )}
    </div>
  )
}

/** What the side panel shows when no task is selected: a quick read of the list. */
function SummaryPanel({ tasks }: { tasks: TaskDTO[] }) {
  const clock = useClock()
  const { projects } = useApp()
  const upcoming = tasks
    .map((t) => ({ t, k: effectiveKey(t, clock) }))
    .filter((x) => x.k && x.k > clock.today)
    .sort((a, b) => (a.k! < b.k! ? -1 : 1))
    .slice(0, 5)
  const byProject = projects
    .map((p) => ({ p, n: tasks.filter((t) => t.projectId === p.id).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold">Select a task</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Its details open here. Use ↑ ↓ to move through the list.</p>
      </div>
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Coming up</p>
          {upcoming.map(({ t, k }) => (
            <div key={t.id} className="flex items-center gap-2 text-[13px]">
              <PriorityIcon priority={t.priority} className="size-3.5" />
              <span className="min-w-0 flex-1 truncate">{splitTicket(t.title).text}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{dayLabel(k!, clock.today)}</span>
            </div>
          ))}
        </div>
      )}
      {byProject.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Open by project</p>
          {byProject.map(({ p, n }) => (
            <div key={p.id} className="flex items-center gap-2 text-[13px]">
              <span className={cn("size-2 rounded-full", projectDot(p.id))} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground tabular">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** ↑/↓ (or j/k) move focus through rows; on wide screens the focused task opens in the side panel. */
function useListKeyboard(tasks: TaskDTO[], selected: string | null, select?: (id: string) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (document.querySelector("[role=dialog]")) return
      const down = e.key === "ArrowDown" || e.key === "j"
      const up = e.key === "ArrowUp" || e.key === "k"
      if (!down && !up) return
      if (!tasks.length) return
      e.preventDefault()
      const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.taskRow ?? selected
      const i = tasks.findIndex((t) => t.id === focusedId)
      const next = tasks[Math.max(0, Math.min(tasks.length - 1, i === -1 ? 0 : i + (down ? 1 : -1)))]
      const el = document.querySelector<HTMLElement>(`[data-task-row="${next.id}"]`)
      el?.focus()
      el?.scrollIntoView({ block: "nearest" })
      select?.(next.id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [tasks, selected, select])
}

const COLUMNS = [
  { status: "Todo", label: "To do" },
  { status: "InProgress", label: "In progress" },
  { status: "Completed", label: "Done" },
]

/** Three columns. Drag a card to change its status, or click to open it. */
function Board({ tasks }: { tasks: TaskDTO[] }) {
  const { openTask } = useApp()
  const clock = useClock()
  const actions = useTaskActions()
  const [dragOver, setDragOver] = useState<string | null>(null)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
        const shown = col.status === "Completed" ? items.slice(0, 30) : items
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(col.status)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              const id = e.dataTransfer.getData("text/task-id")
              const task = tasks.find((t) => t.id === id)
              if (task && task.status !== col.status) {
                actions.update(task, { status: col.status, completedAt: col.status === "Completed" ? new Date().toISOString() : null })
              }
            }}
            className={cn("rounded-2xl border border-border bg-subtle p-2 transition-colors", dragOver === col.status && "border-primary/50 bg-primary-soft")}
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-[13px] font-semibold">{col.label}</span>
              <span className="text-xs text-muted-foreground tabular">{items.length}</span>
            </div>
            <div className="min-h-24 space-y-2">
              {shown.map((t) => {
                const key = effectiveKey(t, clock)
                const overdue = bucketOf(t, clock) === "overdue"
                const subs = t.subtasks ?? []
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => openTask(t.id)}
                    className="cursor-pointer rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:border-border-strong active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <PriorityIcon priority={t.priority} className="mt-0.5" />
                      <p className={cn("min-w-0 flex-1 text-[13px] leading-snug", t.status === "Completed" && "text-muted-foreground line-through")}>{splitTicket(t.title).code && <span className="mr-1.5 rounded bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">{splitTicket(t.title).code}</span>}{splitTicket(t.title).text}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                      {key && t.status !== "Completed" && <span className={cn(overdue && "font-medium text-danger")}>{dayLabel(key, clock.today)}</span>}
                      {subs.length > 0 && <span className="tabular">{subs.filter((s) => s.status === "Completed").length}/{subs.length} subtasks</span>}
                      {t.project && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <span className={cn("size-1.5 rounded-full", projectDot(t.project.id))} />
                          <span className="truncate">{t.project.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Drop tasks here</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
