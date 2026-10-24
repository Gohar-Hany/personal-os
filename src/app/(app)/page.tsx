import { prisma } from "@/lib/prisma"
import { getFocusProject } from "@/lib/projects/projectService"
import { getGoals } from "@/lib/goals/goalService"
import { getMoneySnapshot } from "@/lib/finance/financeService"
import { getTodayHabits } from "@/lib/habits/habitService"
import { getTodayTasks } from "@/lib/tasks/taskService"
import { userClock } from "@/lib/userTime"
import { findReviewForWeek } from "@/lib/review/reviewService"
import { serialize } from "@/lib/utils"
import { TodayClient } from "@/components/today/TodayClient"

export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const clock = await userClock()
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
    findReviewForWeek(clock.weekStart),
  ])

  // Week runs Sat–Fri: suggest the review on Thursday and Friday if it isn't written yet.
  const reviewDue = !review && (clock.weekday === 4 || clock.weekday === 5)

  return (
    <TodayClient
      today={clock.today}
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
      quranPage={settings?.quranPage ?? 1}
      backlogCount={backlogCount}
      reviewDue={reviewDue}
    />
  )
}
