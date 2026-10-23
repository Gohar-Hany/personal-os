"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/hooks"
import { Picker, triggerClass } from "@/components/ui/picker"

export interface SelectOption {
  value: string
  label: string
  /** Icon shown before the label (in the list and in the trigger). */
  icon?: React.ReactNode
  /** Small coloured dot instead of an icon — a bg-* class. */
  dot?: string
  /** Muted text on the right, e.g. a balance or a count. */
  hint?: string
}

/**
 * Modern dropdown: searchable when the list is long, keyboard friendly,
 * and a bottom sheet on phones.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  size = "md",
  disabled,
  searchable,
  title,
  icon,
  scrollToValue,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Adds an empty choice ("No project") and is shown when nothing is picked. */
  placeholder?: string
  className?: string
  size?: "sm" | "md"
  disabled?: boolean
  searchable?: boolean
  /** Sheet heading on phones (defaults to the aria-label). */
  title?: string
  /** Icon in the trigger when the chosen option has none. */
  icon?: React.ReactNode
  /** When nothing is selected, open the list scrolled to this value. */
  scrollToValue?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const all = useMemo(() => (placeholder !== undefined ? [{ value: "", label: placeholder }, ...options] : options), [placeholder, options])
  const selected = all.find((o) => o.value === value)
  const empty = !value && placeholder !== undefined

  return (
    <Picker
      open={open}
      onOpenChange={setOpen}
      title={title ?? ariaLabel ?? placeholder ?? "Choose"}
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          data-state={open ? "open" : "closed"}
          className={cn(triggerClass(size), className)}
        >
          {selected?.dot ? (
            <span className={cn("size-2 rounded-full", selected.dot)} />
          ) : (
            (selected?.icon ?? icon) && (
              <span className={cn("text-muted-foreground [&_svg]:size-4", empty && "opacity-70")}>{selected?.icon ?? icon}</span>
            )
          )}
          <span className={cn("flex-1 truncate", empty && "text-muted-foreground")}>{selected?.label ?? placeholder ?? "Select…"}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground transition-colors group-hover/trigger:text-foreground" />
        </button>
      }
    >
      <OptionList
        options={all}
        value={value}
        scrollToValue={scrollToValue}
        searchable={searchable ?? all.length > 8}
        onPick={(v) => {
          onChange(v)
          setOpen(false)
        }}
      />
    </Picker>
  )
}

export function OptionList({
  options,
  value,
  onPick,
  searchable,
  scrollToValue,
}: {
  options: SelectOption[]
  value: string
  onPick: (value: string) => void
  searchable?: boolean
  scrollToValue?: string
}) {
  const mobile = useIsMobile()
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : options
  }, [options, query])
  const [active, setActive] = useState(() => {
    const i = options.findIndex((o) => o.value === (value || scrollToValue))
    return Math.max(0, i)
  })
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(filtered.length - 1, a + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === "Home") {
      setActive(0)
    } else if (e.key === "End") {
      setActive(filtered.length - 1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const o = filtered[active]
      if (o) onPick(o.value)
    }
  }

  return (
    <div onKeyDown={onKeyDown}>
      {searchable && (
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus={!mobile}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Search…"
            aria-label="Search options"
            className="h-10 w-full rounded-lg bg-muted pr-3 pl-8 text-base outline-none placeholder:text-muted-foreground sm:h-8 sm:text-[13px]"
          />
        </div>
      )}
      <div
        ref={listRef}
        role="listbox"
        tabIndex={searchable ? -1 : 0}
        className={cn("overflow-y-auto overscroll-contain outline-none", mobile ? "-mx-1 max-h-[55dvh]" : "max-h-72")}
      >
        {filtered.map((o, i) => {
          const isSelected = o.value === value
          return (
            <div
              key={o.value || "__none"}
              role="option"
              aria-selected={isSelected}
              data-active={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => onPick(o.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 select-none [&_svg]:size-4",
                mobile ? "min-h-12 text-[15px]" : "min-h-8 text-[13px]",
                i === active && "bg-muted",
                !o.value && "text-muted-foreground",
              )}
            >
              {o.dot ? <span className={cn("size-2 shrink-0 rounded-full", o.dot)} /> : o.icon && <span className="shrink-0 text-muted-foreground">{o.icon}</span>}
              <span className={cn("flex-1 truncate", isSelected && "font-medium text-foreground")}>{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-muted-foreground tabular">{o.hint}</span>}
              <Check className={cn("shrink-0 text-primary", !isSelected && "invisible")} />
            </div>
          )
        })}
        {filtered.length === 0 && <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">No matches</p>}
      </div>
    </div>
  )
}
