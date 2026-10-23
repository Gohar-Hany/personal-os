"use client"

import { useMemo, useState } from "react"
import {
  addDays, addMonths, differenceInCalendarDays, format, isSameDay, isSameMonth, nextDay, startOfMonth, startOfWeek,
} from "date-fns"
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Clock, Sofa, Sun, Sunrise, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { dateKey, formatTime12, parseDateKey, todayStart, WEEK_STARTS_ON, weekStartOf } from "@/lib/dates"
import { useIsMobile } from "@/lib/hooks"
import { Picker, triggerClass } from "@/components/ui/picker"
import { Select } from "@/components/ui/select"

/** "Today", "Tomorrow", "Yesterday", "Fri, Oct 24" (+ year if not this year). */
export function friendlyDate(key: string) {
  const d = parseDateKey(key)
  const diff = differenceInCalendarDays(d, todayStart())
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  return format(d, d.getFullYear() === new Date().getFullYear() ? "EEE, MMM d" : "EEE, MMM d, yyyy")
}

type Quick = "today" | "tomorrow" | "weekend" | "nextweek"

/** Date field with quick picks and a calendar. Value is "YYYY-MM-DD" or "". */
export function DatePicker({
  value,
  onChange,
  placeholder = "No date",
  quick = ["today", "tomorrow", "weekend", "nextweek"],
  clearable = true,
  max,
  size = "md",
  className,
  title = "Pick a date",
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string | null) => void
  placeholder?: string
  quick?: Quick[]
  clearable?: boolean
  max?: string
  size?: "sm" | "md"
  className?: string
  title?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const pick = (v: string | null) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <Picker
      open={open}
      onOpenChange={setOpen}
      title={title}
      width={296}
      trigger={
        <button type="button" aria-label={ariaLabel ?? title} data-state={open ? "open" : "closed"} className={cn(triggerClass(size), className)}>
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>{value ? friendlyDate(value) : placeholder}</span>
          {value && clearable && (
            <span
              role="button"
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      }
    >
      <DatePanel value={value} onPick={pick} quick={quick} clearable={clearable} max={max} />
    </Picker>
  )
}

function DatePanel({
  value,
  onPick,
  quick,
  clearable,
  max,
}: {
  value: string
  onPick: (v: string | null) => void
  quick: Quick[]
  clearable: boolean
  max?: string
}) {
  const mobile = useIsMobile()
  const today = todayStart()
  const [month, setMonth] = useState(() => startOfMonth(value ? parseDateKey(value) : today))

  const quickItems = useMemo(() => {
    const all: Record<Quick, { label: string; icon: React.ReactNode; date: Date }> = {
      today: { label: "Today", icon: <Sun />, date: today },
      tomorrow: { label: "Tomorrow", icon: <Sunrise />, date: addDays(today, 1) },
      // Egyptian weekend starts Friday
      weekend: { label: "This weekend", icon: <Sofa />, date: today.getDay() === 5 ? today : nextDay(today, 5) },
      nextweek: { label: "Next week", icon: <CalendarDays />, date: addDays(weekStartOf(today), 7) },
    }
    return quick.map((q) => all[q]).filter((q) => !max || dateKey(q.date) <= max)
  }, [quick, max]) // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const start = startOfWeek(month, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [month])
  const weeks = days[35].getMonth() === month.getMonth() ? 6 : 5

  return (
    <div className="space-y-2">
      {quickItems.length > 0 && (
        <div className="space-y-0.5">
          {quickItems.map((q) => {
            const k = dateKey(q.date)
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => onPick(k)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground",
                  mobile ? "h-12 text-[15px]" : "h-8 text-[13px]",
                  value === k && "bg-primary-soft text-primary [&_svg]:text-primary",
                )}
              >
                {q.icon}
                <span className="flex-1">{q.label}</span>
                <span className="text-xs text-muted-foreground">{format(q.date, "EEE d")}</span>
              </button>
            )
          })}
          <div className="!my-2 h-px bg-border" />
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-semibold">{format(month, "MMMM yyyy")}</span>
        <div className="flex gap-0.5">
          <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month" className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month" className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {days.slice(0, 7).map((d) => <span key={d.getDay()} className="py-1">{format(d, "EEEEEE")}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.slice(0, weeks * 7).map((d) => {
          const k = dateKey(d)
          const selected = value === k
          const isToday = isSameDay(d, today)
          const disabled = !!max && k > max
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onPick(k)}
              aria-label={format(d, "EEEE, MMMM d")}
              aria-pressed={selected}
              className={cn(
                "mx-auto flex cursor-pointer items-center justify-center rounded-full text-[13px] tabular transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                mobile ? "size-11 text-[15px]" : "size-9",
                !isSameMonth(d, month) && "text-muted-foreground/50",
                selected ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted",
                isToday && !selected && "font-semibold text-primary ring-1 ring-primary/40",
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      {clearable && value && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={cn("flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground", mobile ? "h-11 text-[15px]" : "h-8 text-[13px]")}
        >
          <CalendarX2 className="size-4" /> Remove date
        </button>
      )}
    </div>
  )
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const v = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`
  return { value: v, label: formatTime12(v).replace(/(am|pm)$/, " $1").toUpperCase() }
})

/** "HH:MM" picker in 15-minute steps, searchable (type "8:30"). */
export function TimePicker({
  value,
  onChange,
  placeholder = "No time",
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  size?: "sm" | "md"
  "aria-label"?: string
}) {
  // Keep an off-grid saved time (e.g. 20:10) selectable
  const options = TIME_OPTIONS.some((o) => o.value === value) || !value
    ? TIME_OPTIONS
    : [...TIME_OPTIONS, { value, label: formatTime12(value).toUpperCase() }].sort((a, b) => a.value.localeCompare(b.value))
  return (
    <Select
      value={value}
      onChange={(v) => onChange(v || null)}
      options={options}
      placeholder={placeholder}
      icon={<Clock />}
      scrollToValue="09:00"
      className={className}
      size={size}
      aria-label={ariaLabel}
      title={ariaLabel ?? "Pick a time"}
    />
  )
}
