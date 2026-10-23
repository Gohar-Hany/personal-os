"use client"

import * as Popover from "@radix-ui/react-popover"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/hooks"
import { Dialog } from "@/components/ui/dialog"

/**
 * The shell every dropdown uses: a floating panel on desktop,
 * a bottom sheet with big touch targets on phones.
 */
export function Picker({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  width = "trigger",
  align = "start",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  trigger: React.ReactElement
  /** Heading of the bottom sheet on phones. */
  title: string
  children: React.ReactNode
  width?: "trigger" | number
  align?: "start" | "end" | "center"
}) {
  const mobile = useIsMobile()

  if (mobile) {
    return (
      <>
        <Slot
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onOpenChange(true)
          }}
        >
          {trigger}
        </Slot>
        <Dialog open={open} onOpenChange={onOpenChange} title={title}>
          {children}
        </Dialog>
      </>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          style={width === "trigger" ? undefined : { width }}
          className={cn(
            "z-[60] animate-fade-in rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-pop)] outline-none",
            width === "trigger" && "w-[var(--radix-popover-trigger-width)] min-w-56 max-w-80",
          )}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Field-style trigger button shared by Select, DatePicker and TimePicker. */
export const triggerClass = (size: "sm" | "md" = "md") =>
  cn(
    "group/trigger flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-base text-foreground transition-colors outline-none sm:text-sm",
    "hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15",
    "data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/15",
    "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0",
    size === "sm" ? "h-9 sm:h-8 sm:text-[13px]" : "h-10 sm:h-9",
  )
