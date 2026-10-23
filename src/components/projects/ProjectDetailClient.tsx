"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive, ArchiveRestore, ArrowLeft, CheckCircle2, ChevronDown, Hourglass, Pencil, Plus, RotateCcw, Star, Target, Trash2,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn, calcProgress } from "@/lib/utils"
import { relativeDay } from "@/lib/dates"
import { compareTasks } from "@/lib/tasks/taskLogic"
import { PROJECT_PRIORITIES, PROJECT_PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META, TONE_DOT } from "@/lib/constants"
import { useSynced } from "@/lib/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { EmptyState, ProgressBar, ProgressRing } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"
import { useApp } from "@/components/app/AppProvider"
import { TaskRow } from "@/components/tasks/TaskRow"
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd"
import { useLiveTasks } from "@/components/tasks/useTasks"
import { ProjectDialog } from "@/components/projects/ProjectDialog"
import { useProjectActions } from "@/components/projects/useProjectActions"
import type { MilestoneDTO, ProjectDetailDTO, TaskDTO } from "@/types"

/** Open tasks first (by date/priority), finished ones at the bottom. */
function sortForProject(tasks: TaskDTO[]) {
  return [...tasks].sort((a, b) => {
    const da = a.status === "Completed" ? 1 : 0
    const db = b.status === "Completed" ? 1 : 0
    return da - db || compareTasks(a, b)
  })
}

export function ProjectDetailClient({ project: serverProject }: { project: ProjectDetailDTO }) {
  const [project, setProject] = useSynced(serverProject)
  const [editOpen, setEditOpen] = useState(false)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const actions = useProjectActions((_, patch) => patch && setProject((p) => ({ ...p, ...patch })))

  // Live (optimistic) tasks, so progress moves the moment you tick something
  const live = useLiveTasks(useMemo(() => [...project.tasks, ...project.milestones.flatMap((m) => m.tasks)], [project]))
  const allTasks = live.filter((t) => t.projectId === project.id)
  const counted = allTasks.filter((t) => t.status !== "Cancelled")
  const done = counted.filter((t) => t.status === "Completed").length
  const pct = calcProgress(done, counted.length)
  const byMilestone = (id: string | null) => sortForProject(allTasks.filter((t) => (t.milestoneId ?? null) === id))
  const milestonesDone = project.milestones.filter((m) => m.status === "Completed").length
  const closed = project.status === "Completed" || project.status === "Archived"

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Projects
      </Link>

      {/* ─── Header ─── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <button
              type="button"
              onClick={() => actions.setFocus(project.id, !project.isFocus)}
              aria-label={project.isFocus ? "Remove focus" : "Set as focus project"}
              title={project.isFocus ? "Your focus project" : "Set as focus project"}
              className="mt-1 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Star className={cn("size-5", project.isFocus && "fill-primary text-primary")} />
            </button>
          </div>
          {project.description && <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{project.description}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {project.goal && (
              <Link href="/goals" className="inline-flex items-center gap-1 hover:text-foreground">
                <Target className="size-3.5" /> {project.goal.name}
              </Link>
            )}
            {project.deadline && (
              <span className="inline-flex items-center gap-1">
                <Hourglass className="size-3.5" /> Due {relativeDay(new Date(project.deadline))}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Select
              size="sm"
              value={project.status}
              onChange={(v) => actions.setStatus(project.id, v)}
              options={PROJECT_STATUSES.map((s) => ({ value: s, label: s, dot: TONE_DOT[PROJECT_STATUS_META[s].tone] }))}
              className="w-32"
              aria-label="Status"
            />
            <Select
              size="sm"
              value={project.priority}
              onChange={(v) => actions.update(project.id, { priority: v })}
              options={PROJECT_PRIORITIES.map((p) => ({ value: p, label: PROJECT_PRIORITY_META[p].label, dot: TONE_DOT[PROJECT_PRIORITY_META[p].tone] }))}
              className="w-36"
              aria-label="Priority"
            />
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Menu
              items={[
                project.status === "Archived"
                  ? { label: "Restore", icon: <ArchiveRestore />, onSelect: () => actions.setStatus(project.id, "Active") }
                  : { label: "Archive", icon: <Archive />, onSelect: () => actions.setStatus(project.id, "Archived") },
                { label: "Delete project", icon: <Trash2 />, danger: true, onSelect: () => actions.remove({ ...project, taskCount: counted.length }, true) },
              ]}
            />
          </div>
        </div>

        <Card className="flex items-center gap-4 p-4 sm:w-64">
          <ProgressRing value={pct} size={64} stroke={6}>
            <span className="text-sm font-semibold tabular">{counted.length ? `${pct}%` : "—"}</span>
          </ProgressRing>
          <div className="text-[13px]">
            {counted.length ? (
              <>
                <p className="font-medium tabular">{done} of {counted.length} tasks done</p>
                {project.milestones.length > 0 && (
                  <p className="text-xs text-muted-foreground tabular">{milestonesDone} of {project.milestones.length} milestones</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Not started — progress fills in as you complete tasks.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ─── Milestones ─── */}
      <div className="space-y-3">
        {project.milestones.map((m, i) => (
          <MilestoneCard key={m.id} milestone={m} index={i} tasks={byMilestone(m.id)} projectId={project.id} onChange={(patch) =>
            setProject((p) => ({
              ...p,
              milestones: patch === null ? p.milestones.filter((x) => x.id !== m.id) : p.milestones.map((x) => (x.id === m.id ? { ...x, ...patch } : x)),
            }))
          } />
        ))}

        {/* Tasks not in a milestone */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
            <h2 className="text-[13px] font-semibold">{project.milestones.length ? "Other tasks" : "Tasks"}</h2>
            <span className="text-xs text-muted-foreground tabular">{byMilestone(null).length || ""}</span>
          </div>
          {!closed && <TaskInlineAdd defaults={{ projectId: project.id }} />}
          {byMilestone(null).length === 0 && project.milestones.length === 0 ? (
            <EmptyState title="No tasks yet" description="Add the first task above. Use milestones to group bigger phases of work." className="py-8" />
          ) : (
            <div className="pb-2">
              {byMilestone(null).map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}
            </div>
          )}
        </Card>

        {addingMilestone ? (
          <AddMilestone projectId={project.id} onDone={(m) => {
            setAddingMilestone(false)
            if (m) setProject((p) => ({ ...p, milestones: [...p.milestones, { ...m, tasks: [] }] }))
          }} />
        ) : (
          <Button variant="ghost" onClick={() => setAddingMilestone(true)}>
            <Plus /> Add milestone
          </Button>
        )}
      </div>

      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
    </div>
  )
}

