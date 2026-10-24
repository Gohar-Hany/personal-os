"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive, ArchiveRestore, CheckCircle2, ChevronDown, ChevronRight, Columns3, Flag, Hourglass, List, Pencil, Plus,
  RotateCcw, Star, Target, Trash2,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn, calcProgress } from "@/lib/utils"
import { bucketOf, compareTasks, dayLabel, keyOf, splitTicket } from "@/lib/tasks/taskLogic"
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META, TONE_DOT } from "@/lib/constants"
import { useSynced } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Select, Textarea } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/datepicker"
import { EmptyState, ProgressBar, ProgressRing, Segmented } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"
import { useApp, useClock } from "@/components/app/AppProvider"
import { TaskRow, projectDot } from "@/components/tasks/TaskRow"
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd"
import { PriorityIcon } from "@/components/tasks/TaskIcons"
import { useLiveTasks, useTaskActions } from "@/components/tasks/useTasks"
import { ProjectDialog } from "@/components/projects/ProjectDialog"
import { useProjectActions } from "@/components/projects/useProjectActions"
import type { MilestoneDTO, ProjectDetailDTO, TaskDTO } from "@/types"

const counted = (ts: TaskDTO[]) => ts.filter((t) => t.status !== "Cancelled")
const doneOf = (ts: TaskDTO[]) => ts.filter((t) => t.status === "Completed").length

/**
 * A project as a workspace: the work on the left (milestones as sections, or a board),
 * progress and editable details on the right.
 */
