"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ToastProvider } from "@/components/ui/toast"
import { ConfirmProvider } from "@/components/ui/confirm"
import { QuickAdd, type QuickAddMode, type QuickAddRequest } from "@/components/app/QuickAdd"
import { TaskSheet } from "@/components/tasks/TaskSheet"
import type { ProjectLite, TaskDTO } from "@/types"

export interface AppSettings {
  name: string
  currency: string
  charityPct: number
}

/** An optimistic change to a task, shown everywhere until fresh server data arrives. */
export type TaskPatch = Partial<TaskDTO> & { _deleted?: boolean }
interface OverlayEntry {
  patch: TaskPatch
  seq: number
  /** Still waiting for the API — never cleared by a refresh. */
  pending: boolean
}

interface AppContextValue {
  projects: ProjectLite[]
  settings: AppSettings
  inboxCount: number
  /** Open the global quick-add (Ctrl+K). */
  quickAdd: (req?: QuickAddRequest) => void
  /** Open the task detail panel. */
  openTask: (id: string) => void
  /** Re-fetch server data for the current page (debounced so rapid clicks don't flicker). */
  refresh: () => void
  taskOverlay: Record<string, OverlayEntry>
  /** Apply an optimistic patch; returns a settle(ok) callback for when the API answers. */
  patchTask: (id: string, patch: TaskPatch) => (ok: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>")
  return ctx
}

function defaultModeFor(pathname: string): QuickAddMode {
  if (pathname.startsWith("/finance")) return "money"
  if (pathname.startsWith("/inbox")) return "note"
  return "task"
}

export function AppProvider({
  projects,
  settings,
  inboxCount,
  children,
}: {
  projects: ProjectLite[]
  settings: AppSettings
  inboxCount: number
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [quickReq, setQuickReq] = useState<QuickAddRequest | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)

  // ─── Optimistic task overlay ───
  const [overlay, setOverlay] = useState<Record<string, OverlayEntry>>({})
  const seq = useRef(0)
  const refreshedUpTo = useRef(0)
  const [refreshing, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      refreshedUpTo.current = seq.current
      startTransition(() => router.refresh())
    }, 300)
  }, [router])

  // Once fresh server data has landed, drop the settled patches it already reflects.
  useEffect(() => {
    if (refreshing) return
    setOverlay((o) => {
      const next = Object.fromEntries(Object.entries(o).filter(([, e]) => e.pending || e.seq > refreshedUpTo.current))
      return Object.keys(next).length === Object.keys(o).length ? o : next
    })
  }, [refreshing])

  const patchTask = useCallback((id: string, patch: TaskPatch) => {
    const before = { current: undefined as OverlayEntry | undefined }
    setOverlay((o) => {
      before.current = o[id]
      return { ...o, [id]: { patch: { ...o[id]?.patch, ...patch }, seq: ++seq.current, pending: true } }
    })
    return (ok: boolean) =>
      setOverlay((o) => {
        if (!ok) {
          const rest = { ...o }
          delete rest[id]
          return before.current ? { ...rest, [id]: before.current } : rest
        }
        return o[id] ? { ...o, [id]: { ...o[id], pending: false, seq: ++seq.current } } : o
      })
  }, [])

  const quickAdd = useCallback(
    (req?: QuickAddRequest) => setQuickReq({ mode: defaultModeFor(pathname), ...req }),
    [pathname],
  )

  // Keyboard: Ctrl/⌘+K anywhere, or "n" when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        quickAdd()
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        if (document.querySelector("[role=dialog]")) return
        e.preventDefault()
        quickAdd()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [quickAdd])

  const value = useMemo<AppContextValue>(
    () => ({ projects, settings, inboxCount, quickAdd, openTask: setTaskId, refresh, taskOverlay: overlay, patchTask }),
    [projects, settings, inboxCount, quickAdd, refresh, overlay, patchTask],
  )

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppContext.Provider value={value}>
          {children}
          <QuickAdd request={quickReq} onClose={() => setQuickReq(null)} />
          <TaskSheet taskId={taskId} onClose={() => setTaskId(null)} />
        </AppContext.Provider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
