"use client"

import { api } from "@/lib/api"
import { useApp } from "@/components/app/AppProvider"
import { useToast } from "@/components/ui/toast"
import type { SubtaskDTO, TaskDTO } from "@/types"

/**
 * Subtask mutations shared by the inline list and the detail panel.
 * Changes are mirrored into the parent's optimistic overlay, so every
 * "2/4" counter on screen updates instantly.
 */
export function useSubtasks(parent: TaskDTO, onLocal?: (subs: SubtaskDTO[]) => void) {
  const { patchTask, refresh } = useApp()
  const toast = useToast()
  const subs = parent.subtasks ?? []

  const apply = (next: SubtaskDTO[]) => {
    onLocal?.(next)
    return patchTask(parent.id, { subtasks: next })
  }
  const run = async (next: SubtaskDTO[], call: () => Promise<unknown>) => {
    const settle = apply(next)
    try {
      await call()
      settle(true)
      refresh()
    } catch (err) {
      settle(false)
      onLocal?.(subs)
      toast.error((err as Error).message)
    }
  }

  return {
    subtasks: subs,
    done: subs.filter((s) => s.status === "Completed").length,
    toggle: (s: SubtaskDTO) => {
      const status = s.status === "Completed" ? "Todo" : "Completed"
      return run(subs.map((x) => (x.id === s.id ? { ...x, status } : x)), () => api(`/api/tasks/${s.id}`, { method: "PATCH", body: { status } }))
    },
    rename: (s: SubtaskDTO, title: string) =>
      run(subs.map((x) => (x.id === s.id ? { ...x, title } : x)), () => api(`/api/tasks/${s.id}`, { method: "PATCH", body: { title } })),
    remove: (s: SubtaskDTO) => run(subs.filter((x) => x.id !== s.id), () => api(`/api/tasks/${s.id}`, { method: "DELETE" })),
    add: async (title: string) => {
      const temp: SubtaskDTO = { id: `temp-${Date.now()}`, title, status: "Todo", order: subs.length }
      const settle = apply([...subs, temp])
      try {
        const created = await api<SubtaskDTO>("/api/tasks", { body: { title, parentId: parent.id } })
        const next = [...subs, created]
        onLocal?.(next)
        patchTask(parent.id, { subtasks: next })(true)
        settle(true)
        refresh()
      } catch (err) {
        settle(false)
        onLocal?.(subs)
        toast.error((err as Error).message)
      }
    },
  }
}
