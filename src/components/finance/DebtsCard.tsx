"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ArrowDownLeft, ArrowUpRight, Check, HandCoins, Plus, RotateCcw, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { EXPENSE_CATEGORIES } from "@/lib/constants"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/datepicker"
import { Amount, Segmented } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"
import { useApp, useClock } from "@/components/app/AppProvider"
import { keyOf } from "@/lib/tasks/taskLogic"
import { BankLogo } from "@/components/finance/BankLogo"
import type { AccountDTO, DebtDTO, DebtsOverviewDTO } from "@/types"

type Dir = "they_owe" | "i_owe"

const accountLabel = (a: AccountDTO) => (a.type === "Cash" ? "Cash in hand" : a.name)
const accountOptions = (accounts: AccountDTO[]) =>
  accounts.map((a) => ({ value: a.id, label: accountLabel(a), icon: <BankLogo name={a.name} type={a.type} size="sm" className="size-5 rounded-md [&_svg]:size-3" />, hint: formatCurrency(a.currentBalance, a.currency, { compact: true }) }))

/**
 * Money owed either way, as one more card among the accounts.
 * Tap it to see who owes what and mark things as paid.
 */
export function DebtsCard({ debts, accounts }: { debts: DebtsOverviewDTO | null; accounts: AccountDTO[] }) {
  const { settings } = useApp()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<Dir | null>(null)
  if (!debts) return null
  const cur = settings.currency
  const any = debts.open.length > 0

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => (any ? setOpen(true) : setAdding("they_owe"))}
        onKeyDown={(e) => e.key === "Enter" && (any ? setOpen(true) : setAdding("they_owe"))}
        className={cn("group flex w-44 shrink-0 cursor-pointer snap-start flex-col gap-4 p-4 transition-colors hover:border-primary/40 sm:w-auto", !any && "border-dashed")}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-sm [&_svg]:size-5">
          <HandCoins />
        </span>
        {any ? (
          <div className="min-w-0 space-y-1">
            <p className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-muted-foreground">Owed to you</span>
              <span className="font-semibold text-success tabular">{formatCurrency(debts.owedToMe, cur, { compact: true })}</span>
            </p>
            <p className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-muted-foreground">You owe</span>
              <span className={cn("font-semibold tabular", debts.iOwe > 0 ? "text-danger" : "text-muted-foreground")}>{formatCurrency(debts.iOwe, cur, { compact: true })}</span>
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">Debts</p>
            <p className="flex items-center gap-1 text-sm font-medium text-primary"><Plus className="size-4" /> Track who owes what</p>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen} title="Debts" size="sm">
        <DebtsList debts={debts} accounts={accounts} onAdd={setAdding} />
      </Dialog>
      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title="Add a debt" size="sm">
        {adding && <DebtForm initialDir={adding} accounts={accounts} onClose={() => setAdding(null)} />}
      </Dialog>
    </>
  )
}

