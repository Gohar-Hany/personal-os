"use client"

import { useMemo, useState } from "react"
import { Archive, CheckCircle2, FolderKanban, Hourglass, Pause, Pencil, Play, Plus, RotateCcw, Target, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatNumber } from "@/lib/utils"
import { relativeDay } from "@/lib/dates"
import { GOAL_CATEGORY_META } from "@/lib/constants"
import { GOAL_CATEGORY_ICONS, GOAL_TONE_STYLES } from "@/components/goals/goalIcons"
import { useSynced } from "@/lib/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, EmptyState, PageHeader, ProgressBar, Segmented } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"
import { useApp } from "@/components/app/AppProvider"
import { GoalDialog } from "@/components/goals/GoalDialog"
import type { GoalDTO } from "@/types"

const pctOf = (cur: number, target?: number | null) => (target ? Math.min(100, Math.round((cur / target) * 100)) : null)

export function GoalsClient({ goals: serverGoals }: { goals: GoalDTO[] }) {
  const { refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [goals, setGoals] = useSynced(serverGoals)
  const [filter, setFilter] = useState<"active" | "done" | "all">("active")
  const [dialog, setDialog] = useState<Partial<GoalDTO> | null>(null)

  const visible = useMemo(
    () =>
      goals.filter((g) =>
        filter === "all" ? true : filter === "active" ? g.status === "Active" || g.status === "Paused" : g.status === "Completed" || g.status === "Archived",
      ),
    [goals, filter],
  )

  const update = async (g: GoalDTO, patch: Partial<GoalDTO>, message?: string) => {
    const next = { ...g, ...patch }
    next.progressPct = pctOf(next.currentValue, next.targetValue)
    setGoals((list) => list.map((x) => (x.id === g.id ? next : x)))
    try {
      await api(`/api/goals/${g.id}`, { method: "PATCH", body: patch })
      refresh()
      if (message) toast.success(message)
      else if (next.status === "Active" && next.targetValue && next.currentValue >= next.targetValue && g.currentValue < next.targetValue) {
        toast.success(`🎉 You reached “${g.name}”!`, { label: "Mark complete", onClick: () => update(next, { status: "Completed" }) })
      }
    } catch (err) {
      setGoals((list) => list.map((x) => (x.id === g.id ? g : x)))
      toast.error((err as Error).message)
    }
  }

  const remove = async (g: GoalDTO) => {
    const ok = await confirm({
      title: `Delete “${g.name}”?`,
      message: g.projectCount ? `${g.projectCount} linked project(s) will be kept but unlinked.` : undefined,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    setGoals((list) => list.filter((x) => x.id !== g.id))
    api(`/api/goals/${g.id}`, { method: "DELETE" }).then(refresh).catch((err) => toast.error(err.message))
  }

  const counts = {
    active: goals.filter((g) => g.status === "Active" || g.status === "Paused").length,
    done: goals.filter((g) => g.status === "Completed" || g.status === "Archived").length,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goals"
        description="The big outcomes your projects work towards."
        actions={
          <Button variant="primary" onClick={() => setDialog({})}>
            <Plus /> New goal
          </Button>
        }
      />

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: `Active ${counts.active}` },
          { value: "done", label: `Achieved ${counts.done}` },
          { value: "all", label: "All" },
        ]}
      />

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target />}
            title={filter === "done" ? "Nothing achieved yet" : "No goals here"}
            description={filter === "done" ? "Completed goals will collect here." : "Set a goal with a target and track how close you are."}
            action={filter !== "done" && <Button variant="primary" onClick={() => setDialog({})}><Plus /> New goal</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((g) => (
            <GoalCard key={g.id} goal={g} onUpdate={update} onEdit={() => setDialog(g)} onDelete={() => remove(g)} />
          ))}
        </div>
      )}

      <GoalDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} goal={dialog} />
    </div>
  )
}

function GoalCard({
  goal: g,
  onUpdate,
  onEdit,
  onDelete,
}: {
  goal: GoalDTO
  onUpdate: (g: GoalDTO, patch: Partial<GoalDTO>, message?: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState("")
  const meta = GOAL_CATEGORY_META[g.category] ?? GOAL_CATEGORY_META.Other
  const toneStyle = GOAL_TONE_STYLES[meta.tone] ?? GOAL_TONE_STYLES.neutral
  const icon = GOAL_CATEGORY_ICONS[g.category] ?? GOAL_CATEGORY_ICONS.Other
  const done = g.status === "Completed"
  const unit = g.unit ? ` ${g.unit}` : ""

  const submitAmount = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n === 0) return
    onUpdate(g, { currentValue: Math.max(0, g.currentValue + n) })
    setAmount("")
    setAdding(false)
  }

  return (
    <Card className={cn("flex flex-col p-4", g.status === "Paused" && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs [&_svg]:size-4",
            toneStyle,
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{g.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{g.category}</span>
            {g.deadline && (
              <span className="inline-flex items-center gap-1">
                <Hourglass className="size-3" /> {relativeDay(new Date(g.deadline))}
              </span>
            )}
            {!!g.projectCount && (
              <span className="inline-flex items-center gap-1">
                <FolderKanban className="size-3" /> {g.projectCount} project{g.projectCount > 1 && "s"}
              </span>
            )}
          </div>
        </div>
        {done && <Badge tone="success">Achieved</Badge>}
        {g.status === "Paused" && <Badge tone="warning">Paused</Badge>}
        <Menu
          items={[
            { label: "Edit", icon: <Pencil />, onSelect: onEdit },
            ...(done
              ? [{ label: "Reopen", icon: <RotateCcw />, onSelect: () => onUpdate(g, { status: "Active" }, "Goal reopened") }]
              : [
                  { label: "Mark achieved", icon: <CheckCircle2 />, onSelect: () => onUpdate(g, { status: "Completed" }, "🎉 Goal achieved") },
                  g.status === "Paused"
                    ? { label: "Resume", icon: <Play />, onSelect: () => onUpdate(g, { status: "Active" }) }
                    : { label: "Pause", icon: <Pause />, onSelect: () => onUpdate(g, { status: "Paused" }) },
                ]),
            { label: "Archive", icon: <Archive />, onSelect: () => onUpdate(g, { status: "Archived" }, "Goal archived") },
            { separator: true },
            { label: "Delete", icon: <Trash2 />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      {g.description && <p className="mt-3 text-[13px] text-muted-foreground">{g.description}</p>}

      <div className="mt-auto space-y-2 pt-4">
        {g.targetValue ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold tabular">
                {formatNumber(g.currentValue)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {formatNumber(g.targetValue)}{unit}
                </span>
              </span>
              <span className="text-[13px] font-medium tabular">{g.progressPct}%</span>
            </div>
            <ProgressBar value={g.progressPct ?? 0} />
          </>
        ) : (
          <button type="button" onClick={onEdit} className="cursor-pointer text-[13px] text-primary hover:underline">
            Set a target to track progress
          </button>
        )}

        {g.targetValue && !done && (
          adding ? (
            <form onSubmit={submitAmount} className="flex items-center gap-2 pt-1">
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                placeholder={`Amount to add${unit}`}
                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-base sm:text-[13px] outline-none focus:border-ring"
              />
              <Button type="submit" size="sm" variant="primary">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="mt-1">
              <Plus /> Add progress
            </Button>
          )
        )}
      </div>
    </Card>
  )
}
