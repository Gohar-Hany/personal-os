"use client"

import * as RadixDialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Full-screen reading surface for the Quran and adhkar: edge-to-edge on phones,
 * a large calm sheet on desktop. A real dialog — Esc closes it, focus stays inside.
 */
export function ReaderShell({
  open,
  onClose,
  title,
  subtitle,
  actions,
  progress,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  /** 0–100, drawn as a thin bar under the header. */
  progress?: number
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "md" | "lg"
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-overlay backdrop-blur-sm" />
        <RadixDialog.Content
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "fixed inset-0 z-50 flex animate-fade-in flex-col bg-background outline-none",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(92dvh,900px)] sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-scale-in sm:overflow-hidden sm:rounded-3xl sm:border sm:border-border sm:shadow-[var(--shadow-pop)]",
            size === "lg" ? "sm:max-w-6xl" : "sm:max-w-2xl",
          )}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur sm:px-6 sm:pt-3.5">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="truncate font-arabic text-xl leading-tight font-bold">{title}</RadixDialog.Title>
              <RadixDialog.Description asChild>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle ?? title}</div>
              </RadixDialog.Description>
            </div>
            {actions}
            <RadixDialog.Close
              aria-label="إغلاق"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </RadixDialog.Close>
          </header>
          {progress !== undefined && (
            <div className="h-1 shrink-0 bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gradient-to-l from-primary to-success transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="relative min-h-0 flex-1">{children}</div>
          {footer && (
            <footer className="shrink-0 border-t border-border bg-card/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
              {footer}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
