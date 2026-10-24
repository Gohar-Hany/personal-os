"use client"

import { useMemo, useState } from "react"
import { Check, Plus, Tag, X } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { labelDot, parseTags } from "@/lib/tasks/taskLogic"
import { Picker, triggerClass } from "@/components/ui/picker"
import type { TaskDTO } from "@/types"

/** A label as a quiet pill: colour dot + name. */
export function LabelChip({ label, onRemove, className }: { label: string; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-xs leading-none whitespace-nowrap text-foreground/80", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", labelDot(label))} />
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${label}`}
          className="-mr-0.5 cursor-pointer rounded-sm opacity-60 hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

/** Labels inside a list row: just a dot and the name, the first few then "+2". */
export function LabelList({ labels, max = 2, className }: { labels: string[]; max?: number; className?: string }) {
  if (!labels.length) return null
  const shown = labels.slice(0, max)
  const rest = labels.length - shown.length
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", className)} title={labels.join(", ")}>
      {shown.map((l) => (
        <span key={l} className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 font-medium whitespace-nowrap text-foreground/80">
          <span className={cn("size-1.5 rounded-full", labelDot(l))} />
          {l}
        </span>
      ))}
      {rest > 0 && <span className="shrink-0 px-0.5 font-medium text-muted-foreground tabular">+{rest}</span>}
    </span>
  )
}

/** Every label in use, most used first. */
export function collectLabels(tasks: Pick<TaskDTO, "tags">[]) {
  const count = new Map<string, number>()
  for (const t of tasks) for (const l of parseTags(t.tags)) count.set(l, (count.get(l) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l)
}

// Labels used anywhere, for suggestions in the editor. Loaded once per page view.
let known: Promise<string[]> | null = null
function knownLabels() {
  known ??= api<TaskDTO[]>("/api/tasks").then(collectLabels).catch(() => [])
  return known
}
function forgetKnownLabels() {
  known = null
}

/** Pick existing labels or type a new one. */
export function LabelEditor({ value, onChange }: { value: string[]; onChange: (labels: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])

  const has = (l: string) => value.some((v) => v.toLowerCase() === l.toLowerCase())
  const toggle = (l: string) => {
    forgetKnownLabels() // a new label should show up as a suggestion next time
    onChange(has(l) ? value.filter((v) => v.toLowerCase() !== l.toLowerCase()) : [...value, l])
  }
  const q = query.trim()
  const options = useMemo(() => {
    const all = [...new Set([...value, ...suggestions])]
    return q ? all.filter((l) => l.toLowerCase().includes(q.toLowerCase())) : all
  }, [value, suggestions, q])
  const canCreate = q && !options.some((l) => l.toLowerCase() === q.toLowerCase())

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((l) => (
        <LabelChip key={l} label={l} onRemove={() => toggle(l)} />
      ))}
      <Picker
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          setQuery("")
          if (o) knownLabels().then(setSuggestions)
        }}
        title="Labels"
        width={240}
        trigger={
          <button type="button" className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="size-3.5" /> {value.length ? "" : "Add label"}
          </button>
        }
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q) {
              e.preventDefault()
              const match = options.find((l) => l.toLowerCase() === q.toLowerCase())
              toggle(match ?? q)
              setQuery("")
            }
          }}
          placeholder="Find or create a label"
          className="mb-1 h-10 w-full rounded-lg border border-border bg-subtle px-3 text-base outline-none focus:border-ring sm:h-8 sm:text-[13px]"
        />
        <div className="max-h-64 overflow-y-auto">
          {options.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggle(l)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted sm:py-1.5 sm:text-[13px]"
            >
              <span className={cn("flex size-4 items-center justify-center rounded border", has(l) ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                {has(l) && <Check className="size-3" strokeWidth={3} />}
              </span>
              <LabelChip label={l} />
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                toggle(q)
                setQuery("")
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted sm:py-1.5 sm:text-[13px]"
            >
              <Plus className="size-4 text-muted-foreground" /> Create <LabelChip label={q} />
            </button>
          )}
          {!options.length && !canCreate && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Type to create a label</p>}
        </div>
      </Picker>
    </div>
  )
}

/** Toolbar filter: show tasks having any of the chosen labels. */
export function LabelFilter({ labels, value, onChange, className }: { labels: string[]; value: string[]; onChange: (v: string[]) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const toggle = (l: string) => onChange(value.includes(l) ? value.filter((v) => v !== l) : [...value, l])
  return (
    <Picker
      open={open}
      onOpenChange={setOpen}
      title="Filter by label"
      width={240}
      align="end"
      trigger={
        <button type="button" aria-label="Filter by label" data-state={open ? "open" : "closed"} className={cn(triggerClass("md"), className)}>
          <Tag className="size-4 text-muted-foreground" />
          <span className={cn("min-w-0 flex-1 truncate", !value.length && "text-muted-foreground")}>
            {value.length ? (value.length === 1 ? value[0] : `${value.length} labels`) : "Labels"}
          </span>
        </button>
      }
    >
      <div className="max-h-72 overflow-y-auto">
        {labels.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => toggle(l)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted sm:py-1.5 sm:text-[13px]"
          >
            <span className={cn("flex size-4 items-center justify-center rounded border", value.includes(l) ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
              {value.includes(l) && <Check className="size-3" strokeWidth={3} />}
            </span>
            <LabelChip label={l} />
          </button>
        ))}
        {!labels.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No labels yet — add them from a task.</p>}
      </div>
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="mt-1 w-full cursor-pointer rounded-lg border-t border-border px-2 pt-2 pb-1 text-left text-xs text-muted-foreground hover:text-foreground">
          Clear labels
        </button>
      )}
    </Picker>
  )
}
