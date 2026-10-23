"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Activity, ArrowRight, CalendarPlus, CheckSquare, ChevronDown, FolderKanban, Inbox, RefreshCw, Sparkles, Star, Target, Wallet } from "lucide-react"
import { api } from "@/lib/api"
import { cn, calcProgress, formatCurrency, formatNumber } from "@/lib/utils"
import { dateKey, greeting } from "@/lib/dates"
import { bucketOf } from "@/lib/tasks/taskLogic"
import { useSynced } from "@/lib/hooks"
import { Card, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Amount, CheckCircle, EmptyState, GroupLabel, ProgressBar, ProgressRing } from "@/components/ui/misc"
import { Dialog } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { TaskRow } from "@/components/tasks/TaskRow"
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd"
import { useLiveTasks, useTaskActions } from "@/components/tasks/useTasks"
import { FaithCard, PrayerStrip, nextPrayer, untilLabel, usePrayerTimes, type PrayerLocation } from "@/components/today/FaithCard"
import { useNow } from "@/components/today/useNow"
import type { GoalDTO, TaskDTO, TodayHabitDTO } from "@/types"

interface FocusProject {
  id: string
  name: string
  taskCount: number
  completedTaskCount: number
  currentMilestone: { id: string; title: string } | null
  nextTasks: { id: string; title: string }[]
}