function DebtsList({ debts, accounts, onAdd }: { debts: DebtsOverviewDTO; accounts: AccountDTO[]; onAdd: (d: Dir) => void }) {
  const { settings, refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Dir>(debts.owedToMe > 0 || !debts.iOwe ? "they_owe" : "i_owe")
  const [settling, setSettling] = useState<DebtDTO | null>(null)
  const cur = settings.currency
  const list = debts.open.filter((d) => d.direction === tab)
  const done = debts.recent.filter((d) => d.direction === tab)

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast.success(msg)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }
  const remove = async (d: DebtDTO) => {
    const ok = await confirm({
      title: `Delete this debt?`,
      message: "Any money it moved in your accounts is undone too.",
      confirmLabel: "Delete",
      danger: true,
    })
    if (ok) act(() => api(`/api/debts/${d.id}`, { method: "DELETE" }), "Deleted")
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {(["they_owe", "i_owe"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setTab(d)}
            aria-pressed={tab === d}
            className={cn("cursor-pointer rounded-2xl border p-3.5 text-left transition-colors", tab === d ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border hover:border-border-strong")}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {d === "they_owe" ? <ArrowDownLeft className="size-3.5 text-success" /> : <ArrowUpRight className="size-3.5 text-danger" />}
              {d === "they_owe" ? "Owed to you" : "You owe"}
            </span>
            <span className={cn("mt-1 block text-xl font-semibold tracking-tight", d === "they_owe" ? "text-success" : debts.iOwe > 0 ? "text-danger" : "")}>
              <Amount value={d === "they_owe" ? debts.owedToMe : debts.iOwe} currency={cur} />
            </span>
          </button>
        ))}
      </div>

      <div className="-mx-2 space-y-0.5">
        {list.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">{tab === "they_owe" ? "Nobody owes you anything right now." : "You don't owe anyone. 🎉"}</p>}
        {list.map((d) => (
          <div key={d.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">{d.person.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.person}</p>
              <p className="truncate text-xs text-muted-foreground">{[d.description || d.category, format(new Date(d.date), "MMM d")].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular"><Amount value={d.amount} currency={d.currency || cur} /></span>
            <Button size="xs" variant="outline" onClick={() => setSettling(d)} className="shrink-0">
              <Check /> {d.direction === "they_owe" ? "Got it" : "Paid"}
            </Button>
            <Menu label={d.person} items={[{ label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => remove(d) }]} />
          </div>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={() => onAdd(tab)}>
        <Plus /> {tab === "they_owe" ? "Someone owes me" : "I owe someone"}
      </Button>

      {done.length > 0 && (
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Recently settled</p>
          {done.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Check className="size-3.5 text-success" />
              <span className="min-w-0 flex-1 truncate">
                {d.person} · {d.description || d.category || ""} · {formatCurrency(d.amount, d.currency || cur)}
              </span>
              <button type="button" onClick={() => act(() => api(`/api/debts/${d.id}`, { method: "PATCH", body: { reopen: true } }), "Reopened")} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs hover:bg-muted hover:text-foreground">
                <RotateCcw className="size-3" /> Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!settling} onOpenChange={(o) => !o && setSettling(null)} title={settling?.direction === "they_owe" ? "Got paid back" : "Paid"} size="sm">
        {settling && <SettleForm debt={settling} accounts={accounts} onClose={() => setSettling(null)} />}
      </Dialog>
    </div>
  )
}

/** Where the money went (or came from) when a debt is settled. */
function SettleForm({ debt, accounts, onClose }: { debt: DebtDTO; accounts: AccountDTO[]; onClose: () => void }) {
  const { refresh } = useApp()
  const toast = useToast()
  const clock = useClock()
  const back = debt.direction === "they_owe"
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type === "Cash")?.id ?? accounts[0]?.id ?? "")
  const [date, setDate] = useState(clock.today)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api(`/api/debts/${debt.id}`, { method: "PATCH", body: { settle: { accountId: accountId || null, date } } })
      toast.success(back ? `${debt.person} paid you back` : `Paid ${debt.person}`)
      refresh()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        {debt.person} · {debt.description || debt.category || "money"} · <span className="font-semibold text-foreground">{formatCurrency(debt.amount, debt.currency)}</span>
      </p>
      <Field label={back ? "Money went into" : "Paid from"} hint={back ? undefined : "Recorded as your expense" + (debt.category ? ` (${debt.category})` : "")}>
        <Select value={accountId} onChange={setAccountId} placeholder="Don't record in an account" aria-label="Account" options={accountOptions(accounts)} />
      </Field>
      <Field label="On">
        <DatePicker value={date} onChange={(v) => setDate(v ?? clock.today)} clearable={false} quick={["today"]} max={clock.today} title="Date" />
      </Field>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{back ? "Got paid back" : "Mark as paid"}</Button>
      </div>
    </form>
  )
}

function DebtForm({ initialDir, accounts, onClose }: { initialDir: Dir; accounts: AccountDTO[]; onClose: () => void }) {
  const { refresh, settings } = useApp()
  const toast = useToast()
  const clock = useClock()
  const [direction, setDirection] = useState<Dir>(initialDir)
  const [person, setPerson] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [date, setDate] = useState(clock.today)
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type === "Cash")?.id ?? "")
  const [saving, setSaving] = useState(false)
  const valid = person.trim() && Number(amount) > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await api("/api/debts", {
        body: { direction, person, amount, description: description || null, category: category || null, date, accountId: direction === "they_owe" ? accountId || null : null },
      })
      toast.success(direction === "they_owe" ? `${person.trim()} owes you ${formatCurrency(Number(amount), settings.currency)}` : `You owe ${person.trim()} ${formatCurrency(Number(amount), settings.currency)}`)
      refresh()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented
        className="w-full"
        value={direction}
        onChange={setDirection}
        options={[
          { value: "they_owe", label: <><ArrowDownLeft /> Someone owes me</> },
          { value: "i_owe", label: <><ArrowUpRight /> I owe someone</> },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Who">
          <Input autoFocus value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ahmed" />
        </Field>
        <Field label={`Amount (${settings.currency})`}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="100" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="For what">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={setCategory} placeholder="None" aria-label="Category" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Field>
      </div>
      <div className={cn("grid gap-3", direction === "they_owe" ? "grid-cols-2" : "grid-cols-1")}>
        {direction === "they_owe" && (
          <Field label="I paid from">
            <Select value={accountId} onChange={setAccountId} placeholder="Not from an account" aria-label="Paid from" options={accountOptions(accounts)} />
          </Field>
        )}
        <Field label="Date">
          <DatePicker value={keyOf(date, clock) ?? clock.today} onChange={(v) => setDate(v ?? clock.today)} clearable={false} quick={["today"]} max={clock.today} title="Date" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        {direction === "they_owe"
          ? "The money leaves that account now and comes back when they pay — it isn't counted as your spending."
          : "Nothing leaves your accounts until you mark it as paid; then it's your expense."}
      </p>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!valid || saving}>Add</Button>
      </div>
    </form>
  )
}
