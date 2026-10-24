"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle, ArrowUpRight, CalendarClock, CalendarDays, CalendarX2, CheckCircle2, ChevronDown, CircleDot, Columns3, Flag, FolderKanban,
  Layers, List, Plus, Search, SlidersHorizontal, Sparkles, Sun, X, Zap,
} from "lucide-react"
import { cn, calcProgress } from "@/lib/utils"
import { BUCKET_LABELS, bucketOf, daysBetween, dayLabel, effectiveKey, parseTags, priorityRank, splitTitle } from "@/lib/tasks/taskLogic"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { addDaysToKey } from "@/lib/zone"
import { useIsMobile, useMediaQuery, useStoredState } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { EmptyState } from "@/components/ui/misc"
import { useApp, useClock } from "@/components/app/AppProvider"
import { TASK_COLS, TaskRow, projectDot } from "@/components/tasks/TaskRow"
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd"
import { TaskDetailPanel } from "@/components/tasks/TaskSheet"
import { PriorityIcon } from "@/components/tasks/TaskIcons"
import { LabelFilter, LabelList, collectLabels } from "@/components/tasks/TaskLabels"
import { useLiveTasks, useTaskActions } from "@/components/tasks/useTasks"
import type { TaskDTO } from "@/types"

type SmartView = "all" | "today" | "week" | "important" | "someday" | "done"
const GROUPINGS = ["project", "date", "priority", "status"] as const
type GroupBy = (typeof GROUPINGS)[number]

type AddDefaults = { scheduledDate?: string; projectId?: string; milestoneId?: string; priority?: string; status?: string }

/** One block of the list. A project is followed by its milestones. */
interface Section {
  key: string
  kind: "project" | "milestone" | "group"
  title: string
  icon?: React.ReactNode
  tone?: "danger"
  tasks: TaskDTO[]
  /** Done vs. total for the whole milestone/project — not just what the filters show. */
  progress?: { done: number; total: number }
  /** Folding a project folds its milestones too. */
  parent?: string
  href?: string
  add?: AddDefaults
  /** Shown count when it differs from `tasks` (a project counts its milestones' tasks too). */
  count?: number
}

// Quiet "pill" controls for the toolbar (Select/LabelFilter use field styles by default)
const GHOST =
  "h-9 w-auto gap-1.5 rounded-full border-transparent bg-transparent px-3 text-[13px] text-muted-foreground hover:border-transparent hover:bg-muted hover:text-foreground data-[state=open]:border-transparent data-[state=open]:bg-muted data-[state=open]:ring-0 sm:h-9 sm:text-[13px]"

