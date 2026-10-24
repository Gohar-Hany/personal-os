"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle, Archive, ArchiveRestore, CalendarClock, CheckCircle2, ChevronDown, CircleDot, FolderKanban, Hourglass,
  LayoutGrid, List, Milestone, Pause, Pencil, Play, Plus, Star, StarOff, Trash2,
} from "lucide-react"
import { cn, calcProgress } from "@/lib/utils"
import { dayLabel, keyOf, splitTicket } from "@/lib/tasks/taskLogic"
import { useClock } from "@/components/app/AppProvider"
import { projectDot } from "@/components/tasks/TaskRow"
import { PROJECT_PRIORITY_META, PROJECT_STATUS_META, TONE_DOT } from "@/lib/constants"
import { useSynced } from "@/lib/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, EmptyState, PageHeader, ProgressBar, Segmented } from "@/components/ui/misc"
import { Menu, type MenuItem } from "@/components/ui/menu"
import { ProjectDialog, type ProjectFormValue } from "@/components/projects/ProjectDialog"
import { useProjectActions } from "@/components/projects/useProjectActions"
import type { ProjectDTO } from "@/types"

const SECTIONS = [
  { key: "active", title: "In progress", statuses: ["Active"] },
  { key: "next", title: "Up next", statuses: ["Planned", "Idea"] },
  { key: "paused", title: "Paused", statuses: ["Paused"] },
  { key: "done", title: "Done & archived", statuses: ["Completed", "Archived"], collapsed: true },
]

type Actions = ReturnType<typeof useProjectActions>

export function ProjectsClient({ projects: serverProjects }: { projects: ProjectDTO[] }) {
  const [projects, setProjects] = useSynced(serverProjects)
  const [dialog, setDialog] = useState<Partial<ProjectFormValue> | null>(null)
  const [openDone, setOpenDone] = useState(false)
  const [view, setView] = useState<"cards" | "list">("cards")

  const actions = useProjectActions((id, patch) =>
    setProjects((list) =>
      patch === null
        ? list.filter((p) => p.id !== id)
        : list.map((p) => (p.id === id ? { ...p, ...patch } : patch.isFocus ? { ...p, isFocus: false } : p)),
    ),
  )

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        items: projects
          .filter((p) => s.statuses.includes(p.status))
          .sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || a.priority.localeCompare(b.priority)),
      })),
    [projects],
  )

  const live = projects.filter((p) => p.status !== "Completed" && p.status !== "Archived")
  const totals = {
    active: projects.filter((p) => p.status === "Active").length,
    open: live.reduce((s, p) => s + (p.openCount ?? 0), 0),
    overdue: live.reduce((s, p) => s + (p.overdueCount ?? 0), 0),
    week: live.reduce((s, p) => s + (p.dueThisWeek ?? 0), 0),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Each project's progress is calculated from its tasks — nothing to update by hand."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "cards", label: <><LayoutGrid /> Cards</> },
                { value: "list", label: <><List /> List</> },
              ]}
            />
            <Button variant="primary" onClick={() => setDialog({})}>
              <Plus /> New project
            </Button>
          </>
        }
      />

      {projects.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          <Stat icon={<FolderKanban />} label="Active projects" value={totals.active} />
          <Stat icon={<CircleDot />} label="Open tasks" value={totals.open} />
          <Stat icon={<AlertCircle />} label="Overdue" value={totals.overdue} tone={totals.overdue ? "text-danger" : undefined} />
          <Stat icon={<CalendarClock />} label="Due this week" value={totals.week} />
        </div>
      )}

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="A project groups related work: split it into milestones, add tasks, and watch progress fill in by itself."
            action={<Button variant="primary" onClick={() => setDialog({})}><Plus /> Create your first project</Button>}
          />
        </Card>
      ) : (
        sections.map((s) => {
          if (s.items.length === 0) return null
          const collapsed = s.collapsed && !openDone
          return (
            <section key={s.key} className="space-y-3">
              <button
                type="button"
                disabled={!s.collapsed}
                onClick={() => setOpenDone((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold enabled:cursor-pointer enabled:text-muted-foreground enabled:hover:text-foreground"
              >
                {s.collapsed && <ChevronDown className={cn("size-4 transition-transform", collapsed && "-rotate-90")} />}
                {s.title}
                <span className="rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular">{s.items.length}</span>
              </button>
              {!collapsed &&
                (view === "cards" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {s.items.map((p) => <ProjectCard key={p.id} project={p} onEdit={() => setDialog(p)} actions={actions} />)}
                  </div>
                ) : (
                  <ProjectTable projects={s.items} onEdit={(p) => setDialog(p)} actions={actions} />
                ))}
            </section>
          )
        })
      )}

      <ProjectDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} project={dialog} />
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center gap-3 bg-card px-4 py-3">
      <span className={cn("text-muted-foreground [&_svg]:size-4", tone)}>{icon}</span>
      <div>
        <p className={cn("text-xl font-semibold tabular", tone)}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function projectMenu(p: ProjectDTO, onEdit: () => void, actions: Actions): MenuItem[] {
  const closed = p.status === "Completed" || p.status === "Archived"
  return [
    p.isFocus
      ? { label: "Remove focus", icon: <StarOff />, onSelect: () => actions.setFocus(p.id, false) }
      : { label: "Set as focus", icon: <Star />, onSelect: () => actions.setFocus(p.id, true) },
    { label: "Edit", icon: <Pencil />, onSelect: onEdit },
    { separator: true },
    ...(p.status === "Paused"
      ? [{ label: "Resume", icon: <Play />, onSelect: () => actions.setStatus(p.id, "Active") }]
      : !closed
        ? [{ label: "Pause", icon: <Pause />, onSelect: () => actions.setStatus(p.id, "Paused") }]
        : []),
    ...(!closed ? [{ label: "Mark complete", icon: <CheckCircle2 />, onSelect: () => actions.setStatus(p.id, "Completed") }] : []),
    p.status === "Archived"
      ? { label: "Restore", icon: <ArchiveRestore />, onSelect: () => actions.setStatus(p.id, "Active") }
      : { label: "Archive", icon: <Archive />, onSelect: () => actions.setStatus(p.id, "Archived") },
    { separator: true },
    { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => actions.remove(p) },
  ]
}

