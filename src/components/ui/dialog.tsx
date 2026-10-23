"use client"

import * as RadixDialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Centered dialog on desktop, bottom sheet on mobile.
 * `side="right"` turns it into a full-height side panel on desktop (used for task details).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  side = "center",
  hideTitle,
  initialFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "md" | "lg"
  side?: "center" | "right"
  hideTitle?: boolean
  /** Return false to stop Radix from focusing the first element (e.g. a side panel). */
  initialFocus?: boolean
}) {
  const width = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" }[size]
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Close on overlay *click* (not pointerdown) so the tap doesn't fall through to the page on phones */}
        <RadixDialog.Overlay
          onClick={(e) => {
            e.stopPropagation()
            onOpenChange(false)
          }}
          className="fixed inset-0 z-50 animate-fade-in bg-overlay backdrop-blur-[2px]"
        />
        <RadixDialog.Content
          onOpenAutoFocus={initialFocus === false ? (e) => e.preventDefault() : undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          // Events inside a portal still bubble through React parents (e.g. a clickable row)
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "fixed z-50 flex flex-col border border-border bg-card shadow-[var(--shadow-pop)] outline-none",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 max-h-[92dvh] animate-slide-up rounded-t-2xl pb-safe",
            side === "center"
              ? cn("sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[85dvh] sm:w-full sm:animate-scale-in sm:rounded-2xl sm:pb-0", width)
              : "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[min(520px,100vw)] sm:animate-slide-left sm:rounded-none sm:rounded-l-2xl sm:pb-0",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" />
          <div
            className={cn(
              "flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-2",
              // Hidden title: keep it for screen readers; side panels still show a close button
              hideTitle && (side === "right" ? "justify-end pb-0" : "sr-only"),
            )}
          >
            <div className={cn(hideTitle && "sr-only")}>
              <RadixDialog.Title className="text-base font-semibold text-foreground">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-[13px] text-muted-foreground">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="-mt-1 -mr-2 flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
