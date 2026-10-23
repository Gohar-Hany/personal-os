"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/constants"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/form"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { BankLogo } from "@/components/finance/BankLogo"
import type { AccountDTO } from "@/types"

export function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  account?: AccountDTO | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={account ? "Edit account" : "New account"} size="sm">
      <AccountForm account={account} onClose={() => onOpenChange(false)} />
    </Dialog>
  )
}

function AccountForm({ account, onClose }: { account?: AccountDTO | null; onClose: () => void }) {
  const { refresh, settings } = useApp()
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? "")
  const [type, setType] = useState(account?.type === "DigitalWallet" ? "Wallet" : account?.type ?? "Bank")
  const [currency, setCurrency] = useState(account?.currency ?? settings.currency)
  const [opening, setOpening] = useState(account ? String(account.openingBalance) : "")
  const [saving, setSaving] = useState(false)
  const editing = !!account

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const body = { name, type, currency, openingBalance: opening || 0 }
      if (editing) await api(`/api/finance/accounts/${account!.id}`, { method: "PATCH", body })
      else await api("/api/finance/accounts", { body })
      toast.success(editing ? "Account updated" : "Account added")
      refresh()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CIB, Cash, Orange Cash" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={setType} aria-label="Account type" options={ACCOUNT_TYPES.map((t) => ({ ...t, icon: <BankLogo name="" type={t.value} size="sm" className="size-5 rounded-md [&_svg]:size-3" /> }))} />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={setCurrency} aria-label="Currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
        </div>
        <Field label="Starting balance" hint="What the account held before you started tracking. The current balance is calculated from transactions.">
          <Input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || saving}>{editing ? "Save" : "Add account"}</Button>
        </div>
      </form>
  )
}