export function ProjectDetailClient({ project: serverProject }: { project: ProjectDetailDTO }) {
  const clock = useClock()
  const [project, setProject] = useSynced(serverProject)
  const [view, setView] = useState<"list" | "board">("list")
  const [editOpen, setEditOpen] = useState(false)
  const [addingMilestone, setAddingMilestone] = useState(false)
  // Roadmap filter: show one milestone's work only
  const [focusMs, setFocusMs] = useState<string | null>(null)
  const actions = useProjectActions((_, patch) => patch && setProject((p) => ({ ...p, ...patch })))

  // Live (optimistic) tasks, so progress moves the moment you tick something
  const live = useLiveTasks(useMemo(() => [...project.tasks, ...project.milestones.flatMap((m) => m.tasks)], [project]))
  const tasks = live.filter((t) => t.projectId === project.id)
  const total = counted(tasks)
  const done = doneOf(total)
  const pct = calcProgress(done, total.length)
  const overdue = total.filter((t) => bucketOf(t, clock) === "overdue").length
  const inMilestone = (id: string | null) => tasks.filter((t) => (t.milestoneId ?? null) === id).sort(compareTasks)
  const closed = project.status === "Completed" || project.status === "Archived"
  const status = PROJECT_STATUS_META[project.status]
  const prio = PROJECT_PRIORITY_META[project.priority]

  const setMilestone = (id: string, patch: Partial<MilestoneDTO> | null) =>
    setProject((p) => ({
      ...p,
      milestones: patch === null ? p.milestones.filter((x) => x.id !== id) : p.milestones.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }))

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <header className="space-y-3">
        <nav className="flex items-center gap-1 text-[13px] text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <ChevronRight className="size-3.5" />
          <span className="truncate text-foreground">{project.name}</span>
        </nav>
        <div className="flex flex-wrap items-start gap-3">
          <span className={cn("mt-2 size-3 shrink-0 rounded-full", projectDot(project.id))} />
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight sm:text-[28px]">{project.name}</h1>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => actions.setFocus(project.id, !project.isFocus)}
              aria-label={project.isFocus ? "Remove focus" : "Set as focus project"}
              title={project.isFocus ? "Your focus project" : "Set as focus project"}
            >
              <Star className={cn(project.isFocus && "fill-primary text-primary")} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Menu
              label={project.name}
              items={[
                project.status === "Completed"
                  ? { label: "Reopen project", icon: <RotateCcw />, onSelect: () => actions.setStatus(project.id, "Active") }
                  : { label: "Mark complete", icon: <CheckCircle2 />, onSelect: () => actions.setStatus(project.id, "Completed") },
                project.status === "Archived"
                  ? { label: "Restore", icon: <ArchiveRestore />, onSelect: () => actions.setStatus(project.id, "Active") }
                  : { label: "Archive", icon: <Archive />, onSelect: () => actions.setStatus(project.id, "Archived") },
                { separator: true },
                { label: "Delete project", icon: <Trash2 />, danger: true, onSelect: () => actions.remove({ ...project, taskCount: total.length }, true) },
              ]}
            />
          </div>
        </div>
        {/* Key facts in one line — always visible, also on phones */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-6 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", TONE_DOT[status?.tone ?? "neutral"])} />{status?.label}</span>
          <span className="inline-flex items-center gap-1.5"><Flag className="size-3.5" />{prio?.label}</span>
          {project.deadline && (
            <span className="inline-flex items-center gap-1.5"><Hourglass className="size-3.5" />Due {dayLabel(keyOf(project.deadline, clock)!, clock.today)}</span>
          )}
          {project.goal && (
            <Link href="/goals" className="inline-flex items-center gap-1.5 hover:text-foreground"><Target className="size-3.5" />{project.goal.name}</Link>
          )}
          <span className="tabular">{total.length ? `${done}/${total.length} tasks · ${pct}%` : "Not started"}</span>
          {overdue > 0 && <span className="font-medium text-danger">{overdue} overdue</span>}
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ─── The work ─── */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: <><List /> Milestones</> },
                { value: "board", label: <><Columns3 /> Board</> },
              ]}
            />
            {view === "list" && !closed && (
              <Button size="sm" variant="ghost" onClick={() => setAddingMilestone(true)}>
                <Plus /> Milestone
              </Button>
            )}
          </div>

          {project.milestones.length > 0 && (
            <Roadmap
              milestones={project.milestones}
              taskCounts={(id) => {
                const t = counted(inMilestone(id))
                return { total: t.length, done: doneOf(t) }
              }}
              focus={focusMs}
              onFocus={(id) => setFocusMs((cur) => (cur === id ? null : id))}
            />
          )}

          {view === "list" ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              {focusMs && (
                <button type="button" onClick={() => setFocusMs(null)} className="flex w-full cursor-pointer items-center justify-between border-b border-border bg-primary-soft/50 px-4 py-2 text-xs font-medium text-primary">
                  Showing one milestone <span className="underline">Show all</span>
                </button>
              )}
              {project.milestones.filter((m) => !focusMs || m.id === focusMs).map((m) => (
                <MilestoneSection key={m.id} milestone={m} index={project.milestones.indexOf(m)} tasks={inMilestone(m.id)} projectId={project.id} closed={closed} onChange={(patch) => setMilestone(m.id, patch)} />
              ))}
              {!focusMs && <MilestoneSection
                milestone={null}
                index={project.milestones.length}
                tasks={inMilestone(null)}
                projectId={project.id}
                closed={closed}
                hideWhenEmpty={project.milestones.length > 0}
              />}
              {addingMilestone && (
                <AddMilestone
                  projectId={project.id}
                  onDone={(m) => {
                    setAddingMilestone(false)
                    if (m) setProject((p) => ({ ...p, milestones: [...p.milestones, { ...m, tasks: [] }] }))
                  }}
                />
              )}
              {total.length === 0 && project.milestones.length === 0 && (
                <EmptyState
                  title="Plan the work"
                  description="Add tasks above, or split the project into milestones like “Design”, “Build”, “Launch”."
                  action={!closed && <Button variant="outline" onClick={() => setAddingMilestone(true)}><Plus /> Add a milestone</Button>}
                  className="border-t border-border py-8"
                />
              )}
            </div>
          ) : (
            <ProjectBoard tasks={tasks} />
          )}
        </div>

        {/* ─── Progress & details ─── */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-4">
              <ProgressRing value={pct} size={72} stroke={7}>
                <span className="text-base font-semibold tabular">{total.length ? `${pct}%` : "—"}</span>
              </ProgressRing>
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold tabular">{total.length ? `${done} of ${total.length} tasks done` : "No tasks yet"}</p>
                <p className="text-muted-foreground">Progress = completed ÷ all tasks</p>
              </div>
            </div>
          </div>

          <ProjectDetails project={project} onPatch={(patch, message) => actions.update(project.id, patch, message)} />
        </aside>
      </div>

      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
    </div>
  )
}

