"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/hooks"
import { TASK_PRIORITY_META } from "@/lib/constants"

/**
 * One control that both shows status and completes the task:
 * empty ring = to do, half-filled ring = in progress, filled check = done.
 */
export function StatusCheck({
  status,
  onToggle,
  label,
  size = "md",
  className,
}: {
  status: string
  onToggle: () => void
  label: string
  size?: "sm" | "md"
  className?: string
}) {
  const done = status === "Completed"
  const doing = status === "InProgress"
  const box = size === "sm" ? "size-4" : "size-[18px]"
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={done ? "Done — click to reopen" : doing ? "In progress — click to complete" : "Click to complete"}
      onClick={(e) => {
        e.stopPropagation()
        if (!done) haptic()
        onToggle()
      }}
      className={cn("group/check -m-2 flex shrink-0 cursor-pointer items-center justify-center p-2", className)}
    >
      <span
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full border-[1.5px] transition-all",
          box,
          done
            ? "animate-pop border-success bg-success text-white"
            : doing
              ? "border-warning text-transparent group-hover/check:text-warning"
              : "border-border-strong text-transparent group-hover/check:border-success group-hover/check:text-success/70",
        )}
      >
        {doing && <span className="absolute inset-y-0 left-0 w-1/2 bg-warning" />}
        <Check className={cn("relative", size === "sm" ? "size-2.5" : "size-3")} strokeWidth={3.5} />
      </span>
    </button>
  )
}

/** Priority at a glance: 1–3 signal bars, or a red "!" tile for urgent. */
export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const meta = TASK_PRIORITY_META[priority] ?? TASK_PRIORITY_META.Medium
  if (priority === "Critical") {
    return (
      <span
        role="img"
        aria-label="Urgent priority"
        title="Urgent"
        className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-danger text-[10px] leading-none font-black text-white", className)}
      >
        !
      </span>
    )
  }
  const level = priority === "High" ? 3 : priority === "Medium" ? 2 : 1
  return (
    <span role="img" aria-label={`${meta.label} priority`} title={`${meta.label} priority`} className={cn("flex size-4 shrink-0 items-end justify-center gap-[2px] pb-0.5", className)}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full",
            i === 1 ? "h-1.5" : i === 2 ? "h-2.5" : "h-3.5",
            i <= level ? (priority === "High" ? "bg-warning" : "bg-muted-foreground") : "bg-border-strong/60",
          )}
        />
      ))}
    </span>
  )
}
