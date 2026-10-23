"use client"

import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { useApp } from "@/components/app/AppProvider"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"

/** Status changes, focus and delete for projects — with feedback. */
export function useProjectActions(onLocalChange?: (id: string, patch: Record<string, unknown> | null) => void) {
  const { refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const router = useRouter()

  const update = async (id: string, patch: Record<string, unknown>, message?: string) => {
    onLocalChange?.(id, patch)
    try {
      await api(`/api/projects/${id}`, { method: "PATCH", body: patch })
      if (message) toast.success(message)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
      refresh()
    }
  }

  return {
    update,
    setFocus: (id: string, on: boolean) => update(id, { isFocus: on }, on ? "Set as your focus project" : "Focus removed"),
    setStatus: (id: string, status: string) => update(id, { status }, `Moved to ${status}`),
    remove: async (project: { id: string; name: string; taskCount?: number }, redirect?: boolean) => {
      const ok = await confirm({
        title: `Delete “${project.name}”?`,
        message: `This permanently deletes the project, its milestones${project.taskCount ? ` and ${project.taskCount} tasks` : " and tasks"}. To keep the history, archive it instead.`,
        confirmLabel: "Delete project",
        danger: true,
      })
      if (!ok) return
      onLocalChange?.(project.id, null)
      try {
        await api(`/api/projects/${project.id}`, { method: "DELETE" })
        toast.success("Project deleted")
        if (redirect) router.push("/projects")
        refresh()
      } catch (err) {
        toast.error((err as Error).message)
        refresh()
      }
    },
  }
}