/** Editable details, saved as you change them. */
function ProjectDetails({ project, onPatch }: { project: ProjectDetailDTO; onPatch: (patch: Record<string, unknown>, message?: string) => void }) {
  const clock = useClock()
  const [goals, setGoals] = useState<{ id: string; name: string; status: string }[]>([])
  const [description, setDescription] = useState(project.description ?? "")
  useEffect(() => {
    api<{ id: string; name: string; status: string }[]>("/api/goals").then(setGoals).catch(() => {})
  }, [])

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold">Details</p>
      <Row label="Status">
        <Select size="sm" value={project.status} onChange={(v) => onPatch({ status: v }, `Moved to ${v}`)} aria-label="Status"
          options={PROJECT_STATUSES.map((s) => ({ value: s, label: s, dot: TONE_DOT[PROJECT_STATUS_META[s].tone] }))} />
      </Row>
      <Row label="Priority">
        <Select size="sm" value={project.priority} onChange={(v) => onPatch({ priority: v })} aria-label="Priority"
          options={PROJECT_PRIORITIES.map((p) => ({ value: p, label: PROJECT_PRIORITY_META[p].label, dot: TONE_DOT[PROJECT_PRIORITY_META[p].tone] }))} />
      </Row>
      <Row label="Deadline">
        <DatePicker size="sm" value={keyOf(project.deadline, clock) ?? ""} onChange={(v) => onPatch({ deadline: v })} placeholder="None" quick={[]} title="Project deadline" />
      </Row>
      <Row label="Goal">
        <Select size="sm" value={project.goalId ?? ""} onChange={(v) => onPatch({ goalId: v || null })} placeholder="No goal" aria-label="Goal"
          options={goals.filter((g) => g.status !== "Archived").map((g) => ({ value: g.id, label: g.name, icon: <Target /> }))} />
      </Row>
      <div className="space-y-1.5 pt-1">
        <p className="text-xs text-muted-foreground">Description</p>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (project.description ?? "") && onPatch({ description })}
          rows={3}
          placeholder="What is this project and why does it matter?"
          className="field-sizing-content min-h-20"
        />
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * A milestone (or "No milestone") as a section of the project list:
 * header with progress, open tasks, completed ones folded away.
 */