export function TasksClient({ tasks: serverTasks }: { tasks: TaskDTO[] }) {
  const { projects, quickAdd, openTask } = useApp()
  const clock = useClock()
  const all = useLiveTasks(serverTasks)
  const wide = useMediaQuery("(min-width: 1280px)")
  const mobile = useIsMobile()
  const [storedView, setView] = useStoredState<"list" | "board">("tasks:view", "list", ["list", "board"])
  // Phones have no List/Board switch, so they always get the list
  const view = mobile ? "list" : storedView
  const [groupBy, setGroupBy] = useStoredState<GroupBy>("tasks:group", "project", GROUPINGS)
  const [smart, setSmart] = useState<SmartView>("all")
  const [search, setSearch] = useState("")
  const [projectId, setProjectId] = useState("")
  const [labels, setLabels] = useState<string[]>([])
  const [showDone, setShowDone] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [showTools, setShowTools] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  // Sections the user folded/unfolded; otherwise long "later" date groups start folded on phones
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const isFolded = (s: Section) =>
    (s.parent ? !!folded[s.parent] : false) || (folded[s.key] ?? (mobile && (s.key === "later" || s.key === "someday") && s.tasks.length > 3))

  const allLabels = useMemo(() => collectLabels(all.filter((t) => t.status !== "Cancelled")), [all])
  const weekEnd = addDaysToKey(clock.today, 7)

  // Search, project and label filters (the view tab comes on top)
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    const want = labels.map((l) => l.toLowerCase())
    return all.filter((t) => {
      if (t.status === "Cancelled") return false
      if (q && !`${t.title} ${t.project?.name ?? ""} ${t.milestone?.title ?? ""} ${parseTags(t.tags).join(" ")}`.toLowerCase().includes(q)) return false
      if (projectId && (projectId === "none" ? t.projectId : t.projectId !== projectId)) return false
      if (want.length && !parseTags(t.tags).some((l) => want.includes(l.toLowerCase()))) return false
      return true
    })
  }, [all, search, projectId, labels])

  const matchesSmart = useCallback(
    (t: TaskDTO) => {
      const b = bucketOf(t, clock)
      if (smart === "done") return b === "done"
      if (b === "done") return false
      switch (smart) {
        case "today": return b === "today" || b === "overdue"
        case "week": { const k = effectiveKey(t, clock); return !!k && k <= weekEnd }
        case "important": return t.priority === "High" || t.priority === "Critical"
        case "someday": return b === "someday"
        default: return true
      }
    },
    [smart, clock, weekEnd],
  )

  const counts = useMemo(() => {
    const c = { all: 0, today: 0, week: 0, important: 0, someday: 0, done: 0, overdue: 0 }
    for (const t of base) {
      const b = bucketOf(t, clock)
      if (b === "done") {
        c.done++
        continue
      }
      const k = effectiveKey(t, clock)
      c.all++
      if (b === "overdue") c.overdue++
      if (b === "today" || b === "overdue") c.today++
      if (k && k <= weekEnd) c.week++
      if (b === "someday") c.someday++
      if (t.priority === "High" || t.priority === "Critical") c.important++
    }
    return c
  }, [base, clock, weekEnd])

  const shown = useMemo(() => {
    const list = base.filter(matchesSmart)
    return smart === "done" ? list.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")) : list
  }, [base, matchesSmart, smart])
  const done = useMemo(
    () => (smart === "all" ? base.filter((t) => t.status === "Completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")) : []),
    [base, smart],
  )

  const sections: Section[] = useMemo(
    () => (smart === "done" ? [{ key: "done", kind: "group", title: "Completed", icon: <CheckCircle2 className="size-4 text-success" />, tasks: shown }] : buildSections(groupBy, shown, all, projects, clock)),
    [smart, groupBy, shown, all, projects, clock],
  )
  const codeColumn = useMemo(() => shown.some((t) => splitTitle(t.title).code), [shown])
  const ordered = [...sections.filter((s) => !isFolded(s)).flatMap((s) => s.tasks), ...(showDone ? done.slice(0, 50) : [])]

  // Side panel on wide screens, sheet elsewhere
  const openFn = useCallback((id: string) => (wide ? setSelected(id) : openTask(id)), [wide, openTask])
  const selectedTask = wide && selected ? all.find((t) => t.id === selected) : undefined
  useListKeyboard(ordered, selected, wide ? setSelected : undefined)

  const filtering = !!(search || projectId || labels.length)
  const clearFilters = () => {
    setSearch("")
    setProjectId("")
    setLabels([])
    setSmart("all")
  }

  const TABS: { value: SmartView; label: string; icon: React.ReactNode; count: number; hideEmpty?: boolean }[] = [
    { value: "all", label: "All", icon: <Layers />, count: counts.all },
    { value: "today", label: "Today", icon: <Sun />, count: counts.today },
    { value: "week", label: "Next 7 days", icon: <CalendarDays />, count: counts.week },
    { value: "important", label: "Important", icon: <Zap />, count: counts.important, hideEmpty: true },
    { value: "someday", label: "No date", icon: <CalendarX2 />, count: counts.someday, hideEmpty: true },
    { value: "done", label: "Done", icon: <CheckCircle2 />, count: counts.done, hideEmpty: true },
  ]

  const searchBox = (cls?: string) => (
    <div className={cn("relative min-w-0", cls)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search"
        aria-label="Search tasks"
        className="h-10 w-full rounded-full border border-transparent bg-muted/70 pr-8 pl-10 text-base transition-colors outline-none placeholder:text-muted-foreground focus:border-border focus:bg-card sm:h-9 sm:text-[13px]"
      />
      {search && (
        <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )

  const projectOptions = [{ value: "none", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name, dot: projectDot(p.id) }))]
  const groupOptions = [
    { value: "project", label: "By project", icon: <FolderKanban /> },
    { value: "date", label: "By date", icon: <CalendarClock /> },
    { value: "priority", label: "By priority", icon: <Flag /> },
    { value: "status", label: "By status", icon: <CircleDot /> },
  ]

  return (
    <div className="space-y-7 sm:space-y-8">
      {/* Header */}
      <header className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">Tasks</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular">{counts.all}</span> open
            {counts.overdue > 0 && (
              <>
                <span className="px-1.5 text-muted-foreground/50">·</span>
                <button type="button" onClick={() => setSmart("today")} className="cursor-pointer font-medium text-danger tabular hover:underline">
                  {counts.overdue} overdue
                </button>
              </>
            )}
            <span className="px-1.5 text-muted-foreground/50">·</span>
            <span className="tabular">{counts.week}</span> this week
          </p>
        </div>
        <Button
          size="icon"
          variant={showTools || filtering ? "secondary" : "ghost"}
          aria-label="Search and filters"
          aria-pressed={showTools}
          onClick={() => setShowTools((v) => !v)}
          className="relative rounded-full sm:hidden"
        >
          <SlidersHorizontal />
          {filtering && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
        </Button>
        <div className="hidden items-center rounded-full bg-muted/70 p-1 sm:flex" role="tablist" aria-label="Layout">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              aria-label={v === "list" ? "List" : "Board"}
              title={v === "list" ? "List" : "Board"}
              onClick={() => setView(v)}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-full transition-all [&_svg]:size-4",
                view === v ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "list" ? <List /> : <Columns3 />}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => quickAdd({ mode: "task" })} className="hidden rounded-full px-4 sm:inline-flex">
          <Plus /> New task
        </Button>
      </header>

      {/* Views + tools */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0" aria-label="Views">
            {TABS.filter((t) => !t.hideEmpty || t.count > 0 || smart === t.value).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSmart(t.value)}
                aria-pressed={smart === t.value}
                className={cn(
                  "flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                  smart === t.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.label}
                <span className={cn("text-xs tabular", smart === t.value ? "text-background/60" : "text-muted-foreground/70")}>{t.count}</span>
              </button>
            ))}
          </nav>
          <div className="hidden flex-1 lg:block" />
          <div className="hidden flex-wrap items-center gap-1 sm:flex">
            {searchBox("w-56")}
            <LabelFilter labels={allLabels} value={labels} onChange={setLabels} className={GHOST} />
            <Select value={projectId} onChange={setProjectId} placeholder="Project" icon={<FolderKanban />} options={projectOptions} className={GHOST} aria-label="Filter by project" />
            {view === "list" && smart !== "done" && (
              <Select value={groupBy} onChange={(v) => setGroupBy(v as GroupBy)} icon={<Layers />} options={groupOptions} className={GHOST} aria-label="Group tasks" />
            )}
          </div>
        </div>

        {/* Phones: search and filters on demand */}
        {(showTools || search) && (
          <div className="space-y-2 sm:hidden">
            {searchBox("w-full")}
            <div className="grid grid-cols-3 gap-2">
              <LabelFilter labels={allLabels} value={labels} onChange={setLabels} className="rounded-xl" />
              <Select value={projectId} onChange={setProjectId} placeholder="Project" icon={<FolderKanban />} options={projectOptions} className="rounded-xl" aria-label="Filter by project" />
              <Select value={groupBy} onChange={(v) => setGroupBy(v as GroupBy)} icon={<Layers />} options={groupOptions} className="rounded-xl" aria-label="Group tasks" />
            </div>
          </div>
        )}

        {filtering && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {search && <FilterPill onClear={() => setSearch("")}>“{search}”</FilterPill>}
            {projectId && <FilterPill onClear={() => setProjectId("")}>{projectId === "none" ? "No project" : projects.find((p) => p.id === projectId)?.name}</FilterPill>}
            {labels.map((l) => (
              <FilterPill key={l} onClear={() => setLabels(labels.filter((x) => x !== l))}>{l}</FilterPill>
            ))}
            <button type="button" onClick={clearFilters} className="cursor-pointer px-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      {view === "list" ? (
        <div className={cn("grid grid-cols-1 items-start gap-8", selectedTask && "grid-cols-[minmax(0,1fr)_400px]")}>
          <div className="@container/list min-w-0">
            {smart !== "done" && (
              <TaskInlineAdd
                className="mb-8 h-12 rounded-xl border border-dashed border-border-strong/70 px-3.5 transition-colors hover:border-border-strong hover:bg-muted/40 focus-within:border-solid focus-within:border-ring focus-within:bg-card"
                defaults={{
                  projectId: projectId && projectId !== "none" ? projectId : undefined,
                  scheduledDate: smart === "today" ? clock.today : undefined,
                }}
                placeholder={smart === "today" ? "Add a task for today" : mobile ? "Add a task" : "Add a task — try “Call clinic tomorrow 8pm #sales !high”"}
              />
            )}

            {shown.length === 0 && done.length === 0 ? (
              <EmptyState
                icon={<Sparkles />}
                title={filtering || smart !== "all" ? "Nothing here" : "No tasks yet"}
                description={filtering || smart !== "all" ? "Try another view or clear the filters." : "Add your first task above."}
                action={(filtering || smart !== "all") && <Button variant="outline" onClick={clearFilters}>Show all tasks</Button>}
              />
            ) : (
              <div>
                {sections.map((s, i) => {
                  if (s.parent && folded[s.parent]) return null
                  const open = !isFolded(s)
                  const rows = (
                    <div className="divide-y divide-border">
                      {adding === s.key && (
                        <TaskInlineAdd autoFocus defaults={s.add} onCancel={() => setAdding(null)} placeholder={`Add to ${s.title}`} className="h-[52px] bg-primary-soft/40 px-4" />
                      )}
                      {s.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} table codeColumn={codeColumn} onOpen={openFn} selected={selectedTask?.id === t.id} showProject={groupBy !== "project" && !projectId} />
                      ))}
                    </div>
                  )
                  const header = (
                    <SectionHeader
                      section={s}
                      folded={!open}
                      onFold={() => setFolded((f) => ({ ...f, [s.key]: open }))}
                      onAdd={s.add ? () => setAdding(s.key) : undefined}
                    />
                  )
                  if (s.kind === "project") {
                    return (
                      <section key={s.key} className={cn(i > 0 && "mt-12")}>
                        {header}
                        {(s.tasks.length > 0 || adding === s.key) && (
                          <Collapse open={open}>
                            <div className="mt-4">
                              <TableCard>
                                <ColumnHead codeColumn={codeColumn} />
                                {rows}
                              </TableCard>
                            </div>
                          </Collapse>
                        )}
                      </section>
                    )
                  }
                  return (
                    <section key={s.key} className={cn(i > 0 && (s.kind === "milestone" ? "mt-4" : "mt-6"), i === 0 && s.kind === "milestone" && "mt-4")}>
                      <TableCard>
                        {header}
                        <Collapse open={open}>
                          <ColumnHead codeColumn={codeColumn} />
                          {rows}
                        </Collapse>
                      </TableCard>
                    </section>
                  )
                })}
                {shown.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nothing open in this view. 🎉</p>}

                {done.length > 0 && (
                  <section className="mt-8">
                    <button
                      type="button"
                      onClick={() => setShowDone((v) => !v)}
                      aria-expanded={showDone}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground/80 shadow-[var(--shadow-card)] transition-colors hover:text-foreground"
                    >
                      <CheckCircle2 className="size-4 text-success" />
                      {showDone ? "Hide" : "Show"} {done.length} completed
                      <ChevronDown className={cn("size-3.5 transition-transform duration-200", showDone && "rotate-180")} />
                    </button>
                    <Collapse open={showDone}>
                      <div className="pt-3">
                        <TableCard>
                          <div className="divide-y divide-border">
                            {done.slice(0, 50).map((t) => (
                              <TaskRow key={t.id} task={t} table codeColumn={codeColumn} onOpen={openFn} selected={selectedTask?.id === t.id} showProject={!projectId} />
                            ))}
                          </div>
                        </TableCard>
                      </div>
                    </Collapse>
                  </section>
                )}
              </div>
            )}
          </div>

          {selectedTask && (
            <aside className="sticky top-6 max-h-[calc(100dvh-3rem)] animate-fade-in overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-pop)]">
              <TaskDetailPanel key={selectedTask.id} taskId={selectedTask.id} onClose={() => setSelected(null)} />
            </aside>
          )}
        </div>
      ) : (
        <Board tasks={base.filter((t) => matchesSmart(t) || (smart !== "done" && t.status === "Completed"))} />
      )}
    </div>
  )
}

