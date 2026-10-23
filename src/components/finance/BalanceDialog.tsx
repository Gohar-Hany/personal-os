"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { BankLogo } from "@/components/finance/BankLogo"
import type { AccountDTO } from "@/types"

/**
 * "How much do you actually have?" — sets up a cash wallet, or corrects an
 * account's balance by recording the difference as an adjustment.
 */
export function BalanceDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** null = create the cash wallet */
  account: AccountDTO | null
}) {
  const setup = !account
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={setup ? "Set up cash in hand" : account.type === "Cash" ? "Count your cash" : `Correct ${account.name} balance`}
      description={setup ? "Track the money in your pocket alongside your bank accounts." : "Enter what you actually have right now. The difference is recorded as a correction, so it won't count as spending."}
    >
      <BalanceForm account={account} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function BalanceForm({ account, onDone }: { account: AccountDTO | null; onDone: () => void }) {
  const { settings, refresh } = useApp()
  const toast = useToast()
  const [value, setValue] = useState(account ? String(Math.round(account.currentBalance * 100) / 100) : "")
  const [saving, setSaving] = useState(false)
  const currency = account?.currency ?? settings.currency
  const actual = Number(value)
  const diff = account && value !== "" ? Math.round((actual - account.currentBalance) * 100) / 100 : 0
  const validNumber = value !== "" && Number.isFinite(actual) && actual >= 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validNumber || saving) return
    setSaving(true)
    try {
      if (!account) {
        await api("/api/finance/accounts", { body: { name: "Cash", type: "Cash", currency, openingBalance: actual } })
        toast.success("Cash in hand is set up")
      } else if (diff !== 0) {
        await api("/api/transactions", {
          body: {
            type: diff > 0 ? "Income" : "Expense",
            amount: Math.abs(diff),
            currency,
            category: "Adjustment",
            description: account.type === "Cash" ? "Cash count" : "Balance correction",
            accountId: account.id,
          },
        })
        toast.success(`Balance updated to ${formatCurrency(actual, currency)}`)
      }
      refresh()
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-subtle py-5">
        <BankLogo name={account?.name ?? "Cash"} type={account?.type ?? "Cash"} size="lg" />
        <div className="flex items-baseline gap-2">
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            aria-label="Actual balance"
            size={Math.max(1, value.length)}
            className="min-w-[1ch] bg-transparent text-center text-4xl font-semibold tracking-tight tabular outline-none placeholder:opacity-30"
          />
          <span className="text-sm text-muted-foreground">{currency}</span>
        </div>
        {account && (
          <p className={cn("text-[13px] tabular", diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-danger")}>
            {diff === 0 ? "Matches what the app expects" : `${diff > 0 ? "+" : "−"}${formatCurrency(Math.abs(diff), currency)} vs. expected ${formatCurrency(account.currentBalance, currency)}`}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" size="md" className="h-11 w-full rounded-xl" disabled={!validNumber || saving || (!!account && diff === 0)}>
        {account ? "Update balance" : "Start tracking cash"}
      </Button>
    </form>
  )
}