function MilestoneSection({
  milestone: m,
  index,
  tasks,
  projectId,
  closed,
  hideWhenEmpty,
  onChange,
}: {
  milestone: MilestoneDTO | null
  index: number
  tasks: TaskDTO[]
  projectId: string
  closed: boolean
  hideWhenEmpty?: boolean
  onChange?: (patch: Partial<MilestoneDTO> | null) => void
}) {
  const { refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const msDone = m?.status === "Completed"
  const [open, setOpen] = useState(!msDone)
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(m?.title ?? "")

  const all = counted(tasks)
  const finished = tasks.filter((t) => t.status === "Completed")
  const openTasks = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled")
  const pct = calcProgress(finished.length, all.length)
  if (!m && hideWhenEmpty && tasks.length === 0) {
    return closed ? null : (
      <div className="border-t border-border">
        <TaskInlineAdd defaults={{ projectId }} placeholder="Add a task without a milestone" />
      </div>
    )
  }

  const patch = async (body: Partial<MilestoneDTO>) => {
    if (!m) return
    onChange?.(body)
    try {
      await api(`/api/milestones/${m.id}`, { method: "PATCH", body })
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
      refresh()
    }
  }
  const remove = async () => {
    if (!m) return
    const ok = await confirm({
      title: `Delete milestone “${m.title}”?`,
      message: all.length ? `Its ${all.length} tasks stay in the project under “No milestone”.` : undefined,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    onChange?.(null)
    api(`/api/milestones/${m.id}`, { method: "DELETE" }).then(refresh).catch((err) => toast.error(err.message))
  }
  const saveTitle = () => {
    setEditing(false)
    const t = title.trim()
    if (m && t && t !== m.title) patch({ title: t })
    else setTitle(m?.title ?? "")
  }

  return (
    <section className={cn(index > 0 && "border-t border-border")}>
      <div className="flex items-center gap-3 bg-subtle/70 px-4 py-2.5">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Collapse" : "Expand"} className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        {m ? (
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", msDone ? "bg-success text-white" : "bg-primary-soft text-primary")}>
            {msDone ? "✓" : index + 1}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle()
                if (e.key === "Escape") {
                  setTitle(m?.title ?? "")
                  setEditing(false)
                }
              }}
              className="w-full rounded-md bg-card px-2 py-0.5 text-base font-semibold outline-none ring-1 ring-ring sm:text-sm"
            />
          ) : (
            <button type="button" onClick={() => setOpen((v) => !v)} className={cn("w-full cursor-pointer truncate text-left text-sm font-semibold", !m && "text-muted-foreground")}>
              {m ? m.title : "No milestone"}
            </button>
          )}
        </div>
        {all.length > 0 && (
          <div className="hidden items-center gap-2 sm:flex">
            <ProgressBar value={pct} className="h-1 w-24" />
            <span className="w-10 text-right text-xs text-muted-foreground tabular">{finished.length}/{all.length}</span>
          </div>
        )}
        <span className="text-xs text-muted-foreground tabular sm:hidden">{all.length ? `${finished.length}/${all.length}` : ""}</span>
        {m && (
          <Menu
            label={m.title}
            items={[
              { label: "Rename", icon: <Pencil />, onSelect: () => setEditing(true) },
              msDone
                ? { label: "Reopen", icon: <RotateCcw />, onSelect: () => patch({ status: "Active" }) }
                : { label: "Mark complete", icon: <CheckCircle2 />, onSelect: () => (patch({ status: "Completed" }), setOpen(false)) },
              { separator: true },
              { label: "Delete milestone", icon: <Trash2 />, danger: true, onSelect: remove },
            ]}
          />
        )}
      </div>
      {open && (
        <div>
          {!closed && !msDone && (
            <TaskInlineAdd defaults={{ projectId, milestoneId: m?.id }} placeholder={m ? `Add a task to ${m.title}` : "Add a task"} className="border-b border-border/60" />
          )}
          <div className="divide-y divide-border/60">
            {openTasks.map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}
          </div>
          {finished.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex w-full cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                {finished.length} completed
              </button>
              {showDone && <div className="divide-y divide-border/60">{finished.map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}</div>}
            </>
          )}
          {tasks.length === 0 && (closed || msDone) && <p className="px-4 py-3 text-[13px] text-muted-foreground">No tasks.</p>}
        </div>
      )}
    </section>
  )
}

function AddMilestone({ projectId, onDone }: { projectId: string; onDone: (m?: MilestoneDTO) => void }) {
  const { refresh } = useApp()
  const toast = useToast()
  const [title, setTitle] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return onDone()
    try {
      const m = await api<MilestoneDTO>(`/api/projects/${projectId}/milestones`, { body: { title } })
      refresh()
      onDone(m)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-primary-soft/40 p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        placeholder="Milestone name, e.g. “Authentication”"
        className="h-9 flex-1 rounded-lg bg-card px-3 text-base outline-none ring-1 ring-border focus:ring-ring sm:text-sm"
      />
      <Button variant="ghost" onClick={() => onDone()}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={!title.trim()}>Add</Button>
    </form>
  )
}

