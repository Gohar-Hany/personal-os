"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowDown, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Briefcase, Car, Coffee, Gift, HeartHandshake, HeartPulse, Laptop,
  MoreHorizontal, Receipt, ShoppingBag, ShoppingCart, Ticket, TrendingUp, User, Users, UtensilsCrossed,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { dateKey } from "@/lib/dates"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/datepicker"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { BankLogo } from "@/components/finance/BankLogo"
import type { AccountDTO, TransactionDTO } from "@/types"

type TxType = "Expense" | "Income" | "Charity" | "Transfer"

const TYPES: { value: TxType; label: string; icon: React.ReactNode; active: string }[] = [
  { value: "Expense", label: "Expense", icon: <ArrowUpRight />, active: "bg-danger-soft text-danger" },
  { value: "Income", label: "Income", icon: <ArrowDownLeft />, active: "bg-success-soft text-success" },
  { value: "Charity", label: "Charity", icon: <HeartHandshake />, active: "bg-primary-soft text-primary" },
  { value: "Transfer", label: "Transfer", icon: <ArrowLeftRight />, active: "bg-info-soft text-info" },
]

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Food: <UtensilsCrossed />, Cafe: <Coffee />, Supermarket: <ShoppingCart />, Groceries: <ShoppingCart />, Transport: <Car />, Bills: <Receipt />, Shopping: <ShoppingBag />, Health: <HeartPulse />,
  Entertainment: <Ticket />, Tech: <Laptop />, Family: <Users />, Personal: <User />, Other: <MoreHorizontal />,
  Salary: <Briefcase />, Freelance: <Laptop />, Gift: <Gift />, Investment: <TrendingUp />, Charity: <HeartHandshake />,
}

const isCash = (a: AccountDTO) => a.type === "Cash"

