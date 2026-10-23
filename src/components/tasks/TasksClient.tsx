"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Columns3, Flag, FolderKanban, List, Plus, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { BUCKET_LABELS, bucketOf, type TaskBucket } from "@/lib/tasks/taskLogic"
import { TASK_PRIORITY_META } from "@/lib/constants"
import { relativeDay, toDate } from "@/lib/dates"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { EmptyState, GroupLabel, PageHeader, Segmented } from "@/components/ui/misc"
import { useApp } from "@/components/app/AppProvider"
import { TaskRow } from "@/components/tasks/TaskRow"
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd"
import { useLiveTasks, useTaskActions } from "@/components/tasks/useTasks"
import type { TaskDTO } from "@/types"

const ORDER: TaskBucket[] = ["overdue", "today", "tomorrow", "upcoming", "someday"]

export function TasksClient({ tasks: serverTasks }: { tasks: TaskDTO[] }) {
  const { projects, quickAdd } = useApp()
  const all = useLiveTasks(serverTasks)
  const [view, setView] = useState<"list" | "board">("list")
  const [search, setSearch] = useState("")
  const [projectId, setProjectId] = useState("")
  const [priority, setPriority] = useState("")
  const [showDone, setShowDone] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter(
      (t) =>
        t.status !== "Cancelled" &&
        (!q || t.title.toLowerCase().includes(q) || t.project?.name.toLowerCase().includes(q)) &&
        (!projectId || (projectId === "none" ? !t.projectId : t.projectId === projectId)) &&
        (!priority || t.priority === priority),
    )
  }, [all, search, projectId, priority])

  const groups = useMemo(() => {
    const g: Record<TaskBucket, TaskDTO[]> = { overdue: [], today: [], tomorrow: [], upcoming: [], someday: [], done: [] }
    for (const t of filtered) g[bucketOf(t)].push(t)
    g.done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    return g
  }, [filtered])

  const openCount = filtered.length - groups.done.length
  const filtering = !!(search || projectId || priority)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description={`${openCount} open${groups.overdue.length ? ` · ${groups.overdue.length} overdue` : ""}`}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: <><List /> List</> },
                { value: "board", label: <><Columns3 /> Board</> },
              ]}
            />
            <Button variant="primary" onClick={() => quickAdd({ mode: "task" })}>
              <Plus /> New task
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-base sm:text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/15"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder="All projects"
            options={[{ value: "none", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name, icon: <FolderKanban /> }))]}
            icon={<FolderKanban />}
            className="sm:w-48"
            aria-label="Filter by project"
          />
          <Select
            value={priority}
            onChange={setPriority}
            placeholder="Any priority"
            options={["Critical", "High", "Medium", "Low"].map((p) => ({ value: p, label: TASK_PRIORITY_META[p].label, dot: TASK_PRIORITY_META[p].dot }))}
            icon={<Flag />}
            className="sm:w-40"
            aria-label="Filter by priority"
          />
        </div>
      </div>

      {view === "list" ? (
        <Card className="overflow-hidden">
          <TaskInlineAdd
            className="border-b border-border"
            defaults={{ projectId: projectId && projectId !== "none" ? projectId : undefined }}
            placeholder="Add a task — try “Review PR tomorrow #saudi”"
          />
          {openCount === 0 && groups.done.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title={filtering ? "No tasks match" : "No tasks yet"}
              description={filtering ? "Try a different search or filter." : "Add your first task above."}
            />
          ) : (
            <div className="pb-2">
              {ORDER.map((b) =>
                groups[b].length === 0 ? null : (
                  <section key={b}>
                    <GroupLabel tone={b === "overdue" ? "danger" : undefined} count={groups[b].length}>
                      {BUCKET_LABELS[b]}
                    </GroupLabel>
                    {groups[b].map((t) => (
                      <TaskRow key={t.id} task={t} showDate={b !== "today"} showProject={!projectId} />
                    ))}
                  </section>
                ),
              )}
              {openCount === 0 && <p className="px-4 py-4 text-center text-[13px] text-muted-foreground">Nothing open. Nice work.</p>}
              {groups.done.length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowDone((v) => !v)}
                    className="flex w-full cursor-pointer items-center gap-1.5 px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
                  >
                    <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                    Completed <span className="font-medium tabular opacity-70">{groups.done.length}</span>
                  </button>
                  {showDone && groups.done.slice(0, 50).map((t) => <TaskRow key={t.id} task={t} showProject={!projectId} />)}
                </section>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Board tasks={filtered} />
      )}
    </div>
  )
}

const COLUMNS = [
  { status: "Todo", label: "To do" },
  { status: "InProgress", label: "In progress" },
  { status: "Completed", label: "Done" },
]

/** Three columns. Drag a card to change its status, or click to open it. */
function Board({ tasks }: { tasks: TaskDTO[] }) {
  const { openTask } = useApp()
  const actions = useTaskActions()
  const [dragOver, setDragOver] = useState<string | null>(null)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status)
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
            className={cn("rounded-xl border border-border bg-subtle p-2 transition-colors", dragOver === col.status && "border-primary/50 bg-primary-soft")}
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-[13px] font-semibold">{col.label}</span>
              <span className="text-xs text-muted-foreground tabular">{items.length}</span>
            </div>
            <div className="min-h-24 space-y-2">
              {shown.map((t) => {
                const date = toDate(t.scheduledDate) ?? toDate(t.dueDate)
                const overdue = bucketOf(t) === "overdue"
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => openTask(t.id)}
                    className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:border-border-strong active:cursor-grabbing"
                  >
                    <p className={cn("text-[13px] leading-snug", t.status === "Completed" && "text-muted-foreground line-through")}>{t.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                      {(t.priority === "Critical" || t.priority === "High") && (
                        <span className={cn("font-medium", TASK_PRIORITY_META[t.priority].text)}>{TASK_PRIORITY_META[t.priority].label}</span>
                      )}
                      {date && t.status !== "Completed" && <span className={cn(overdue && "font-medium text-danger")}>{relativeDay(date)}</span>}
                      {t.project && <span className="truncate">{t.project.name}</span>}
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