/** Project tasks by status — drag between columns. */
function ProjectBoard({ tasks }: { tasks: TaskDTO[] }) {
  const { openTask } = useApp()
  const clock = useClock()
  const actions = useTaskActions()
  const [over, setOver] = useState<string | null>(null)
  const cols = [
    { status: "Todo", label: "To do" },
    { status: "InProgress", label: "In progress" },
    { status: "Completed", label: "Done" },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {cols.map((c) => {
        const items = tasks.filter((t) => t.status === c.status).sort(compareTasks)
        return (
          <div
            key={c.status}
            onDragOver={(e) => (e.preventDefault(), setOver(c.status))}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const t = tasks.find((x) => x.id === e.dataTransfer.getData("text/task-id"))
              if (t && t.status !== c.status) actions.update(t, { status: c.status, completedAt: c.status === "Completed" ? new Date().toISOString() : null })
            }}
            className={cn("rounded-2xl border border-border bg-subtle p-2", over === c.status && "border-primary/50 bg-primary-soft")}
          >
            <div className="flex justify-between px-2 pt-1 pb-2 text-[13px] font-semibold">
              {c.label}
              <span className="text-xs font-normal text-muted-foreground tabular">{items.length}</span>
            </div>
            <div className="min-h-24 space-y-2">
              {items.map((t) => {
                const k = keyOf(t.scheduledDate ?? t.dueDate, clock)
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => openTask(t.id)}
                    className="cursor-pointer rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] hover:border-border-strong"
                  >
                    <div className="flex items-start gap-2">
                      <PriorityIcon priority={t.priority} className="mt-0.5" />
                      <p className={cn("min-w-0 flex-1 text-[13px] leading-snug", t.status === "Completed" && "text-muted-foreground line-through")}>{splitTicket(t.title).code && <span className="mr-1.5 rounded bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">{splitTicket(t.title).code}</span>}{splitTicket(t.title).text}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-2.5 text-[11px] text-muted-foreground">
                      {t.milestone && <span className="truncate">{t.milestone.title}</span>}
                      {k && t.status !== "Completed" && <span className={cn(bucketOf(t, clock) === "overdue" && "font-medium text-danger")}>{dayLabel(k, clock.today)}</span>}
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

/**
 * The project's milestones as a roadmap: where you are, what's done, what's next.
 * Tap a milestone to focus the list on it.
 */
function Roadmap({
  milestones,
  taskCounts,
  focus,
  onFocus,
}: {
  milestones: MilestoneDTO[]
  taskCounts: (id: string) => { total: number; done: number }
  focus: string | null
  onFocus: (id: string) => void
}) {
  const stats = milestones.map((m) => ({ m, ...taskCounts(m.id), complete: m.status === "Completed" }))
  const currentId = stats.find((x) => !x.complete && (x.total === 0 || x.done < x.total))?.m.id
  return (
    <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
      <ol className="flex min-w-max gap-2 sm:min-w-0">
        {stats.map(({ m, total, done, complete }, i) => {
          const isCurrent = m.id === currentId
          const pct = complete ? 100 : calcProgress(done, total)
          return (
            <li key={m.id} className="flex min-w-[180px] flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => onFocus(m.id)}
                aria-pressed={focus === m.id}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                  focus === m.id ? "border-primary bg-primary-soft" : isCurrent ? "border-primary/40 bg-card" : "border-border bg-card hover:border-border-strong",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", complete || (total > 0 && done === total) ? "bg-success text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {complete || (total > 0 && done === total) ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{m.title}</span>
                  {isCurrent && <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary-foreground uppercase">Now</span>}
                </span>
                <span className="flex items-center gap-2">
                  <ProgressBar value={pct} className="h-1 flex-1" />
                  <span className="text-[11px] text-muted-foreground tabular">{total ? `${done}/${total}` : "—"}</span>
                </span>
              </button>
              {i < stats.length - 1 && <ChevronRight className="size-4 shrink-0 text-border-strong" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
