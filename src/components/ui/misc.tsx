"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/hooks"
import type { Tone } from "@/lib/constants"

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ProgressBar({ value, className, tone }: { value: number; className?: string; tone?: "primary" | "success" }) {
  const v = Math.max(0, Math.min(100, value))
  const color = tone === "success" || v >= 100 ? "bg-success" : "bg-primary"
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${v}%` }} />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className={cn("transition-[stroke-dashoffset] duration-700", v >= 100 ? "stroke-success" : "stroke-primary")}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

/** Round check used for tasks and habits. Large hit area, small visual. */
export function CheckCircle({
  checked,
  onChange,
  label,
  size = "md",
  className,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  size?: "sm" | "md"
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (!checked) haptic()
        onChange()
      }}
      className={cn("group/check -m-1.5 flex shrink-0 cursor-pointer items-center justify-center p-1.5 disabled:cursor-not-allowed", className)}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-[1.5px] transition-all",
          size === "sm" ? "size-4" : "size-[18px]",
          checked
            ? "animate-pop border-success bg-success text-white"
            : "border-border-strong text-transparent group-hover/check:border-success group-hover/check:text-success/60",
        )}
      >
        <Check className={cn(size === "sm" ? "size-2.5" : "size-3")} strokeWidth={3.5} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "sm",
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
  size?: "xs" | "sm"
}) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-all [&_svg]:size-3.5",
            size === "xs" ? "h-6 px-2 text-xs" : "h-7 px-3 text-[13px]",
            value === o.value
              ? "bg-card text-foreground shadow-[var(--shadow-card)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Toggleable filter chip. */
export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5",
        active
          ? "border-primary/40 bg-primary-soft text-primary"
          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-subtle px-1 font-sans text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** Small uppercase label above a list group. */
export function GroupLabel({
  children,
  count,
  tone,
  className,
}: {
  children: React.ReactNode
  count?: number
  tone?: "danger"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase",
        tone === "danger" ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      {children}
      {count !== undefined && <span className="font-medium tabular opacity-70">{count}</span>}
    </div>
  )
}

const PREFIX_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" }

/** A money value with a small, muted currency label — numbers stay readable at large sizes. */
export function Amount({ value, currency, className, signed }: { value: number; currency: string; className?: string; signed?: boolean }) {
  const abs = Math.abs(value)
  const num = abs.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(abs) ? 0 : 2, minimumFractionDigits: Number.isInteger(abs) ? 0 : 2 })
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : ""
  const prefix = PREFIX_SYMBOLS[currency]
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {sign}
      {prefix}
      {num}
      {!prefix && <span className="ml-1 text-[0.55em] font-medium tracking-normal text-muted-foreground">{currency}</span>}
    </span>
  )
}
