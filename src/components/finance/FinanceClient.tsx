"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { addMonths, format, isSameDay, isToday, isYesterday } from "date-fns"
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, ChevronLeft, ChevronRight, HeartHandshake, Landmark, Pencil,
  PieChart, Plus, Receipt, Scale, Search, SlidersHorizontal, Trash2,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { useSynced } from "@/lib/hooks"
import { Card, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Amount, Chip, EmptyState, PageHeader } from "@/components/ui/misc"
import { Menu } from "@/components/ui/menu"
import { Dialog } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm"
import { useApp } from "@/components/app/AppProvider"
import { BankLogo } from "@/components/finance/BankLogo"
import { AccountDialog } from "@/components/finance/AccountDialog"
import { BalanceDialog } from "@/components/finance/BalanceDialog"
import { CATEGORY_ICONS, TransactionForm } from "@/components/finance/TransactionForm"
import type { AccountDTO, MonthSummary, TransactionDTO } from "@/types"

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "Expense", label: "Expenses" },
  { value: "Income", label: "Income" },
  { value: "Charity", label: "Charity" },
  { value: "Transfer", label: "Transfers" },
]

const TYPE_STYLE: Record<string, { icon: React.ReactNode; className: string; sign: string }> = {
  Expense: { icon: <ArrowUpRight />, className: "bg-danger-soft text-danger", sign: "−" },
  Income: { icon: <ArrowDownLeft />, className: "bg-success-soft text-success", sign: "+" },
  Charity: { icon: <HeartHandshake />, className: "bg-primary-soft text-primary", sign: "−" },
  Transfer: { icon: <ArrowLeftRight />, className: "bg-info-soft text-info", sign: "" },
}

const isCash = (a: AccountDTO) => a.type === "Cash"

function dayLabel(d: Date) {
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "EEEE, MMM d")
}