/** Create or edit a transaction. Fetches accounts itself unless given. */
export function TransactionForm({
  initial,
  accounts: givenAccounts,
  onSaved,
  autoFocus = true,
}: {
  initial?: TransactionDTO | null
  accounts?: AccountDTO[]
  onSaved: (tx?: TransactionDTO) => void
  autoFocus?: boolean
}) {
  const { settings, refresh } = useApp()
  const toast = useToast()
  const [accounts, setAccounts] = useState<AccountDTO[]>(givenAccounts ?? [])
  const [type, setType] = useState<TxType>((initial?.type as TxType) ?? "Expense")
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
  const [category, setCategory] = useState(initial?.category ?? "")
  // Empty means "use the smart default", resolved below once accounts are known
  const [accountChoice, setAccountId] = useState(initial?.accountId ?? "")
  const [fromChoice, setFromId] = useState(initial?.fromAccountId ?? "")
  const [toChoice, setToId] = useState(initial?.toAccountId ?? "")
  const [date, setDate] = useState(initial ? dateKey(new Date(initial.date)) : dateKey())
  const [note, setNote] = useState(initial?.description ?? "")
  const [saving, setSaving] = useState(false)
  // Who paid: just me · me, and they'll pay me back · they paid, and I owe them
  const [who, setWho] = useState<"me" | "they_owe" | "i_owe">("me")
  const [person, setPerson] = useState("")
  const owed = !initial && type === "Expense" && who !== "me"
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (givenAccounts) return
    api<AccountDTO[]>("/api/finance/accounts").then(setAccounts).catch(() => {})
  }, [givenAccounts])

  useEffect(() => {
    if (autoFocus) setTimeout(() => amountRef.current?.focus(), 30)
  }, [autoFocus])

  // Everyday spending usually comes out of your pocket; income usually lands in a bank.
  const cash = accounts.find(isCash)
  const firstBank = accounts.find((a) => !isCash(a))
  const defaultAccount = (type === "Income" ? firstBank ?? cash : cash ?? firstBank)?.id ?? ""
  const accountId = accountChoice || defaultAccount
  const fromId = fromChoice || firstBank?.id || accounts[0]?.id || ""
  const toId = toChoice || (cash && cash.id !== fromId ? cash.id : accounts.find((a) => a.id !== fromId)?.id) || ""

  const categories = type === "Income" ? INCOME_CATEGORIES : type === "Expense" ? EXPENSE_CATEGORIES : []
  const value = Number(amount)
  const valid = value > 0 && (type !== "Transfer" || (fromId && toId && fromId !== toId)) && (!owed || person.trim() !== "")
  const typeMeta = TYPES.find((t) => t.value === type)!

  // Live calculation of balance before & after
  const selectedAccount = accounts.find((a) => a.id === accountId)
  const fromAcc = accounts.find((a) => a.id === fromId)
  const toAcc = accounts.find((a) => a.id === toId)

  let balanceBefore = selectedAccount?.currentBalance ?? 0
  if (initial && selectedAccount && initial.accountId === selectedAccount.id) {
    if (initial.type === "Income") {
      balanceBefore = selectedAccount.currentBalance - initial.amount
    } else {
      balanceBefore = selectedAccount.currentBalance + initial.amount
    }
  }
  const balanceAfter = type === "Income" ? balanceBefore + value : balanceBefore - value

  let fromBaselineBefore = fromAcc?.currentBalance ?? 0
  let toBaselineBefore = toAcc?.currentBalance ?? 0
  if (initial && initial.type === "Transfer") {
    if (fromAcc && initial.fromAccountId === fromAcc.id) {
      fromBaselineBefore = fromAcc.currentBalance + initial.amount
    }
    if (toAcc && initial.toAccountId === toAcc.id) {
      toBaselineBefore = toAcc.currentBalance - initial.amount
    }
  }
  const fromAfter = fromBaselineBefore - value
  const toAfter = toBaselineBefore + value

  const calcMap: Record<string, { before: number; after: number }> = {}
  if (type === "Transfer") {
    if (fromAcc) calcMap[fromAcc.id] = { before: fromBaselineBefore, after: fromAfter }
    if (toAcc) calcMap[toAcc.id] = { before: toBaselineBefore, after: toAfter }
  } else if (selectedAccount) {
    calcMap[selectedAccount.id] = { before: balanceBefore, after: balanceAfter }
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    if (owed) {
      try {
        await api("/api/debts", {
          body: { direction: who, person, amount: value, description: note || null, category: category || null, accountId: who === "they_owe" ? accountId || null : null, date },
        })
        refresh()
        onSaved()
        toast.success(who === "they_owe" ? `Saved · ${person.trim()} will pay you back ${formatCurrency(value, settings.currency)}` : `Saved · you owe ${person.trim()} ${formatCurrency(value, settings.currency)}`)
      } catch (err) {
        toast.error((err as Error).message)
      } finally {
        setSaving(false)
      }
      return
    }
    const body = {
      type,
      amount: value,
      currency: settings.currency,
      category: type === "Charity" ? "Charity" : type === "Transfer" ? "Transfer" : category || "Other",
      description: note,
      accountId: type === "Transfer" ? null : accountId || null,
      fromAccountId: type === "Transfer" ? fromId : null,
      toAccountId: type === "Transfer" ? toId : null,
      date,
    }
    try {
      const tx = initial
        ? await api<TransactionDTO>(`/api/transactions/${initial.id}`, { method: "PATCH", body })
        : await api<TransactionDTO>("/api/transactions", { body })
      refresh()
      onSaved(tx)

      if (!initial && type === "Income" && settings.charityPct > 0) {
        const suggested = Math.round(value * settings.charityPct) / 100
        toast.success(`Income saved · ${settings.charityPct}% charity would be ${formatCurrency(suggested, settings.currency)}`, {
          label: "Give",
          onClick: () =>
            api("/api/transactions", {
              body: { type: "Charity", amount: suggested, currency: settings.currency, category: "Charity", accountId: body.accountId, date },
            })
              .then(() => {
                refresh()
                toast.success("Charity recorded")
              })
              .catch((err) => toast.error(err.message)),
        })
      } else {
        toast.success(initial ? "Transaction updated" : `${type} saved`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Type */}
      <div className="grid grid-cols-4 gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            aria-pressed={type === t.value}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all [&_svg]:size-4",
              type === t.value ? cn("border-transparent", t.active) : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="rounded-2xl border border-border bg-subtle px-4 py-5 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            aria-label="Amount"
            size={Math.max(1, amount.length)}
            className={cn("min-w-[1ch] bg-transparent text-center text-5xl font-semibold tracking-tight tabular outline-none placeholder:text-current placeholder:opacity-30", typeMeta.active.split(" ")[1])}
          />
          <span className="text-base font-medium text-muted-foreground">{settings.currency}</span>
        </div>

        {/* Live Balance Preview (Before & After) */}
        {type !== "Transfer" && selectedAccount && !(owed && who === "i_owe") && (
          <div className="mt-3.5 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/90 px-3.5 py-1.5 text-xs shadow-xs">
            <span className="text-muted-foreground font-medium">{isCash(selectedAccount) ? "Cash in hand" : selectedAccount.name}:</span>
            <span className="tabular font-medium text-muted-foreground">{formatCurrency(balanceBefore, selectedAccount.currency)}</span>
            <span className="text-muted-foreground/60 font-mono">→</span>
            <span className={cn("tabular font-bold", balanceAfter < 0 ? "text-danger" : "text-foreground")}>
              {formatCurrency(balanceAfter, selectedAccount.currency)}
            </span>
            {value > 0 && (
              <span className={cn("text-[11px] font-medium ml-1", type === "Income" ? "text-success" : "text-danger")}>
                ({type === "Income" ? "+" : "−"}{formatCurrency(value, selectedAccount.currency)})
              </span>
            )}
          </div>
        )}

        {type === "Transfer" && fromAcc && toAcc && (
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1 text-[11px]">
              <span className="text-muted-foreground">{fromAcc.name}:</span>
              <span className="tabular text-muted-foreground">{formatCurrency(fromBaselineBefore, fromAcc.currency, { compact: true })}</span>
              <span className="text-muted-foreground/60 font-mono">→</span>
              <span className={cn("tabular font-semibold", fromAfter < 0 ? "text-danger" : "text-foreground")}>
                {formatCurrency(fromAfter, fromAcc.currency, { compact: true })}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1 text-[11px]">
              <span className="text-muted-foreground">{toAcc.name}:</span>
              <span className="tabular text-muted-foreground">{formatCurrency(toBaselineBefore, toAcc.currency, { compact: true })}</span>
              <span className="text-muted-foreground/60 font-mono">→</span>
              <span className="tabular font-semibold text-foreground">
                {formatCurrency(toAfter, toAcc.currency, { compact: true })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? "" : c)}
              aria-pressed={category === c}
              className={cn(
                "flex min-w-[70px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-[11px] font-medium transition-colors [&_svg]:size-[18px]",
                category === c ? "border-primary/40 bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_ICONS[c] ?? CATEGORY_ICONS.Other}
              <span>{c}</span>
            </button>
          ))}
        </div>
      )}

      {/* Who paid */}
      {type === "Expense" && !initial && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
            {([
              ["me", "Just me"],
              ["they_owe", "They'll pay me back"],
              ["i_owe", "Someone paid for me"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setWho(v)}
                aria-pressed={who === v}
                className={cn(
                  "min-h-9 cursor-pointer rounded-lg px-2 py-1.5 text-xs leading-tight font-medium transition-all",
                  who === v ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {who !== "me" && (
            <div className="space-y-1.5">
              <Input autoFocus value={person} onChange={(e) => setPerson(e.target.value)} placeholder={who === "they_owe" ? "Who will pay you back?" : "Who paid for it?"} aria-label="Person" />
              <p className="text-xs text-muted-foreground">
                {who === "they_owe"
                  ? "Taken from your account now. When they pay, press Refund on it and the money comes back — it isn't counted as your spending."
                  : "Nothing leaves your accounts yet. Press Paid when you pay them back."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Accounts */}
      {type === "Transfer" ? (
        <div className="space-y-2">
          <AccountPicker label="From" accounts={accounts} value={fromId} onChange={setFromId} calcMap={calcMap} />
          <div className="flex justify-center text-muted-foreground"><ArrowDown className="size-4" /></div>
          <AccountPicker label="To" accounts={accounts} value={toId} onChange={setToId} disabledId={fromId} calcMap={calcMap} />
        </div>
      ) : owed && who === "i_owe" ? null : (
        <AccountPicker label={type === "Income" ? "Into" : "Paid from"} accounts={accounts} value={accountId} onChange={setAccountId} calcMap={calcMap} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <DatePicker value={date} onChange={(v) => setDate(v ?? dateKey())} clearable={false} max={dateKey()} quick={["today"]} title="Date" />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
      </div>

      <Button type="submit" variant="primary" size="md" className="h-12 w-full rounded-xl text-[15px]" disabled={!valid || saving}>
        {saving
          ? "Saving…"
          : initial
            ? "Save changes"
            : owed
              ? who === "they_owe"
                ? `Add · ${person.trim() || "they"} will pay you back`
                : `Add · you owe ${person.trim() || "them"}${value > 0 ? ` ${formatCurrency(value, settings.currency)}` : ""}`
              : value > 0
                ? `Add ${formatCurrency(value, settings.currency)} ${type.toLowerCase()}`
                : `Add ${type.toLowerCase()}`}
      </Button>
    </form>
  )
}

/** Accounts as tappable cards — faster than a dropdown, and you see each balance. */
function AccountPicker({
  label,
  accounts,
  value,
  onChange,
  disabledId,
  calcMap,
}: {
  label: string
  accounts: AccountDTO[]
  value: string
  onChange: (id: string) => void
  disabledId?: string
  calcMap?: Record<string, { before: number; after: number }>
}) {
  if (accounts.length === 0) return <p className="text-[13px] text-muted-foreground">Add an account on the Money page first.</p>
  const sorted = [...accounts].sort((a, b) => Number(isCash(b)) - Number(isCash(a)))
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0">
        {sorted.map((a) => {
          const selected = a.id === value
          const change = selected && calcMap ? calcMap[a.id] : undefined
          return (
            <button
              key={a.id}
              type="button"
              disabled={a.id === disabledId}
              onClick={() => onChange(a.id)}
              aria-pressed={selected}
              className={cn(
                "flex min-w-40 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-35",
                selected ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-border hover:border-border-strong",
              )}
            >
              <BankLogo name={a.name} type={a.type} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{isCash(a) ? "Cash in hand" : a.name}</span>
                {change ? (
                  <span className="block text-[11px] tabular">
                    <span className="text-muted-foreground mr-1">{formatCurrency(change.before, a.currency, { compact: true })}</span>
                    <span className="text-muted-foreground/60 mr-1">→</span>
                    <span className={cn("font-semibold", change.after < 0 ? "text-danger" : "text-foreground")}>
                      {formatCurrency(change.after, a.currency, { compact: true })}
                    </span>
                  </span>
                ) : (
                  <span className="block text-[11px] text-muted-foreground tabular">{formatCurrency(a.currentBalance, a.currency, { compact: true })}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