export function TodayClient({
  tasks: serverTasks,
  habits: serverHabits,
  focus,
  money,
  goals,
  location,
  backlogCount,
  reviewDue,
}: {
  tasks: TaskDTO[]
  habits: TodayHabitDTO[]
  focus: FocusProject | null
  money: { totalBalance: number; cash: number | null; spentToday: number; monthExpenses: number; monthIncome: number }
  goals: GoalDTO[]
  location: PrayerLocation
  backlogCount: number
  reviewDue: boolean
}) {
  const { settings, inboxCount, quickAdd, openTask, refresh } = useApp()
  const toast = useToast()
  const now = useNow()
  const times = usePrayerTimes(location, now)
  const next = nextPrayer(times, now, location)

  const tasks = useLiveTasks(serverTasks)
  const actions = useTaskActions()
  const [habits, setHabits] = useSynced(serverHabits)
  const [showDone, setShowDone] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  const groups = useMemo(() => {
    const overdue: TaskDTO[] = []
    const today: TaskDTO[] = []
    const done: TaskDTO[] = []
    for (const t of tasks) {
      if (t.status === "Cancelled") continue
      const b = bucketOf(t)
      if (b === "done") done.push(t)
      else if (b === "overdue") overdue.push(t)
      else if (b === "today") today.push(t)
    }
    return { overdue, today, done }
  }, [tasks])

  // Progress = today's tasks (incl. carried-over) + today's habits. Shown as one number.
  const taskTotal = groups.overdue.length + groups.today.length + groups.done.length
  const habitDone = habits.filter((h) => h.done).length
  const total = taskTotal + habits.length
  const completed = groups.done.length + habitDone
  const pct = calcProgress(completed, total)

  const toggleHabit = async (h: TodayHabitDTO) => {
    const done = !h.done
    setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, done } : x)))
    try {
      await api("/api/habits/log", { body: { habitId: h.id, completed: done, date: dateKey() } })
      refresh()
    } catch (err) {
      setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, done: !done } : x)))
      toast.error((err as Error).message)
    }
  }

  const moveOverdueToToday = () => groups.overdue.forEach((t) => actions.reschedule(t, dateKey()))

  const routine = habits.filter((h) => !h.isPrayer && !h.isQuran && !h.isAdhkar && h.category !== "Religious")

  return (
    <div className="space-y-6">
      {/* ─── Hero: greeting, progress, the five prayers ─── */}
      <Card className="surface-hero overflow-hidden">
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-muted-foreground">{now ? format(now, "EEEE, MMMM d") : " "}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {now ? greeting(now) : "Hello"}, {settings.name}
              </h1>
              {next && now && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border backdrop-blur-sm">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="font-semibold text-foreground">{next.name}</span>
                  {next.time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  <span className="font-medium text-primary">· {untilLabel(next.time, now)}</span>
                </p>
              )}
            </div>
            <ProgressRing value={pct} size={76} stroke={7}>
              <div className="text-center leading-none">
                <div className="text-lg font-semibold tabular">{pct}%</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground tabular">{completed}/{total}</div>
              </div>
            </ProgressRing>
          </div>
          <PrayerStrip habits={habits} onToggle={toggleHabit} times={times} now={now} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular">
            <span><span className="font-semibold text-foreground">{groups.done.length}/{taskTotal}</span> tasks</span>
            <span><span className="font-semibold text-foreground">{habitDone}/{habits.length}</span> habits & prayers</span>
            {money.cash !== null && <span><span className="font-semibold text-foreground">{formatCurrency(money.cash, settings.currency)}</span> cash in hand</span>}
          </div>
        </div>
      </Card>

      {/* ─── Nudges ─── */}
      {(inboxCount > 0 || reviewDue) && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
          {inboxCount > 0 && (
            <Nudge href="/inbox" icon={<Inbox />}>
              {inboxCount} {inboxCount === 1 ? "note" : "notes"} waiting in your Inbox
            </Nudge>
          )}
          {reviewDue && (
            <Nudge href="/weekly-review" icon={<RefreshCw />}>
              Weekly review time
            </Nudge>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* ─── Left: tasks + focus ─── */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="Today's tasks"
              icon={<CheckSquare />}
              meta={groups.today.length + groups.overdue.length || undefined}
              action={
                <Button size="xs" variant="ghost" onClick={() => setPlanOpen(true)}>
                  <CalendarPlus /> Plan{backlogCount > 0 && ` (${backlogCount})`}
                </Button>
              }
            />
            <TaskInlineAdd defaults={{ scheduledDate: dateKey() }} placeholder="Add a task for today" className="border-b border-border" />

            {taskTotal === 0 ? (
              <EmptyState
                icon={<Sparkles />}
                title="Nothing planned yet"
                description={backlogCount > 0 ? `You have ${backlogCount} unscheduled tasks — pick a few for today.` : "Add a task above, or capture an idea with Ctrl K."}
                action={backlogCount > 0 && <Button variant="outline" onClick={() => setPlanOpen(true)}>Pick from backlog</Button>}
              />
            ) : (
              <div className="pb-2">
                {groups.overdue.length > 0 && (
                  <>
                    <div className="flex items-center justify-between pr-3">
                      <GroupLabel tone="danger" count={groups.overdue.length}>Overdue</GroupLabel>
                      <Button size="xs" variant="ghost" onClick={moveOverdueToToday} className="mt-2">
                        Move all to today
                      </Button>
                    </div>
                    {groups.overdue.map((t) => <TaskRow key={t.id} task={t} />)}
                  </>
                )}
                {groups.today.length > 0 && groups.overdue.length > 0 && <GroupLabel count={groups.today.length}>Today</GroupLabel>}
                {groups.today.map((t) => <TaskRow key={t.id} task={t} showDate={false} />)}
                {groups.today.length === 0 && groups.overdue.length === 0 && (
                  <p className="px-4 py-4 text-center text-[13px] text-muted-foreground">🎉 All of today&apos;s tasks are done.</p>
                )}
                {groups.done.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDone((v) => !v)}
                      className="flex w-full cursor-pointer items-center gap-1.5 px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                      {groups.done.length} completed today
                    </button>
                    {showDone && groups.done.map((t) => <TaskRow key={t.id} task={t} showDate={false} />)}
                  </>
                )}
              </div>
            )}
          </Card>

          {focus ? (
            <Card>
              <CardHeader title="Focus" icon={<Star />} tone="warning" href={`/projects/${focus.id}`} hrefLabel="Open" />
              <div className="space-y-3 px-4 pb-4">
                <div>
                  <Link href={`/projects/${focus.id}`} className="text-base font-semibold hover:underline">
                    {focus.name}
                  </Link>
                  {focus.currentMilestone && <p className="text-[13px] text-muted-foreground">Milestone: {focus.currentMilestone.title}</p>}
                </div>
                {focus.taskCount > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground tabular">
                      <span>{focus.completedTaskCount} of {focus.taskCount} tasks</span>
                      <span className="font-medium text-foreground">{calcProgress(focus.completedTaskCount, focus.taskCount)}%</span>
                    </div>
                    <ProgressBar value={calcProgress(focus.completedTaskCount, focus.taskCount)} />
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Not started — add the first task.</p>
                )}
                {focus.nextTasks.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">Up next</p>
                    {focus.nextTasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTask(t.id)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md py-1 text-left text-[13px] hover:text-primary"
                      >
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{t.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Link
              href="/projects"
              className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-[13px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              <FolderKanban className="size-4" />
              <span className="flex-1">Pick a focus project to see its progress here</span>
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        {/* ─── Right: faith, routine, money, goals ─── */}
        <div className="space-y-6">
          <FaithCard habits={habits} onToggle={toggleHabit} />

          {routine.length > 0 && (
            <Card>
              <CardHeader title="Routine" icon={<Activity />} tone="info" meta={`${routine.filter((h) => h.done).length}/${routine.length}`} />
              <div className="pb-2">
                {routine.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => toggleHabit(h)}
                    className="mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-subtle"
                  >
                    <CheckCircle checked={h.done} onChange={() => toggleHabit(h)} label={h.name} />
                    <span className={cn("flex-1 text-sm", h.done && "text-muted-foreground line-through")}>{h.name}</span>
                    {h.targetValue && <span className="text-xs text-muted-foreground">{formatNumber(h.targetValue)} {h.unit}</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Money" icon={<Wallet />} tone="success" href="/finance" hrefLabel="Details" />
            <div className="space-y-3 px-4 pb-4">
              <div>
                <p className="text-xs text-muted-foreground">Total balance</p>
                <p className="text-2xl font-semibold tracking-tight"><Amount value={money.totalBalance} currency={settings.currency} /></p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[13px]">
                <MiniStat label="Cash" value={money.cash !== null ? formatCurrency(money.cash, settings.currency, { compact: true }) : "—"} />
                <MiniStat label="Today" value={formatCurrency(money.spentToday, settings.currency, { compact: true })} />
                <MiniStat label="Month" value={formatCurrency(money.monthExpenses, settings.currency, { compact: true })} />
              </div>
              <Button variant="outline" className="w-full" onClick={() => quickAdd({ mode: "money" })}>
                Log expense or income
              </Button>
            </div>
          </Card>

          {goals.length > 0 && (
            <Card>
              <CardHeader title="Goals" icon={<Target />} tone="info" href="/goals" />
              <div className="space-y-3.5 px-4 pb-4">
                {goals.map((g) => (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">
                        {g.targetValue ? `${formatNumber(g.currentValue)} / ${formatNumber(g.targetValue)} ${g.unit ?? ""}` : "No target yet"}
                      </span>
                    </div>
                    {g.progressPct !== null && <ProgressBar value={g.progressPct} />}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-subtle px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-semibold tabular">{value}</p>
    </div>
  )
}

function Nudge({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] whitespace-nowrap text-foreground shadow-[var(--shadow-card)] hover:border-primary/40 [&_svg]:size-3.5 [&_svg]:text-primary"
    >
      {icon}
      {children}
      <ArrowRight className="!text-muted-foreground" />
    </Link>
  )
}

/** Pick unscheduled tasks for today. */
function PlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Plan your day" description="Tasks without a date. Tap to add them to today.">
      <BacklogPicker />
    </Dialog>
  )
}

function BacklogPicker() {
  const [tasks, setTasks] = useState<TaskDTO[] | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const actions = useTaskActions()
  const toast = useToast()

  useEffect(() => {
    api<TaskDTO[]>("/api/tasks?view=backlog").then(setTasks).catch((err) => toast.error(err.message))
  }, [toast])

  return (
    <>
      {!tasks ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="Backlog is empty" description="Every open task already has a date." />
      ) : (
        <div className="-mx-2 space-y-0.5">
          {tasks.map((t) => {
            const isAdded = added.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                disabled={isAdded}
                onClick={() => {
                  actions.reschedule(t, dateKey())
                  setAdded((s) => new Set(s).add(t.id))
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:cursor-default disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{t.title}</span>
                  {t.project && <span className="block truncate text-xs text-muted-foreground">{t.project.name}</span>}
                </span>
                <span className={cn("shrink-0 text-xs font-medium", isAdded ? "text-success" : "text-primary")}>{isAdded ? "Added ✓" : "+ Today"}</span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