export function FinanceClient({
  accounts,
  transactions: serverTx,
  summary,
  month,
}: {
  accounts: AccountDTO[]
  transactions: TransactionDTO[]
  summary: MonthSummary
  month: string
}) {
  const router = useRouter()
  const { settings, quickAdd, refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [transactions, setTransactions] = useSynced(serverTx)
  const [typeFilter, setTypeFilter] = useState("")
  const [search, setSearch] = useState("")
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null)
  const [accountDialog, setAccountDialog] = useState<{ account: AccountDTO | null } | null>(null)
  const [balanceDialog, setBalanceDialog] = useState<{ account: AccountDTO | null } | null>(null)

  const cur = settings.currency
  const monthDate = new Date(`${month}-01T00:00:00`)
  const isCurrentMonth = month === format(new Date(), "yyyy-MM")
  const goMonth = (delta: number) => router.push(`/finance?month=${format(addMonths(monthDate, delta), "yyyy-MM")}`)

  const cashAccounts = accounts.filter(isCash)
  const otherAccounts = accounts.filter((a) => !isCash(a))
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0)
  const cashTotal = cashAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const bankTotal = totalBalance - cashTotal
  const savingsRate = summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : null
  const spendShare = summary.income > 0 ? Math.min(100, Math.round(((summary.expenses + summary.charity) / summary.income) * 100)) : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter(
      (t) =>
        (!typeFilter || (t.type === typeFilter && t.category !== "Adjustment")) &&
        (!q || [t.description, t.category, t.account?.name].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [transactions, typeFilter, search])

  const byDay = useMemo(() => {
    const groups: { date: Date; items: TransactionDTO[] }[] = []
    for (const t of filtered) {
      const d = new Date(t.date)
      const last = groups[groups.length - 1]
      if (last && isSameDay(last.date, d)) last.items.push(t)
      else groups.push({ date: d, items: [t] })
    }
    return groups
  }, [filtered])

  const removeTx = (t: TransactionDTO) =>
    toast.undoable({
      message: "Transaction deleted",
      apply: () => setTransactions((list) => list.filter((x) => x.id !== t.id)),
      revert: () => setTransactions((list) => [...list, t].sort((a, b) => b.date.localeCompare(a.date))),
      commit: () => api(`/api/transactions/${t.id}`, { method: "DELETE" }).then(refresh),
    })

  const removeAccount = async (a: AccountDTO) => {
    const ok = await confirm({
      title: `Remove “${a.name}”?`,
      message: "If it has transactions it will be hidden (history is kept). Otherwise it's deleted.",
      confirmLabel: "Remove",
      danger: true,
    })
    if (!ok) return
    try {
      await api(`/api/finance/accounts/${a.id}`, { method: "DELETE" })
      toast.success("Account removed")
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const accountMenu = (a: AccountDTO) => [
    { label: isCash(a) ? "Count cash" : "Correct balance", icon: <Scale />, onSelect: () => setBalanceDialog({ account: a }) },
    { label: "Edit", icon: <Pencil />, onSelect: () => setAccountDialog({ account: a }) },
    { separator: true as const },
    { label: "Remove", icon: <Trash2 />, danger: true, onSelect: () => removeAccount(a) },
  ]

  const maxCategory = summary.byCategory[0]?.amount ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Money"
        actions={
          <Button variant="primary" onClick={() => quickAdd({ mode: "money" })} className="hidden sm:inline-flex">
            <Plus /> Add transaction
          </Button>
        }
      />

      {/* ─── Balance hero ─── */}
      <Card className="surface-hero overflow-hidden">
        <div className="p-5 sm:p-6">
          <p className="text-[13px] font-medium text-muted-foreground">Total balance</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl"><Amount value={totalBalance} currency={cur} /></p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {/* Cash in hand — its own spot */}
            {cashAccounts.length > 0 ? (
              <button
                type="button"
                onClick={() => setBalanceDialog({ account: cashAccounts[0] })}
                className="group flex cursor-pointer flex-col items-start gap-2.5 rounded-2xl border border-border bg-card/70 p-3 text-left backdrop-blur-sm transition-colors hover:border-success/50 sm:flex-row sm:items-center sm:gap-3"
              >
                <BankLogo name="Cash" type="Cash" size="md" />
                <span className="w-full min-w-0">
                  <span className="block text-xs text-muted-foreground">Cash in hand</span>
                  <span className="block truncate text-lg font-semibold"><Amount value={cashTotal} currency={cur} /></span>
                  <span className="block text-[11px] font-medium text-success opacity-80 group-hover:opacity-100">Count →</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setBalanceDialog({ account: null })}
                className="flex cursor-pointer flex-col items-start gap-2.5 rounded-2xl border border-dashed border-success/50 bg-success-soft/40 p-3 text-left transition-colors hover:bg-success-soft sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"><Banknote className="size-5" /></span>
                <span>
                  <span className="block text-[13px] font-semibold">Cash in hand</span>
                  <span className="block text-xs text-muted-foreground">Tap to start tracking</span>
                </span>
              </button>
            )}
            <div className="flex flex-col items-start gap-2.5 rounded-2xl border border-border bg-card/70 p-3 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><Landmark className="size-5" /></span>
              <span className="w-full min-w-0">
                <span className="block text-xs text-muted-foreground">In banks</span>
                <span className="block truncate text-lg font-semibold"><Amount value={bankTotal} currency={cur} /></span>
                <span className="block text-[11px] text-muted-foreground">{otherAccounts.length} account{otherAccounts.length === 1 ? "" : "s"}</span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Month ─── */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft /></Button>
            <span className="min-w-28 text-center text-sm font-semibold">{format(monthDate, "MMMM yyyy")}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => goMonth(1)} disabled={isCurrentMonth} aria-label="Next month"><ChevronRight /></Button>
          </div>
          {savingsRate !== null && (
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", savingsRate >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
              {savingsRate}% saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <Stat label="Income" value={<Amount value={summary.income} currency={cur} />} dot="bg-success" />
          <Stat label="Spent" value={<Amount value={summary.expenses} currency={cur} />} dot="bg-danger" />
          <Stat label="Charity" value={<Amount value={summary.charity} currency={cur} />} dot="bg-primary" />
          <Stat label="Saved" value={<Amount value={summary.savings} currency={cur} />} dot="bg-info" className={summary.savings < 0 ? "text-danger" : undefined} />
        </div>
        {spendShare !== null && (
          <div className="mt-4 space-y-1.5">
            <div className="flex h-2 overflow-hidden rounded-full bg-success-soft">
              <div className="bg-danger/80" style={{ width: `${Math.min(spendShare, (summary.expenses / summary.income) * 100)}%` }} />
              <div className="bg-primary/80" style={{ width: `${Math.max(0, Math.min(100 - (summary.expenses / summary.income) * 100, (summary.charity / summary.income) * 100))}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">You&apos;ve used {spendShare}% of this month&apos;s income</p>
          </div>
        )}
      </Card>

      {/* ─── Accounts ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Accounts</h2>
          <Button size="xs" variant="ghost" onClick={() => setAccountDialog({ account: null })}>
            <Plus /> Add account
          </Button>
        </div>
        {accounts.length === 0 ? (
          <Card>
            <EmptyState title="No accounts yet" description="Add your bank accounts, wallets and cash to see your real balance." action={<Button variant="primary" onClick={() => setAccountDialog({ account: null })}><Plus /> Add account</Button>} />
          </Card>
        ) : (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
            {[...cashAccounts, ...otherAccounts].map((a) => (
              <Card key={a.id} className="group flex w-44 shrink-0 snap-start flex-col gap-4 p-4 sm:w-auto">
                <div className="flex items-start justify-between gap-2">
                  <BankLogo name={a.name} type={a.type} size="md" />
                  <Menu label={a.name} className="lg:opacity-0 lg:group-hover:opacity-100" items={accountMenu(a)} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-muted-foreground">{isCash(a) ? "Cash in hand" : a.name}</p>
                  <p className={cn("truncate text-xl font-semibold tracking-tight", a.currentBalance < 0 && "text-danger")}>
                    <Amount value={a.currentBalance} currency={a.currency} />
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        {/* ─── Transactions ─── */}
        <Card className="overflow-hidden">
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Transactions</h2>
              <span className="text-xs text-muted-foreground tabular">{filtered.length}</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes, categories, accounts"
                aria-label="Search transactions"
                className="h-10 w-full rounded-xl bg-muted pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground focus:ring-3 focus:ring-ring/15 sm:h-9 sm:text-sm"
              />
            </div>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
              {TYPE_FILTERS.map((f) => (
                <Chip key={f.value} active={typeFilter === f.value} onClick={() => setTypeFilter(f.value)}>{f.label}</Chip>
              ))}
            </div>
          </div>
          {byDay.length === 0 ? (
            <EmptyState
              icon={<Receipt />}
              title={transactions.length ? "Nothing matches" : `No transactions in ${format(monthDate, "MMMM")}`}
              description={transactions.length ? "Try another filter." : "Log expenses as they happen — it takes a few seconds."}
              action={!transactions.length && <Button variant="primary" onClick={() => quickAdd({ mode: "money" })}><Plus /> Add transaction</Button>}
            />
          ) : (
            <div className="pb-2">
              {byDay.map((g) => {
                const spent = g.items.filter((t) => t.type === "Expense" && t.category !== "Adjustment").reduce((s, t) => s + t.amount, 0)
                return (
                  <div key={g.date.toDateString()}>
                    <div className="sticky top-0 z-[1] flex items-center justify-between border-y border-border bg-subtle/95 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                      <span>{dayLabel(g.date)}</span>
                      <span className="tabular">{spent ? `−${formatCurrency(spent, cur)}` : ""}</span>
                    </div>
                    {g.items.map((t) => {
                      const adjustment = t.category === "Adjustment"
                      const style = adjustment
                        ? { icon: <SlidersHorizontal />, className: "bg-muted text-muted-foreground", sign: t.type === "Income" ? "+" : "−" }
                        : TYPE_STYLE[t.type] ?? TYPE_STYLE.Expense
                      const icon = !adjustment && t.category && CATEGORY_ICONS[t.category] && t.type === "Expense" ? CATEGORY_ICONS[t.category] : style.icon
                      const where = t.type === "Transfer" ? `${t.fromAccount?.name ?? "?"} → ${t.toAccount?.name ?? "?"}` : t.account?.name
                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setEditingTx(t)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingTx(t)}
                          className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle active:bg-muted"
                        >
                          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]", style.className)}>{icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{adjustment ? t.description || "Balance correction" : t.description || t.category || t.type}</p>
                            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                              <span>{[!adjustment && t.description ? t.category : null, where].filter(Boolean).join(" · ")}</span>
                              {t.type !== "Transfer" && t.balanceBefore != null && t.balanceAfter != null && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/85">
                                  · <span>{formatCurrency(t.balanceBefore, t.currency || cur, { compact: true })}</span>
                                  <span className="text-muted-foreground/50">→</span>
                                  <span className="font-semibold text-foreground/90">{formatCurrency(t.balanceAfter, t.currency || cur, { compact: true })}</span>
                                </span>
                              )}
                              {t.type === "Transfer" && t.fromBalanceBefore != null && t.fromBalanceAfter != null && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/85">
                                  · <span>({formatCurrency(t.fromBalanceBefore, t.currency || cur, { compact: true })} → {formatCurrency(t.fromBalanceAfter, t.currency || cur, { compact: true })})</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={cn("text-sm font-semibold tabular", t.type === "Income" && !adjustment && "text-success")}>
                            {style.sign}
                            {formatCurrency(t.amount, t.currency || cur)}
                          </span>
                          <Menu
                            label="Transaction"
                            className="hidden lg:flex lg:opacity-0 lg:group-hover:opacity-100"
                            items={[
                              { label: "Edit", icon: <Pencil />, onSelect: () => setEditingTx(t) },
                              { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => removeTx(t) },
                            ]}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ─── Spending by category ─── */}
        <Card>
          <CardHeader title="Where it went" icon={<PieChart />} tone="danger" meta={format(monthDate, "MMMM")} />
          {summary.byCategory.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted-foreground">No spending this month.</p>
          ) : (
            <div className="space-y-3.5 px-4 pb-4">
              {summary.byCategory.slice(0, 8).map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                    {CATEGORY_ICONS[c.category] ?? CATEGORY_ICONS.Other}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{c.category}</span>
                      <span className="shrink-0 font-medium tabular">{formatCurrency(c.amount, cur)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-danger/70" style={{ width: `${(c.amount / maxCategory) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!editingTx} onOpenChange={(o) => !o && setEditingTx(null)} title="Edit transaction" footer={
        editingTx && (
          <Button variant="ghost" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={() => { const t = editingTx; setEditingTx(null); removeTx(t) }}>
            <Trash2 /> Delete
          </Button>
        )
      }>
        {editingTx && <TransactionForm initial={editingTx} accounts={accounts} autoFocus={false} onSaved={() => setEditingTx(null)} />}
      </Dialog>
      <AccountDialog open={!!accountDialog} onOpenChange={(o) => !o && setAccountDialog(null)} account={accountDialog?.account} />
      <BalanceDialog open={!!balanceDialog} onOpenChange={(o) => !o && setBalanceDialog(null)} account={balanceDialog?.account ?? null} />
    </div>
  )
}

function Stat({ label, value, dot, className }: { label: string; value: React.ReactNode; dot: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </p>
      <p className={cn("mt-1 truncate text-lg font-semibold tracking-tight tabular", className)}>{value}</p>
    </div>
  )
}
