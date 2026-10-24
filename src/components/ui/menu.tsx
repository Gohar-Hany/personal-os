"use client"

import { useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Slot } from "@radix-ui/react-slot"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/hooks"
import { Dialog } from "@/components/ui/dialog"

export type MenuItem =
  | { label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean; hint?: string }
  | { separator: true }
  | { heading: string }

/** A "…" (or custom) trigger that opens a list of actions. */
export function Menu({
  items,
  trigger,
  label = "More actions",
  align = "end",
  className,
  open: openProp,
  onOpenChange,
  sheetOnly,
}: {
  items: MenuItem[]
  trigger?: React.ReactNode
  label?: string
  align?: "start" | "end"
  className?: string
  /** Controlled open state (e.g. opened by a long-press). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Phones: render only the action sheet, no visible trigger. */
  sheetOnly?: boolean
}) {
  const mobile = useIsMobile()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (o: boolean) => {
    setOpenState(o)
    onOpenChange?.(o)
  }
  const triggerEl = trigger ?? (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground sm:size-7 sm:rounded-md",
        className,
      )}
    >
      <MoreHorizontal className="size-4" />
    </button>
  )

  // Phones: an action sheet with big, thumb-friendly rows
  if (mobile) {
    return (
      <>
        {!sheetOnly && <Slot
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          {triggerEl}
        </Slot>}
        <Dialog open={open} onOpenChange={setOpen} title={label}>
          <div className="-mx-2 space-y-0.5">
            {items.map((item, i) => {
              if ("separator" in item) return <div key={i} className="mx-2 my-1.5 h-px bg-border" />
              if ("heading" in item)
                return (
                  <p key={i} className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    {item.heading}
                  </p>
                )
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={cn(
                    "flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[15px] active:bg-muted [&_svg]:size-5",
                    item.danger ? "text-danger" : "text-foreground",
                  )}
                >
                  {item.icon && <span className={cn(!item.danger && "text-muted-foreground")}>{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <span className="text-sm text-muted-foreground">{item.hint}</span>}
                </button>
              )
            })}
          </div>
        </Dialog>
      </>
    )
  }

  if (sheetOnly) return null

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{triggerEl}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-[60] min-w-48 animate-fade-in rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-pop)]"
        >
          {items.map((item, i) => {
            if ("separator" in item) return <DropdownMenu.Separator key={i} className="my-1 h-px bg-border" />
            if ("heading" in item)
              return (
                <DropdownMenu.Label key={i} className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground">
                  {item.heading}
                </DropdownMenu.Label>
              )
            return (
              <DropdownMenu.Item
                key={i}
                onSelect={item.onSelect}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] outline-none select-none [&_svg]:size-4",
                  item.danger
                    ? "text-danger data-[highlighted]:bg-danger-soft"
                    : "text-foreground data-[highlighted]:bg-muted",
                )}
              >
                {item.icon && <span className={cn(!item.danger && "text-muted-foreground")}>{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