/** Smoothly opens/closes its content (animates height without measuring). */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/** A white card that holds one group's table. */
function TableCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] [overflow:clip]">{children}</div>
}

/** Column titles, aligned with TaskRow's table cells (desktop). */
function ColumnHead({ codeColumn }: { codeColumn: boolean }) {
  return (
    <div className="hidden h-9 items-center gap-3 border-y border-border bg-subtle px-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:flex">
      <span className="w-[18px] shrink-0" />
      {codeColumn && <span className={TASK_COLS.code}>ID</span>}
      <span className="min-w-0 flex-1">Task</span>
      <div className="flex shrink-0 items-center gap-4">
        <span className={TASK_COLS.labels}>Labels</span>
        <span className={TASK_COLS.priority}>Priority</span>
        <span className={TASK_COLS.date}>Do on</span>
        <span className={TASK_COLS.deadline}>Due</span>
      </div>
      <span className={TASK_COLS.menu} />
    </div>
  )
}

function FilterPill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-muted pr-1 pl-3 font-medium">
      {children}
      <button type="button" onClick={onClear} aria-label="Remove filter" className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground">
        <X className="size-3" />
      </button>
    </span>
  )
}

/** "1. Lead Automation" → number badge + name, so milestone order reads at a glance. */
function splitStep(title: string) {
  const m = title.match(/^\s*(\d{1,2})[.)]\s+(.+)$/)
  return m ? { step: m[1], name: m[2] } : { step: null, name: title }
}

