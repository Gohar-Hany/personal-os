"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, CheckCircle2, ChevronDown, FolderKanban, Pause, Pencil, Play, Plus, Star, StarOff, Trash2, Hourglass } from "lucide-react"
import { cn, calcProgress } from "@/lib/utils"
import { relativeDay } from "@/lib/dates"
import { PROJECT_PRIORITY_META, PROJECT_STATUS_META } from "@/lib/constants"
import { useSynced } from "@/lib/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { ProjectDialog, type ProjectFormValue } from "@/components/projects/ProjectDialog"
import { useProjectActions } from "@/components/projects/useProjectActions"
import type { ProjectDTO } from "@/types"

const SECTIONS = [
  { key: "active", title: "In progress", statuses: ["Active"] },
  { key: "next", title: "Up next", statuses: ["Planned", "Idea"] },
  { key: "paused", title: "Paused", statuses: ["Paused"] },
  { key: "done", title: "Done & archived", statuses: ["Completed", "Archived"], collapsed: true },
]

export function ProjectsClient({ projects: serverProjects }: { projects: ProjectDTO[] }) {
  const [projects, setProjects] = useSynced(serverProjects)
  const [dialog, setDialog] = useState<Partial<ProjectFormValue> | null>(null)
  const [openDone, setOpenDone] = useState(false)

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Progress is calculated from each project's tasks."
        actions={
          <Button variant="primary" onClick={() => setDialog({})}>
            <Plus /> New project
          </Button>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="Projects group related tasks and milestones, and track their own progress."
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
                className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground enabled:cursor-pointer enabled:hover:text-foreground"
              >
                {s.collapsed && <ChevronDown className={cn("size-4 transition-transform", collapsed && "-rotate-90")} />}
                {s.title}
                <span className="font-normal tabular">{s.items.length}</span>
              </button>
              {!collapsed && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {s.items.map((p) => (
                    <ProjectCard key={p.id} project={p} onEdit={() => setDialog(p)} actions={actions} />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      <ProjectDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} project={dialog} />
    </div>
  )
}

function ProjectCard({
  project: p,
  onEdit,
  actions,
}: {
  project: ProjectDTO
  onEdit: () => void
  actions: ReturnType<typeof useProjectActions>
}) {
  const pct = calcProgress(p.completedTaskCount, p.taskCount)
  const prio = PROJECT_PRIORITY_META[p.priority]
  const closed = p.status === "Completed" || p.status === "Archived"

  return (
    <Card className={cn("group relative flex flex-col p-4 transition-colors hover:border-border-strong", p.isFocus && "border-primary/40 ring-1 ring-primary/20")}>
      <div className="flex items-start gap-2">
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
          <div className="flex items-center gap-1.5">
            {p.isFocus && <Star className="size-3.5 shrink-0 fill-primary text-primary" aria-label="Focus project" />}
            <h3 className="truncate text-sm font-semibold">{p.name}</h3>
          </div>
          {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>}
        </Link>
        <div className="relative z-10 flex items-center gap-1">
          <Badge tone={prio?.tone}>{prio?.short ?? p.priority}</Badge>
          <Menu
            items={[
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
            ]}
          />
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-4">
        {p.taskCount > 0 ? (
          <>
            <div className="flex justify-between text-xs text-muted-foreground tabular">
              <span>
                {p.completedTaskCount}/{p.taskCount} tasks
              </span>
              <span className="font-medium text-foreground">{pct}%</span>
            </div>
            <ProgressBar value={pct} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Not started</p>
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {p.nextTask && !closed ? <>Next: <span className="text-foreground">{p.nextTask.title}</span></> : p.status !== "Active" ? PROJECT_STATUS_META[p.status]?.label : ""}
          </span>
          {p.deadline && !closed && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Hourglass className="size-3" /> {relativeDay(new Date(p.deadline))}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
