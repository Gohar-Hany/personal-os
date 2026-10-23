import { prisma } from "@/lib/prisma"
import { getFocusProject } from "@/lib/projects/projectService"
import { getGoals } from "@/lib/goals/goalService"
import { getMoneySnapshot } from "@/lib/finance/financeService"
import { getTodayHabits } from "@/lib/habits/habitService"
import { getTodayTasks } from "@/lib/tasks/taskService"
import { weekStartOf } from "@/lib/dates"
import { serialize } from "@/lib/utils"
import { TodayClient } from "@/components/today/TodayClient"

export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const weekStart = weekStartOf()
  const [settings, tasks, habits, focus, money, goals, backlogCount, review] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: "default" } }),
    getTodayTasks(),
    getTodayHabits(),
    getFocusProject(),
    getMoneySnapshot(),
    getGoals({ status: "Active" }),
    prisma.task.count({
      where: { parentId: null, status: { notIn: ["Completed", "Cancelled"] }, scheduledDate: null, dueDate: null },
    }),
    prisma.weeklyReview.findFirst({ where: { weekStart }, select: { id: true } }),
  ])

  // Week runs Sat–Fri: suggest the review on Thursday and Friday if it isn't written yet.
  const day = new Date().getDay()
  const reviewDue = !review && (day === 4 || day === 5)

  return (
    <TodayClient
      tasks={serialize(tasks)}
      habits={serialize(habits)}
      focus={focus ? serialize(focus) : null}
      money={money}
      goals={serialize(goals.filter((g) => g.targetValue).slice(0, 3))}
      location={{
        lat: settings?.latitude ?? 31.2001,
        lng: settings?.longitude ?? 29.9187,
        method: settings?.prayerMethod ?? "Egyptian",
      }}
      backlogCount={backlogCount}
      reviewDue={reviewDue}
    />
  )
}