function SectionHeader({ section: s, folded, onFold, onAdd }: { section: Section; folded: boolean; onFold: () => void; onAdd?: () => void }) {
  const pct = s.progress && s.progress.total ? calcProgress(s.progress.done, s.progress.total) : null
  const count = s.count ?? s.tasks.length
  const addBtn = onAdd && (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add a task to ${s.title}`}
      title="Add a task here"
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Plus className="size-4" />
    </button>
  )
  const bar = (w: string) =>
    pct !== null && (
      <span className={cn("h-1.5 overflow-hidden rounded-full bg-border", w)}>
        <span className={cn("block h-full rounded-full transition-[width] duration-500", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${Math.max(pct, 3)}%` }} />
      </span>
    )

  if (s.kind === "project") {
    return (
      <div className="group/sec flex items-center gap-3">
        <button type="button" onClick={onFold} aria-expanded={!folded} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">{s.icon}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold tracking-tight">{s.title}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", folded && "-rotate-90")} />
            </span>
            <span className="block text-[13px] text-muted-foreground tabular">
              {count} open{s.progress && ` · ${s.progress.done} of ${s.progress.total} done`}
            </span>
          </span>
        </button>
        {pct !== null && (
          <span className="hidden items-center gap-2.5 text-xs text-muted-foreground tabular sm:flex">
            {bar("w-32")}
            <span className="w-8 text-right font-medium text-foreground/80">{pct}%</span>
          </span>
        )}
        {s.href && (
          <Link href={s.href} className="hidden shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex">
            Open <ArrowUpRight className="size-3.5" />
          </Link>
        )}
        {addBtn}
      </div>
    )
  }

  const { step, name } = s.kind === "milestone" ? splitStep(s.title) : { step: null, name: s.title }
  return (
    <div className="group/sec flex items-center gap-3 py-3 pr-2.5 pl-4 max-sm:border-b max-sm:border-border">
      <button
        type="button"
        onClick={onFold}
        aria-expanded={!folded}
        className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left", s.tone === "danger" ? "text-danger" : "text-foreground")}
      >
        {step ? (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular", pct === 100 ? "bg-success text-white" : "bg-primary-soft text-primary")}>{step}</span>
        ) : (
          s.icon && <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-4">{s.icon}</span>
        )}
        <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{name}</span>
        <span className={cn("shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground/70 tabular", pct !== null && "max-sm:hidden")}>{count}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", folded && "-rotate-90")} />
      </button>
      {pct !== null && (
        <span className="flex shrink-0 items-center gap-2.5 text-xs font-medium text-foreground/70 tabular" title={`${s.progress!.done} of ${s.progress!.total} done`}>
          {s.progress!.done}/{s.progress!.total}
          <span className="hidden sm:inline">done</span>
          {bar("hidden w-24 sm:block")}
        </span>
      )}
      {addBtn}
    </div>
  )
}

