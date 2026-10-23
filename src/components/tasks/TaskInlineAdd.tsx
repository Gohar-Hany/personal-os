"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { parseQuickTask } from "@/lib/quickParse"
import { useApp } from "@/components/app/AppProvider"
import { useToast } from "@/components/ui/toast"

/**
 * "Add a task" line that sits at the top of a list. Understands the same
 * shortcuts as Quick Add (tomorrow, 8pm, #project, !high).
 */
export function TaskInlineAdd({
  defaults,
  placeholder = "Add a task",
  className,
}: {
  defaults?: { scheduledDate?: string; projectId?: string; milestoneId?: string }
  placeholder?: string
  className?: string
}) {
  const { projects, refresh } = useApp()
  const toast = useToast()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => parseQuickTask(text, projects), [text, projects])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed.title || busy) return
    setBusy(true)
    try {
      await api("/api/tasks", {
        body: {
          title: parsed.title,
          scheduledDate: parsed.scheduledDate ?? defaults?.scheduledDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          priority: parsed.priority,
          projectId: parsed.projectId ?? defaults?.projectId,
          milestoneId: parsed.projectId && parsed.projectId !== defaults?.projectId ? null : defaults?.milestoneId,
        },
      })
      setText("")
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={cn("group flex items-center gap-3 px-4 py-2", className)}>
      <Plus className="size-[18px] shrink-0 text-primary" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-7 min-w-0 flex-1 bg-transparent text-base sm:text-sm outline-none placeholder:text-muted-foreground"
      />
      {parsed.tokens.length > 0 && (
        <div className="hidden shrink-0 gap-1 sm:flex">
          {parsed.tokens.map((t, i) => (
            <span key={i} className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">
              {t.label}
            </span>
          ))}
        </div>
      )}
      {text.trim() && (
        <button type="submit" disabled={busy} className="shrink-0 cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
          Add
        </button>
      )}
    </form>
  )
}