/** Progress split by milestone: one segment per milestone, sized by its share of tasks. */
function MilestoneBar({ p }: { p: ProjectDTO }) {
  const ms = (p.milestones ?? []).filter((m) => (m.total ?? 0) > 0)
  if (ms.length < 2) return <ProgressBar value={calcProgress(p.completedTaskCount, p.taskCount)} />
  const total = ms.reduce((s, m) => s + (m.total ?? 0), 0)
  return (
    <div className="flex h-1.5 gap-0.5" role="img" aria-label="Progress by milestone">
      {ms.map((m) => (
        <div key={m.id} className="h-full overflow-hidden rounded-full bg-muted" style={{ width: `${((m.total ?? 0) / total) * 100}%` }} title={`${m.title}: ${m.done}/${m.total}`}>
          <div className={cn("h-full rounded-full", m.status === "Completed" || m.done === m.total ? "bg-success" : "bg-primary")} style={{ width: `${calcProgress(m.done ?? 0, m.total ?? 0)}%` }} />
        </div>
      ))}
    </div>
  )
}

const currentMilestone = (p: ProjectDTO) =>
  p.milestones?.find((m) => m.status !== "Completed" && (m.done ?? 0) < (m.total ?? 0)) ?? p.milestones?.find((m) => m.status !== "Completed")

