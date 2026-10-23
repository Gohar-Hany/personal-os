"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Toast {
  id: number
  message: string
  tone: "success" | "error" | "info"
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  success: (message: string, action?: Toast["action"]) => void
  error: (message: string) => void
  info: (message: string, action?: Toast["action"]) => void
  /**
   * Remove something now, commit after a few seconds unless the user clicks Undo.
   * `apply` hides it immediately, `revert` brings it back, `commit` makes it permanent.
   */
  undoable: (opts: { message: string; apply: () => void; revert: () => void; commit: () => Promise<unknown> }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}

const UNDO_MS = 5000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const pending = useRef(new Map<number, () => Promise<unknown>>())

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (t: Omit<Toast, "id">, ms = 3500) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { ...t, id }])
      setTimeout(() => dismiss(id), ms)
      return id
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(() => ({
    success: (message, action) => push({ message, tone: "success", action }),
    error: (message) => push({ message, tone: "error" }, 5000),
    info: (message, action) => push({ message, tone: "info", action }),
    undoable: ({ message, apply, revert, commit }) => {
      apply()
      const id = nextId.current++
      pending.current.set(id, commit)
      const timer = setTimeout(() => {
        const fn = pending.current.get(id)
        pending.current.delete(id)
        fn?.().catch(() => {
          revert()
          push({ message: "Couldn't delete — restored", tone: "error" })
        })
      }, UNDO_MS)
      setToasts((list) => [
        ...list.slice(-2),
        {
          id,
          message,
          tone: "info",
          action: {
            label: "Undo",
            onClick: () => {
              clearTimeout(timer)
              pending.current.delete(id)
              revert()
            },
          },
        },
      ])
      setTimeout(() => dismiss(id), UNDO_MS)
    },
  }), [push, dismiss])

  // If the tab closes during the undo window, commit what's pending.
  useEffect(() => {
    const flush = () => pending.current.forEach((fn) => void fn())
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-center gap-3 rounded-xl border border-border bg-card py-2.5 pr-2 pl-3.5 text-[13px] shadow-[var(--shadow-pop)]"
          >
            {t.tone === "success" && <CheckCircle2 className="size-4 shrink-0 text-success" />}
            {t.tone === "error" && <AlertCircle className="size-4 shrink-0 text-danger" />}
            <span className="flex-1 text-foreground">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
                className="cursor-pointer rounded-md px-2 py-1 text-[13px] font-semibold text-primary hover:bg-primary-soft"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className={cn("cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
