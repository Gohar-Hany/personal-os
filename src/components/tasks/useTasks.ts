"use client"

import { useMemo } from "react"
import { api } from "@/lib/api"
import { useApp, type TaskPatch } from "@/components/app/AppProvider"
import { useToast } from "@/components/ui/toast"
import type { TaskDTO } from "@/types"

/** Server tasks with any optimistic edits/deletes applied. */
export function useLiveTasks(tasks: TaskDTO[]): TaskDTO[] {
  const { taskOverlay } = useApp()
  return useMemo(
    () =>
      tasks
        .map((t) => (taskOverlay[t.id] ? { ...t, ...taskOverlay[t.id].patch } : t))
        .filter((t) => !(t as TaskPatch)._deleted),
    [tasks, taskOverlay],
  )
}

/** One place for every task mutation: optimistic, synced, with errors surfaced. */
export function useTaskActions() {
  const { patchTask, refresh } = useApp()
  const toast = useToast()

  const update = async (task: Pick<TaskDTO, "id">, patch: Partial<TaskDTO>) => {
    const settle = patchTask(task.id, patch)
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: patch })
      settle(true)
      refresh()
    } catch (err) {
      settle(false)
      toast.error((err as Error).message)
    }
  }

  return {
    update,
    toggle: (task: TaskDTO) =>
      update(task, task.status === "Completed"
        ? { status: "Todo", completedAt: null }
        : { status: "Completed", completedAt: new Date().toISOString() }),
    /** dateKey or null to clear. Clearing also clears any time. */
    reschedule: (task: TaskDTO, date: string | null) =>
      update(task, date ? { scheduledDate: date } : { scheduledDate: null, dueDate: null, startTime: null, endTime: null }),
    remove: (task: TaskDTO) => {
      let settle: (ok: boolean) => void = () => {}
      toast.undoable({
        message: `Deleted “${task.title}”`,
        apply: () => {
          settle = patchTask(task.id, { _deleted: true })
        },
        revert: () => settle(false),
        commit: () =>
          api(`/api/tasks/${task.id}`, { method: "DELETE" }).then(() => {
            settle(true)
            refresh()
          }),
      })
    },
  }
}