/** Turns the visible tasks into list sections for the chosen grouping. */
function buildSections(
  groupBy: GroupBy,
  tasks: TaskDTO[],
  everything: TaskDTO[],
  projects: ReturnType<typeof useApp>["projects"],
  clock: ReturnType<typeof useClock>,
): Section[] {
  if (groupBy === "project") {
    const out: Section[] = []
    const progressOf = (match: (t: TaskDTO) => boolean) => {
      const list = everything.filter((t) => t.status !== "Cancelled" && match(t))
      return { done: list.filter((t) => t.status === "Completed").length, total: list.length }
    }
    for (const p of projects) {
      const mine = tasks.filter((t) => t.projectId === p.id)
      if (!mine.length) continue
      const loose = mine.filter((t) => !t.milestoneId || !p.milestones.some((m) => m.id === t.milestoneId))
      out.push({
        key: `p:${p.id}`,
        kind: "project",
        title: p.name,
        icon: <span className={cn("size-3 rounded-full", projectDot(p.id))} />,
        tasks: loose,
        count: mine.length,
        progress: progressOf((t) => t.projectId === p.id),
        href: `/projects/${p.id}`,
        add: { projectId: p.id },
      })
      for (const m of p.milestones) {
        const inMs = mine.filter((t) => t.milestoneId === m.id)
        if (!inMs.length) continue
        out.push({
          key: `m:${m.id}`,
          kind: "milestone",
          title: m.title,
          parent: `p:${p.id}`,
          tasks: inMs,
          progress: progressOf((t) => t.milestoneId === m.id),
          add: { projectId: p.id, milestoneId: m.id },
        })
      }
    }
    // Tasks whose project isn't in the list (archived) or that have none
    const known = new Set(projects.map((p) => p.id))
    const rest = tasks.filter((t) => !t.projectId || !known.has(t.projectId))
    if (rest.length) out.push({ key: "none", kind: "project", title: "No project", icon: <FolderKanban className="size-4 text-muted-foreground" />, tasks: rest, add: {} })
    return out
  }

  if (groupBy === "priority") {
    return ["Critical", "High", "Medium", "Low"]
      .map((p): Section => ({
        key: p,
        kind: "group",
        title: TASK_PRIORITY_META[p].label,
        icon: <PriorityIcon priority={p} className="size-4" />,
        tasks: tasks.filter((t) => t.priority === p),
        add: { priority: p },
      }))
      .filter((g) => g.tasks.length)
  }

  if (groupBy === "status") {
    return (
      [
        { key: "InProgress", kind: "group", title: "In progress", icon: <CircleDot className="text-warning" />, tasks: tasks.filter((t) => t.status === "InProgress"), add: { status: "InProgress" } },
        { key: "Todo", kind: "group", title: "To do", icon: <CircleDot className="text-muted-foreground" />, tasks: tasks.filter((t) => t.status !== "InProgress"), add: {} },
      ] satisfies Section[]
    ).filter((g) => g.tasks.length)
  }

  // By date: Overdue · Today · Tomorrow · Next 7 days · Later · No date
  const tomorrow = addDaysToKey(clock.today, 1)
  const buckets: Section[] = [
    { key: "overdue", kind: "group", title: BUCKET_LABELS.overdue, icon: <AlertCircle />, tone: "danger", tasks: [] },
    { key: "today", kind: "group", title: "Today", icon: <Sun className="text-primary" />, add: { scheduledDate: clock.today }, tasks: [] },
    { key: "tomorrow", kind: "group", title: "Tomorrow", icon: <CalendarDays className="text-muted-foreground" />, add: { scheduledDate: tomorrow }, tasks: [] },
    { key: "week", kind: "group", title: "Next 7 days", icon: <CalendarDays className="text-muted-foreground" />, tasks: [] },
    { key: "later", kind: "group", title: "Later", icon: <CalendarClock className="text-muted-foreground" />, tasks: [] },
    { key: "someday", kind: "group", title: BUCKET_LABELS.someday, icon: <CalendarX2 className="text-muted-foreground" />, add: {}, tasks: [] },
  ]
  const at = (k: string) => buckets.find((b) => b.key === k)!
  for (const t of tasks) {
    const b = bucketOf(t, clock)
    if (b !== "upcoming") at(b === "done" ? "later" : b).tasks.push(t)
    else at(daysBetween(clock.today, effectiveKey(t, clock)!) <= 7 ? "week" : "later").tasks.push(t)
  }
  return buckets.filter((b) => b.tasks.length)
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
  { status: "Todo", label: "To do", dot: "bg-muted-foreground/50" },
  { status: "InProgress", label: "In progress", dot: "bg-warning" },
  { status: "Completed", label: "Done", dot: "bg-success" },
]