function ProjectCard({ project: p, onEdit, actions }: { project: ProjectDTO; onEdit: () => void; actions: Actions }) {
  const clock = useClock()
  const pct = calcProgress(p.completedTaskCount, p.taskCount)
  const prio = PROJECT_PRIORITY_META[p.priority]
  const closed = p.status === "Completed" || p.status === "Archived"
  const current = currentMilestone(p)
  const msDone = (p.milestones ?? []).filter((m) => m.status === "Completed").length

  return (
    <Card className={cn("group relative flex flex-col gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-pop)]", p.isFocus && "border-primary/40 ring-1 ring-primary/20")}>
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", projectDot(p.id))} />
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[15px] font-semibold">{p.name}</h3>
            {p.isFocus && <Star className="size-3.5 shrink-0 fill-primary text-primary" aria-label="Focus project" />}
          </div>
          {p.description && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{p.description}</p>}
        </Link>
        <div className="relative z-10 flex items-center gap-1">
          <Badge tone={prio?.tone}>{prio?.short ?? p.priority}</Badge>
          <Menu label={p.name} items={projectMenu(p, onEdit, actions)} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tracking-tight tabular">{p.taskCount ? `${pct}%` : "—"}</span>
          <span className="text-xs text-muted-foreground tabular">
            {p.taskCount ? `${p.completedTaskCount}/${p.taskCount} tasks` : "Not started"}
            {(p.milestoneCount ?? 0) > 0 && ` · ${msDone}/${p.milestoneCount} milestones`}
          </span>
        </div>
        <MilestoneBar p={p} />
      </div>

      <div className="mt-auto space-y-1.5 text-xs">
        {current && !closed && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Milestone className="size-3.5 shrink-0" />
            <span className="truncate">Now: <span className="font-medium text-foreground">{current.title}</span></span>
          </p>
        )}
        {p.nextTask && !closed && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <CircleDot className="size-3.5 shrink-0" />
            <span className="truncate">Next: <span className="text-foreground">{splitTicket(p.nextTask.title).text}</span></span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-muted-foreground">
          {!!p.overdueCount && <span className="font-medium text-danger">{p.overdueCount} overdue</span>}
          {!!p.dueThisWeek && <span>{p.dueThisWeek} due this week</span>}
          {!!p.inProgressCount && <span>{p.inProgressCount} in progress</span>}
          {p.deadline && !closed && (
            <span className="inline-flex items-center gap-1"><Hourglass className="size-3" /> {dayLabel(keyOf(p.deadline, clock)!, clock.today)}</span>
          )}
          {p.status !== "Active" && (
            <span className="inline-flex items-center gap-1">
              <span className={cn("size-1.5 rounded-full", TONE_DOT[PROJECT_STATUS_META[p.status]?.tone ?? "neutral"])} />
              {PROJECT_STATUS_META[p.status]?.label}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

const TABLE_COLS = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_64px_72px_minmax(0,1.5fr)_88px_32px]"

/** Dense table for comparing projects at a glance on desktop. */
function ProjectTable({ projects, onEdit, actions }: { projects: ProjectDTO[]; onEdit: (p: ProjectDTO) => void; actions: Actions }) {
  const clock = useClock()
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className={cn("hidden gap-4 border-b border-border bg-subtle px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase md:grid", TABLE_COLS)}>
        <span>Project</span><span>Progress</span><span className="text-right">Open</span><span className="text-right">Overdue</span><span>Next task</span><span className="text-right">Deadline</span><span />
      </div>
      <div className="divide-y divide-border/60">
        {projects.map((p) => {
          const pct = calcProgress(p.completedTaskCount, p.taskCount)
          return (
            <div key={p.id} className={cn("group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-subtle", TABLE_COLS)}>
              <Link href={`/projects/${p.id}`} className="flex min-w-0 items-center gap-2.5 after:absolute after:inset-0">
                <span className={cn("size-2.5 shrink-0 rounded-full", projectDot(p.id))} />
                <span className="truncate text-sm font-medium">{p.name}</span>
                {p.isFocus && <Star className="size-3.5 shrink-0 fill-primary text-primary" />}
                <Badge tone={PROJECT_PRIORITY_META[p.priority]?.tone}>{p.priority}</Badge>
              </Link>
              <div className="relative z-10 md:order-last">
                <Menu label={p.name} items={projectMenu(p, () => onEdit(p), actions)} />
              </div>
              <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                <div className="flex-1"><MilestoneBar p={p} /></div>
                <span className="w-9 text-right text-xs tabular">{p.taskCount ? `${pct}%` : "—"}</span>
              </div>
              <span className="hidden text-right text-sm tabular md:block">{p.openCount ?? 0}</span>
              <span className={cn("hidden text-right text-sm tabular md:block", p.overdueCount ? "font-medium text-danger" : "text-muted-foreground")}>{p.overdueCount ?? 0}</span>
              <span className="hidden truncate text-[13px] text-muted-foreground md:block">{p.nextTask ? splitTicket(p.nextTask.title).text : "—"}</span>
              <span className="hidden text-right text-xs text-muted-foreground md:block">{p.deadline ? dayLabel(keyOf(p.deadline, clock)!, clock.today) : "—"}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
