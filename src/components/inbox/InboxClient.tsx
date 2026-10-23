"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { CheckSquare, ChevronDown, FolderKanban, Inbox, StickyNote, Target, Trash2, Undo2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useSynced } from "@/lib/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { ProjectDialog } from "@/components/projects/ProjectDialog"
import { GoalDialog } from "@/components/goals/GoalDialog"
import type { InboxItemDTO } from "@/types"

const CONVERTED_ICON: Record<string, React.ElementType> = { Task: CheckSquare, Project: FolderKanban, Goal: Target, Note: StickyNote }

export function InboxClient({ items: serverItems }: { items: InboxItemDTO[] }) {
  const { quickAdd, refresh } = useApp()
  const toast = useToast()
  const [items, setItems] = useSynced(serverItems)
  const [text, setText] = useState("")
  const [converting, setConverting] = useState<{ item: InboxItemDTO; to: "Project" | "Goal" } | null>(null)
  const [showDone, setShowDone] = useState(false)

  const pending = items.filter((i) => i.status === "Pending")
  const notes = items.filter((i) => i.status === "Processed" && i.convertedTo === "Note")
  const processed = items.filter((i) => i.status === "Processed" && i.convertedTo !== "Note")

  const patch = async (item: InboxItemDTO, body: Partial<InboxItemDTO>) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...body } : i)))
    try {
      await api(`/api/inbox/${item.id}`, { method: "PATCH", body })
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
      refresh()
    }
  }

  const markConverted = (item: InboxItemDTO, to: string, id?: string) => patch(item, { status: "Processed", convertedTo: to, convertedId: id ?? null })

  const capture = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setText("")
    try {
      const created = await api<InboxItemDTO>("/api/inbox", { body: { content } })
      setItems((list) => [created, ...list])
      refresh()
    } catch (err) {
      setText(content)
      toast.error((err as Error).message)
    }
  }

  const remove = async (item: InboxItemDTO) => {
    setItems((list) => list.filter((i) => i.id !== item.id))
    try {
      await api(`/api/inbox/${item.id}`, { method: "DELETE" })
      refresh()
      toast.success("Note deleted")
    } catch (err) {
      setItems((list) => [item, ...list])
      toast.error((err as Error).message)
    }
  }

  const clearProcessed = async () => {
    const ids = processed.map((i) => i.id)
    setItems((list) => list.filter((i) => !ids.includes(i.id)))
    await Promise.all(ids.map((id) => api(`/api/inbox/${id}`, { method: "PATCH", body: { status: "Archived" } }))).catch((err) => toast.error(err.message))
    refresh()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Inbox" description="Get it out of your head now. Decide what it is later." />

      <form onSubmit={capture}>
        <Card className="flex items-center gap-2 p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type anything and press Enter"
            aria-label="Capture a note"
            className="h-10 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" variant="primary" disabled={!text.trim()}>Capture</Button>
        </Card>
      </form>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          To process <span className="font-normal tabular">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <Card>
            <EmptyState icon={<Inbox />} title="Inbox zero" description="Everything captured has been sorted. Nice." />
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {pending.map((item) => (
              <PendingItem
                key={item.id}
                item={item}
                onEdit={(content) => patch(item, { content })}
                onTask={() =>
                  quickAdd({ mode: "task", text: item.content, onCreated: (task) => markConverted(item, "Task", task.id) })
                }
                onProject={() => setConverting({ item, to: "Project" })}
                onGoal={() => setConverting({ item, to: "Goal" })}
                onNote={() => markConverted(item, "Note")}
                onDelete={() => remove(item)}
              />
            ))}
          </Card>
        )}
      </section>

      {notes.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            Notes <span className="font-normal tabular">{notes.length}</span>
          </h2>
          <Card className="divide-y divide-border">
            {notes.map((item) => (
              <div key={item.id} className="group flex items-start gap-3 px-4 py-3">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">{item.content}</p>
                <Menu
                  className="lg:opacity-0 lg:group-hover:opacity-100"
                  items={[
                    { label: "Back to inbox", icon: <Undo2 />, onSelect: () => patch(item, { status: "Pending", convertedTo: null }) },
                    { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => remove(item) },
                  ]}
                />
              </div>
            ))}
          </Card>
        </section>
      )}

      {processed.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("size-4 transition-transform", !showDone && "-rotate-90")} />
              Processed <span className="font-normal tabular">{processed.length}</span>
            </button>
            <Button size="xs" variant="ghost" onClick={clearProcessed}>Clear</Button>
          </div>
          {showDone && (
            <Card className="divide-y divide-border">
              {processed.map((item) => {
                const Icon = CONVERTED_ICON[item.convertedTo ?? ""] ?? CheckSquare
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-muted-foreground">
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.content}</span>
                    <span className="shrink-0 text-xs">→ {item.convertedTo ?? "Done"}</span>
                  </div>
                )
              })}
            </Card>
          )}
        </section>
      )}

      <ProjectDialog
        open={converting?.to === "Project"}
        onOpenChange={(o) => !o && setConverting(null)}
        project={converting ? { name: converting.item.content } : null}
        onSaved={(p) => converting && markConverted(converting.item, "Project", p.id)}
      />
      <GoalDialog
        open={converting?.to === "Goal"}
        onOpenChange={(o) => !o && setConverting(null)}
        goal={converting ? { name: converting.item.content } : null}
        onSaved={(g) => converting && markConverted(converting.item, "Goal", g.id)}
      />
    </div>
  )
}

function PendingItem({
  item,
  onEdit,
  onTask,
  onProject,
  onGoal,
  onNote,
  onDelete,
}: {
  item: InboxItemDTO
  onEdit: (content: string) => void
  onTask: () => void
  onProject: () => void
  onGoal: () => void
  onNote: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.content)

  const save = () => {
    setEditing(false)
    const v = value.trim()
    if (v && v !== item.content) onEdit(v)
    else setValue(item.content)
  }

  return (
    <div className="group px-4 py-3">
      {editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === "Escape") {
              setValue(item.content)
              setEditing(false)
            }
          }}
          rows={2}
          className="field-sizing-content w-full resize-none rounded-md bg-muted px-2 py-1 text-base sm:text-sm outline-none"
        />
      ) : (
        <p onClick={() => setEditing(true)} className="cursor-text text-sm whitespace-pre-wrap" title="Click to edit">
          {item.content}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
        <Button size="xs" variant="outline" onClick={onTask}><CheckSquare /> Task</Button>
        <Button size="xs" variant="ghost" onClick={onProject} className="hidden sm:inline-flex"><FolderKanban /> Project</Button>
        <Button size="xs" variant="ghost" onClick={onGoal} className="hidden sm:inline-flex"><Target /> Goal</Button>
        <Button size="xs" variant="ghost" onClick={onNote} className="hidden sm:inline-flex"><StickyNote /> Keep</Button>
        <Menu
          items={[
            { label: "Make a project", icon: <FolderKanban />, onSelect: onProject },
            { label: "Make a goal", icon: <Target />, onSelect: onGoal },
            { label: "Keep as note", icon: <StickyNote />, onSelect: onNote },
            { separator: true },
            { label: "Delete", icon: <Trash2 />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  )
}
