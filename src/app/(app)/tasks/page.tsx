import { getTasks } from "@/lib/tasks/taskService"
import { serialize } from "@/lib/utils"
import { TasksClient } from "@/components/tasks/TasksClient"

export const dynamic = "force-dynamic"

export default async function TasksPage() {
  const tasks = await getTasks()
  return <TasksClient tasks={serialize(tasks)} />
}
