import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Tone } from "@/lib/constants"

const TILE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
}

/** Small coloured square holding an icon — gives each section its own identity. */
export function IconTile({ tone = "primary", size = "sm", children, className }: { tone?: Tone; size?: "sm" | "md"; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" ? "size-7 rounded-lg [&_svg]:size-4" : "size-10 rounded-xl [&_svg]:size-5",
        TILE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  )
}

/** Section title row inside a card: title on the left, optional link/action on the right. */
export function CardHeader({
  title,
  icon,
  tone = "primary",
  meta,
  href,
  hrefLabel = "View all",
  action,
  className,
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  tone?: Tone
  meta?: React.ReactNode
  href?: string
  hrefLabel?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 pt-4 pb-2.5", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <IconTile tone={tone}>{icon}</IconTile>}
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {meta && <span className="text-xs text-muted-foreground tabular">{meta}</span>}
      </div>
      {action}
      {href && !action && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {hrefLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}