/** Three columns. Drag a card to change its status, or click to open it. */
function Board({ tasks }: { tasks: TaskDTO[] }) {
  const { openTask } = useApp()
  const clock = useClock()
  const actions = useTaskActions()
  const [dragOver, setDragOver] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
            className={cn("rounded-3xl bg-muted/50 p-3 transition-colors", dragOver === col.status && "bg-primary-soft ring-2 ring-primary/30")}
          >
            <div className="flex items-center gap-2 px-2 pt-1 pb-3">
              <span className={cn("size-2 rounded-full", col.dot)} />
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="text-[13px] text-muted-foreground tabular">{items.length}</span>
            </div>
            <div className="min-h-24 space-y-2.5">
              {shown.map((t) => {
                const key = effectiveKey(t, clock)
                const overdue = bucketOf(t, clock) === "overdue"
                const subs = t.subtasks ?? []
                const parts = splitTitle(t.title)
                const tags = parseTags(t.tags)
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => openTask(t.id)}
                    className="cursor-pointer rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-[var(--shadow-pop)] active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn("min-w-0 flex-1 text-sm leading-snug", t.status === "Completed" && "text-muted-foreground line-through")}>
                        {parts.subject && <p className="font-semibold">{parts.subject}</p>}
                        <p className={cn(parts.subject && "mt-0.5 text-[13px] text-muted-foreground")}>{parts.text}</p>
                      </div>
                      {(t.priority === "High" || t.priority === "Critical") && <PriorityIcon priority={t.priority} className="mt-0.5" />}
                    </div>
                    {(tags.length > 0 || key || subs.length > 0 || parts.code) && (
                      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        {key && t.status !== "Completed" && <span className={cn("tabular", overdue && "font-medium text-danger")}>{dayLabel(key, clock.today)}</span>}
                        <LabelList labels={tags} />
                        {subs.length > 0 && <span className="tabular">{subs.filter((s) => s.status === "Completed").length}/{subs.length}</span>}
                        {parts.code && <span className="ml-auto font-mono text-[11px] text-muted-foreground/70">{parts.code}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
              {items.length === 0 && <p className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">Drop tasks here</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