function MilestoneCard({
  milestone: m,
  index,
  tasks,
  projectId,
  onChange,
}: {
  milestone: MilestoneDTO
  index: number
  tasks: TaskDTO[]
  projectId: string
  onChange: (patch: Partial<MilestoneDTO> | null) => void
}) {
  const { refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const completed = m.status === "Completed"
  const [open, setOpen] = useState(!completed)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(m.title)

  const counted = tasks.filter((t) => t.status !== "Cancelled")
  const done = counted.filter((t) => t.status === "Completed").length
  const pct = calcProgress(done, counted.length)

  const patch = async (body: Partial<MilestoneDTO>) => {
    onChange(body)
    try {
      await api(`/api/milestones/${m.id}`, { method: "PATCH", body })
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
      refresh()
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete milestone “${m.title}”?`,
      message: counted.length ? `Its ${counted.length} tasks stay in the project under “Other tasks”.` : undefined,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    onChange(null)
    api(`/api/milestones/${m.id}`, { method: "DELETE" }).then(refresh).catch((err) => toast.error(err.message))
  }

  const saveTitle = () => {
    setEditing(false)
    const t = title.trim()
    if (t && t !== m.title) patch({ title: t })
    else setTitle(m.title)
  }

  return (
    <Card className={cn("overflow-hidden", completed && "opacity-75")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
          className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
            completed ? "bg-success text-white" : "bg-primary-soft text-primary",
          )}
        >
          {completed ? "✓" : index + 1}
        </span>
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
                  setTitle(m.title)
                  setEditing(false)
                }
              }}
              className="w-full rounded-md bg-muted px-2 py-0.5 text-base sm:text-sm font-semibold outline-none"
            />
          ) : (
            <button type="button" onClick={() => setOpen((v) => !v)} className="w-full cursor-pointer truncate text-left text-sm font-semibold">
              {m.title}
            </button>
          )}
          {counted.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <ProgressBar value={pct} className="h-1 max-w-48 flex-1" />
              <span className="text-xs text-muted-foreground tabular">{done}/{counted.length}</span>
            </div>
          )}
        </div>
        <Menu
          items={[
            { label: "Rename", icon: <Pencil />, onSelect: () => setEditing(true) },
            completed
              ? { label: "Reopen", icon: <RotateCcw />, onSelect: () => patch({ status: "Active" }) }
              : { label: "Mark complete", icon: <CheckCircle2 />, onSelect: () => (patch({ status: "Completed" }), setOpen(false)) },
            { separator: true },
            { label: "Delete", icon: <Trash2 />, danger: true, onSelect: remove },
          ]}
        />
      </div>
      {open && (
        <div className="border-t border-border pb-1.5">
          {!completed && <TaskInlineAdd defaults={{ projectId, milestoneId: m.id }} placeholder={`Add a task to ${m.title}`} />}
          {tasks.map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}
          {tasks.length === 0 && completed && <p className="px-4 py-3 text-[13px] text-muted-foreground">No tasks.</p>}
        </div>
      )}
    </Card>
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
    <Card className="p-3">
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onDone()}
          placeholder="Milestone name, e.g. “Authentication”"
          className="h-9 flex-1 rounded-lg bg-transparent px-2 text-base sm:text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button variant="ghost" onClick={() => onDone()}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!title.trim()}>Add</Button>
      </form>
    </Card>
  )
}
