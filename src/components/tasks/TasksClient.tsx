"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle, CalendarClock, CalendarDays, CalendarX2, CheckCircle2, ChevronDown, CircleDot, Columns3, Flag, FolderKanban,
  Layers, List, Plus, Search, SlidersHorizontal, Sparkles, Sun, X, Zap,
} from "lucide-react"
import { cn, calcProgress } from "@/lib/utils"
import { BUCKET_LABELS, bucketOf, daysBetween, dayLabel, effectiveKey, parseTags, priorityRank, splitTitle } from "@/lib/tasks/taskLogic"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { addDaysToKey } from "@/lib/zone"
import { useIsMobile, useMediaQuery, useStoredState } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { EmptyState, Kbd, Segmented } from "@/components/ui/misc"
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

/** One block of the list. Project headers (depth 0) are followed by their milestones (depth 1). */
interface Section {
  key: string
  title: string
  depth: 0 | 1
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
  /** Small uppercase heading (date/priority/status groups) vs. a named heading (project/milestone). */
  caps?: boolean
}

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

  // Search, project and label filters (the smart view comes on top)
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
    () => (smart === "done" ? [{ key: "done", title: "Completed", depth: 0, caps: true, tasks: shown }] : buildSections(groupBy, shown, all, projects, clock)),
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

  const toolbar = (
    <div className={cn("flex-col gap-2 border-b border-border p-3 sm:flex @3xl/list:flex-row @3xl/list:items-center", showTools || search ? "flex" : "hidden")}>
      <div className="relative min-w-0 flex-1 @3xl/list:max-w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks, clients, labels"
          aria-label="Search tasks"
          className="h-10 w-full rounded-lg border border-border bg-card pr-8 pl-9 text-base outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/15 sm:h-9 sm:text-sm"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="hidden flex-1 @3xl/list:block" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 @3xl/list:flex">
        <LabelFilter labels={allLabels} value={labels} onChange={setLabels} className="@3xl/list:w-36" />
        <Select
          value={projectId}
          onChange={setProjectId}
          placeholder="All projects"
          icon={<FolderKanban />}
          options={[{ value: "none", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name, dot: projectDot(p.id) }))]}
          className="@3xl/list:w-40"
          aria-label="Filter by project"
        />
        {view === "list" && smart !== "done" && (
          <Select
            value={groupBy}
            onChange={(v) => setGroupBy(v as GroupBy)}
            icon={<Layers />}
            options={[
              { value: "project", label: "By project", icon: <FolderKanban /> },
              { value: "date", label: "By date", icon: <CalendarClock /> },
              { value: "priority", label: "By priority", icon: <Flag /> },
              { value: "status", label: "By status", icon: <CircleDot /> },
            ]}
            className="col-span-2 sm:col-span-1 @3xl/list:w-40"
            aria-label="Group tasks"
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            <span className="text-foreground tabular">{counts.all}</span> open
            {counts.overdue > 0 && (
              <>
                {" · "}
                <button type="button" onClick={() => setSmart("today")} className="cursor-pointer font-medium text-danger tabular hover:underline">
                  {counts.overdue} overdue
                </button>
              </>
            )}
            {" · "}
            <span className="tabular">{counts.week}</span> in the next 7 days
            <span className="hidden lg:inline">
              {" · "}
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> move · <Kbd>X</Kbd> done · <Kbd>N</Kbd> new
            </span>
          </p>
        </div>
        <Button
          size="icon"
          variant={showTools || filtering ? "secondary" : "ghost"}
          aria-label="Search and filters"
          aria-pressed={showTools}
          onClick={() => setShowTools((v) => !v)}
          className="relative sm:hidden"
        >
          <SlidersHorizontal />
          {filtering && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
        </Button>
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
      </div>

      {/* Views */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:gap-1 sm:border-b sm:border-border sm:px-0">
        {TABS.filter((t) => !t.hideEmpty || t.count > 0 || smart === t.value).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSmart(t.value)}
            aria-pressed={smart === t.value}
            className={cn(
              "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors [&_svg]:size-4",
              "sm:-mb-px sm:h-10 sm:rounded-none sm:border-0 sm:border-b-2 sm:px-3",
              smart === t.value
                ? "border-primary/40 bg-primary-soft text-primary sm:border-primary sm:bg-transparent sm:text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground sm:border-transparent sm:bg-transparent",
            )}
          >
            <span className={cn(smart === t.value && "sm:text-primary")}>{t.icon}</span>
            {t.label}
            <span className={cn("rounded-md px-1.5 text-xs tabular", smart === t.value ? "bg-primary/15 sm:bg-primary-soft sm:text-primary" : "bg-muted")}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtering && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Showing</span>
          {search && <FilterPill onClear={() => setSearch("")}>“{search}”</FilterPill>}
          {projectId && <FilterPill onClear={() => setProjectId("")}>{projectId === "none" ? "No project" : projects.find((p) => p.id === projectId)?.name}</FilterPill>}
          {labels.map((l) => (
            <FilterPill key={l} onClear={() => setLabels(labels.filter((x) => x !== l))}>{l}</FilterPill>
          ))}
          <button type="button" onClick={clearFilters} className="cursor-pointer px-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Clear all
          </button>
        </div>
      )}

      {view === "list" ? (
        <div className={cn("grid grid-cols-1 items-start gap-5", selectedTask && "grid-cols-[minmax(0,1fr)_400px]")}>
          <div className="@container/list rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] [overflow:clip]">
            {toolbar}
            {smart !== "done" && (
              <TaskInlineAdd
                className="border-b border-border"
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
              <>
                {/* Column headings (desktop) */}
                <div className="hidden h-9 items-center gap-3 border-b border-border px-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:flex">
                  <span className="w-[18px] shrink-0" />
                  {codeColumn && <span className={TASK_COLS.code}>ID</span>}
                  <span className="min-w-0 flex-1">Task</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={TASK_COLS.labels}>Labels</span>
                    <span className={TASK_COLS.priority}>Priority</span>
                    <span className={TASK_COLS.date}>Do on</span>
                    <span className={TASK_COLS.deadline}>Deadline</span>
                  </div>
                  <span className={TASK_COLS.menu} />
                </div>

                <div className="pb-1">
                  {sections.map((s) =>
                    s.parent && folded[s.parent] ? null : (
                      <section key={s.key}>
                        <SectionHeader
                          section={s}
                          folded={isFolded(s)}
                          onFold={() => setFolded((f) => ({ ...f, [s.key]: !isFolded(s) }))}
                          onAdd={s.add ? () => setAdding(s.key) : undefined}
                        />
                        {!isFolded(s) && (
                          <div className="divide-y divide-border/60">
                            {adding === s.key && (
                              <TaskInlineAdd
                                autoFocus
                                defaults={s.add}
                                onCancel={() => setAdding(null)}
                                placeholder={`Add to ${s.title}`}
                                className={cn("bg-primary-soft/30", s.depth === 1 && "sm:pl-9")}
                              />
                            )}
                            {s.tasks.map((t) => (
                              <TaskRow
                                key={t.id}
                                task={t}
                                table
                                codeColumn={codeColumn}
                                onOpen={openFn}
                                selected={selectedTask?.id === t.id}
                                showProject={groupBy !== "project" && !projectId}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    ),
                  )}
                  {shown.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing open in this view. 🎉</p>}

                  {done.length > 0 && (
                    <section>
                      <button
                        type="button"
                        onClick={() => setShowDone((v) => !v)}
                        aria-expanded={showDone}
                        className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
                      >
                        <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                        <CheckCircle2 className="size-3.5 text-success" />
                        Completed <span className="font-medium tabular opacity-70">{done.length}</span>
                      </button>
                      {showDone && (
                        <div className="divide-y divide-border/60 border-t border-border/60">
                          {done.slice(0, 50).map((t) => (
                            <TaskRow key={t.id} task={t} table codeColumn={codeColumn} onOpen={openFn} selected={selectedTask?.id === t.id} showProject={!projectId} />
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </>
            )}
          </div>

          {selectedTask && (
            <aside className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <TaskDetailPanel key={selectedTask.id} taskId={selectedTask.id} onClose={() => setSelected(null)} />
            </aside>
          )}
        </div>
      ) : (
        <>
          <div className={cn("@container/list rounded-2xl border border-border bg-card [overflow:clip] [&>div]:border-b-0", !(showTools || search) && "max-sm:hidden")}>{toolbar}</div>
          <Board tasks={base.filter((t) => matchesSmart(t) || (smart !== "done" && t.status === "Completed"))} />
        </>
      )}
    </div>
  )
}

function FilterPill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card pr-1 pl-2.5 font-medium">
      {children}
      <button type="button" onClick={onClear} aria-label="Remove filter" className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="size-3" />
      </button>
    </span>
  )
}

function SectionHeader({ section: s, folded, onFold, onAdd }: { section: Section; folded: boolean; onFold: () => void; onAdd?: () => void }) {
  const pct = s.progress && s.progress.total ? calcProgress(s.progress.done, s.progress.total) : null
  return (
    <div
      className={cn(
        "group/sec sticky top-0 z-[2] flex items-center gap-2 border-b border-border pr-2 backdrop-blur",
        s.depth === 0 ? "bg-subtle/95 pl-3" : "bg-card/95 pl-3 sm:pl-9",
        s.caps ? "h-10 sm:h-9" : s.depth === 0 ? "h-11" : "h-10",
      )}
    >
      <button
        type="button"
        onClick={onFold}
        aria-expanded={!folded}
        className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch text-left", s.tone === "danger" ? "text-danger" : s.caps ? "text-muted-foreground" : "text-foreground")}
      >
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", folded && "-rotate-90")} />
        {s.icon}
        <span className={cn("min-w-0 truncate", s.caps ? "text-xs font-semibold tracking-wide uppercase" : s.depth === 0 ? "text-sm font-semibold" : "text-[13px] font-medium")}>{s.title}</span>
        <span className={cn("shrink-0 text-xs font-medium text-muted-foreground tabular", pct !== null && "max-sm:hidden")}>{s.count ?? s.tasks.length}</span>
      </button>
      {pct !== null && (
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground tabular" title={`${s.progress!.done} of ${s.progress!.total} done`}>
          <span>{s.progress!.done}/{s.progress!.total}</span>
          <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
            <span className={cn("block h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${Math.max(pct, 4)}%` }} />
          </span>
          <span className="hidden w-8 text-right sm:inline">{pct}%</span>
        </span>
      )}
      {s.href && (
        <Link href={s.href} className="hidden shrink-0 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:inline">
          Open
        </Link>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add a task to ${s.title}`}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-7 lg:opacity-0 lg:group-hover/sec:opacity-100 lg:focus-visible:opacity-100"
        >
          <Plus className="size-4" />
        </button>
      )}
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
        title: p.name,
        depth: 0,
        icon: <span className={cn("size-2.5 shrink-0 rounded-full", projectDot(p.id))} />,
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
          title: m.title,
          depth: 1,
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
    if (rest.length) out.push({ key: "none", title: "No project", depth: 0, icon: <FolderKanban className="size-3.5 text-muted-foreground" />, tasks: rest, add: {} })
    return out
  }

  if (groupBy === "priority") {
    return ["Critical", "High", "Medium", "Low"]
      .map((p) => ({
        key: p,
        title: TASK_PRIORITY_META[p].label,
        depth: 0 as const,
        caps: true,
        icon: <PriorityIcon priority={p} className="size-3.5" />,
        tasks: tasks.filter((t) => t.priority === p),
        add: { priority: p },
      }))
      .filter((g) => g.tasks.length)
  }

  if (groupBy === "status") {
    return [
      { key: "InProgress", title: "In progress", icon: <CircleDot className="size-3.5 text-warning" />, tasks: tasks.filter((t) => t.status === "InProgress"), add: { status: "InProgress" } },
      { key: "Todo", title: "To do", icon: <CircleDot className="size-3.5" />, tasks: tasks.filter((t) => t.status !== "InProgress"), add: {} },
    ]
      .filter((g) => g.tasks.length)
      .map((g) => ({ ...g, depth: 0 as const, caps: true }))
  }

  // By date: Overdue · Today · Tomorrow · Next 7 days · Later · No date
  const tomorrow = addDaysToKey(clock.today, 1)
  const buckets: { key: string; title: string; icon: React.ReactNode; tone?: "danger"; add?: AddDefaults; tasks: TaskDTO[] }[] = [
    { key: "overdue", title: BUCKET_LABELS.overdue, icon: <AlertCircle className="size-3.5" />, tone: "danger", tasks: [] },
    { key: "today", title: "Today", icon: <Sun className="size-3.5" />, add: { scheduledDate: clock.today }, tasks: [] },
    { key: "tomorrow", title: "Tomorrow", icon: <CalendarDays className="size-3.5" />, add: { scheduledDate: tomorrow }, tasks: [] },
    { key: "week", title: "Next 7 days", icon: <CalendarDays className="size-3.5" />, tasks: [] },
    { key: "later", title: "Later", icon: <CalendarClock className="size-3.5" />, tasks: [] },
    { key: "someday", title: BUCKET_LABELS.someday, icon: <CalendarX2 className="size-3.5" />, add: {}, tasks: [] },
  ]
  const at = (k: string) => buckets.find((b) => b.key === k)!
  for (const t of tasks) {
    const b = bucketOf(t, clock)
    if (b !== "upcoming") at(b === "done" ? "later" : b).tasks.push(t)
    else at(daysBetween(clock.today, effectiveKey(t, clock)!) <= 7 ? "week" : "later").tasks.push(t)
  }
  return buckets.filter((b) => b.tasks.length).map((b) => ({ ...b, depth: 0 as const, caps: true }))
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                const parts = splitTitle(t.title)
                const tags = parseTags(t.tags)
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
                      <div className={cn("min-w-0 flex-1 text-[13px] leading-snug", t.status === "Completed" && "text-muted-foreground line-through")}>
                        {parts.subject && <p className="font-semibold">{parts.subject}</p>}
                        <p className={cn(parts.subject && "text-muted-foreground")}>{parts.text}</p>
                      </div>
                      {parts.code && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{parts.code}</span>}
                    </div>
                    {(tags.length > 0 || key || subs.length > 0 || t.project) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-muted-foreground">
                        {tags.length > 0 && <LabelList labels={tags} max={2} />}
                        {key && t.status !== "Completed" && <span className={cn(overdue && "font-medium text-danger")}>{dayLabel(key, clock.today)}</span>}
                        {subs.length > 0 && <span className="tabular">{subs.filter((s) => s.status === "Completed").length}/{subs.length} subtasks</span>}
                        {t.project && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <span className={cn("size-1.5 rounded-full", projectDot(t.project.id))} />
                            <span className="truncate">{t.milestone?.title ?? t.project.name}</span>
                          </span>
                        )}
                      </div>
                    )}
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
