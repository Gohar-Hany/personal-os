"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Coins, Gem, HandCoins, Pencil, Plus, RectangleHorizontal, RefreshCw, Store, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { useStoredState } from "@/lib/hooks"
import { keyOf } from "@/lib/tasks/taskLogic"
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
import { BankLogo } from "@/components/finance/BankLogo"
import type { AccountDTO, GoldHoldingDTO, GoldOverviewDTO, GoldQuoteDTO } from "@/types"

const POUND_GRAMS = 8 // an Egyptian gold pound: 8 g of 21K
const NISAB_GRAMS = 85 // of pure (24K) gold
const KIND_META: Record<string, { label: string; icon: React.ReactNode }> = {
  Jewelry: { label: "Jewelry", icon: <Gem /> },
  Coin: { label: "Gold pound", icon: <Coins /> },
  Bar: { label: "Bar", icon: <RectangleHorizontal /> },
}

const grams = (n: number) => `${+n.toFixed(2)} g`
const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0)

function holdingTitle(h: Pick<GoldHoldingDTO, "kind" | "grams" | "karat" | "name">) {
  if (h.name) return h.name
  if (h.kind === "Coin") {
    const n = +(h.grams / POUND_GRAMS).toFixed(2)
    return `${n} gold pound${n === 1 ? "" : "s"}`
  }
  return h.kind === "Bar" ? `${grams(h.grams)} bar` : `${h.karat}K jewelry`
}

/**
 * Gold as one more card among the accounts: total worth and grams.
 * Tap it for the pieces, today's price and adding more.
 */
export function GoldCard({ gold, accounts }: { gold: GoldOverviewDTO | null; accounts: AccountDTO[] }) {
  const { settings, refresh } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<{ holding: GoldHoldingDTO | null } | null>(null)
  const [selling, setSelling] = useState<GoldHoldingDTO | null>(null)
  const [pricing, setPricing] = useState(false)
  const [countJewelry, setCountJewelry] = useStoredState<"yes" | "no">("gold:zakat-jewelry", "yes", ["yes", "no"])
  if (!gold) return null

  const cur = settings.currency
  const { holdings, quote } = gold
  const gram24 = quote?.gram24 ?? 0
  const zakatGrams = countJewelry === "yes" ? gold.pureGrams : gold.pureGrams - gold.pureGramsJewelry
  const karats = [...new Set(holdings.map((h) => h.karat))].sort((a, b) => b - a)
  const openCard = () => (holdings.length ? setOpen(true) : setEditing({ holding: null }))

  const remove = async (h: GoldHoldingDTO) => {
    const ok = await confirm({
      title: `Remove “${holdingTitle(h)}”?`,
      message: h.transactionId ? "Its purchase is removed from your transactions too, so that money counts as back in the account." : "This only removes it from your list.",
      confirmLabel: "Remove",
      danger: true,
    })
    if (!ok) return
    try {
      await api(`/api/gold/${h.id}`, { method: "DELETE" })
      toast.success("Removed")
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={openCard}
        onKeyDown={(e) => e.key === "Enter" && openCard()}
        className={cn(
          "group flex w-44 shrink-0 cursor-pointer snap-start flex-col gap-4 p-4 transition-colors hover:border-amber-500/50 sm:w-auto",
          !holdings.length && "border-dashed",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-sm [&_svg]:size-5">
            <Coins />
          </span>
          {quote && <span className="text-[11px] text-muted-foreground tabular">{formatCurrency(Math.round(gram24), cur, { compact: true })}/g</span>}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted-foreground">
            Gold{holdings.length > 0 && ` · ${grams(gold.grams)}${karats.length === 1 ? ` ${karats[0]}K` : ""}`}
          </p>
          {holdings.length ? (
            <p className="truncate text-xl font-semibold tracking-tight">{gold.value !== null ? <Amount value={Math.round(gold.value)} currency={cur} /> : "—"}</p>
          ) : (
            <p className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              <Plus className="size-4" /> Add gold
            </p>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen} title="Gold" size="sm">
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight">{gold.value !== null ? <Amount value={Math.round(gold.value)} currency={cur} /> : "—"}</p>
              <p className="mt-1 text-[13px] text-muted-foreground tabular">{grams(gold.grams)} of gold</p>
            </div>
            {gold.gain !== null && gold.paid !== null && <GainText gain={gold.gain} paid={gold.paid} />}
          </div>

          {quote && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/8 px-3.5 py-2.5 text-[13px] ring-1 ring-amber-500/20 ring-inset">
              <span className="tabular">
                <span className="font-semibold">{formatCurrency(Math.round(gram24), cur)}</span> <span className="text-muted-foreground">/ g 24K</span>
                <span className="text-muted-foreground"> · {formatCurrency(Math.round(gram24 * (21 / 24)), cur, { compact: true })} 21K</span>
              </span>
              <button type="button" onClick={() => setPricing(true)} className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-400">
                {quote.source === "manual" ? "Your price" : "Live"} · change
              </button>
            </div>
          )}

          <div className="-mx-2 space-y-0.5">
            {holdings.map((h) => (
              <div key={h.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400 [&_svg]:size-4">{KIND_META[h.kind]?.icon ?? <Gem />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{holdingTitle(h)}</p>
                  <p className="truncate text-xs text-muted-foreground tabular">
                    {h.kind === "Coin" ? `${+(h.grams / POUND_GRAMS).toFixed(2)} × 8 g` : grams(h.grams)} · {h.karat}K
                    {h.boughtAt && ` · ${format(new Date(h.boughtAt), "MMM yyyy")}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{h.value !== null ? <Amount value={Math.round(h.value)} currency={cur} /> : "—"}</p>
                  {h.paid != null && h.value !== null && <GainText gain={h.value - h.paid} paid={h.paid} />}
                </div>
                <Menu
                  label={holdingTitle(h)}
                  items={[
                    { label: "Edit", icon: <Pencil />, onSelect: () => setEditing({ holding: h }) },
                    { label: "Sold it", icon: <Store />, onSelect: () => setSelling(h) },
                    { separator: true },
                    { label: "Remove", icon: <Trash2 />, danger: true, onSelect: () => remove(h) },
                  ]}
                />
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full" onClick={() => setEditing({ holding: null })}>
            <Plus /> Add gold
          </Button>

          {quote && holdings.length > 0 && (
            <div className="flex items-start gap-2.5 border-t border-border pt-4 text-xs text-muted-foreground">
              <HandCoins className="mt-px size-4 shrink-0" />
              <div className="space-y-1">
                {zakatGrams >= NISAB_GRAMS ? (
                  <p>
                    Above the zakat nisab ({NISAB_GRAMS} g of 24K) — about <span className="font-medium text-foreground">{formatCurrency(Math.round(zakatGrams * gram24 * 0.025), cur)}</span> once a lunar year has passed.
                  </p>
                ) : (
                  <p>{grams(zakatGrams)} of the {NISAB_GRAMS} g zakat nisab — none due on gold yet.</p>
                )}
                {gold.pureGramsJewelry > 0 && (
                  <label className="flex w-fit cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={countJewelry === "yes"} onChange={(e) => setCountJewelry(e.target.checked ? "yes" : "no")} className="size-3.5 accent-[var(--primary)]" />
                    Count jewelry you wear (scholars differ)
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <HoldingDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} holding={editing?.holding ?? null} accounts={accounts} gram24={gram24} />
      <SellDialog holding={selling} onClose={() => setSelling(null)} accounts={accounts} />
      <PriceDialog open={pricing} onOpenChange={setPricing} quote={quote} />
    </>
  )
}

function GainText({ gain, paid }: { gain: number; paid: number }) {
  const up = gain >= 0
  return (
    <p className={cn("text-xs font-medium tabular", up ? "text-success" : "text-danger")}>
      {up ? "+" : "−"}
      {Math.abs(pct(gain, paid)).toFixed(1)}%
    </p>
  )
}

function HoldingDialog({
  open,
  onOpenChange,
  holding,
  accounts,
  gram24,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  holding: GoldHoldingDTO | null
  accounts: AccountDTO[]
  gram24: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={holding ? "Edit gold" : "Add gold"} size="sm">
      {open && <HoldingForm key={holding?.id ?? "new"} holding={holding} accounts={accounts} gram24={gram24} onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function HoldingForm({ holding, accounts, gram24, onClose }: { holding: GoldHoldingDTO | null; accounts: AccountDTO[]; gram24: number; onClose: () => void }) {
  const { refresh, settings } = useApp()
  const clock = useClock()
  const toast = useToast()
  const [kind, setKind] = useState<"Jewelry" | "Coin" | "Bar">((holding?.kind as "Jewelry" | "Coin" | "Bar") ?? "Jewelry")
  const [karat, setKarat] = useState(String(holding?.karat ?? 21))
  const [weight, setWeight] = useState(holding ? String(holding.kind === "Coin" ? +(holding.grams / POUND_GRAMS).toFixed(2) : holding.grams) : "")
  const [name, setName] = useState(holding?.name ?? "")
  const [boughtAt, setBoughtAt] = useState(holding?.boughtAt ? keyOf(holding.boughtAt, clock) ?? "" : "")
  const [paid, setPaid] = useState(holding?.paid != null ? String(holding.paid) : "")
  const [fromAccountId, setFromAccountId] = useState("")
  const [saving, setSaving] = useState(false)

  const k = kind === "Coin" ? 21 : kind === "Bar" ? 24 : Number(karat)
  const g = (Number(weight) || 0) * (kind === "Coin" ? POUND_GRAMS : 1)
  const worth = g * (k / 24) * gram24

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!(g > 0) || saving) return
    setSaving(true)
    try {
      const body = { kind, karat: k, grams: g, name: name.trim() || null, boughtAt: boughtAt || null, paid: paid || null, ...(holding ? {} : { fromAccountId: (paid && fromAccountId) || null }) }
      if (holding) await api(`/api/gold/${holding.id}`, { method: "PATCH", body })
      else await api("/api/gold", { body })
      toast.success(holding ? "Saved" : "Gold added")
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
        value={kind}
        onChange={setKind}
        options={[
          { value: "Jewelry", label: <><Gem /> Jewelry</> },
          { value: "Coin", label: <><Coins /> Gold pound</> },
          { value: "Bar", label: <><RectangleHorizontal /> Bar</> },
        ]}
      />
      <div className={cn("grid gap-3", kind === "Jewelry" ? "grid-cols-2" : "grid-cols-1")}>
        <Field label={kind === "Coin" ? "How many pounds" : "Weight (grams)"} hint={kind === "Coin" ? "Each pound is 8 g of 21K" : kind === "Bar" ? "Bars are 24K" : undefined}>
          <Input autoFocus inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={kind === "Coin" ? "1" : "10"} />
        </Field>
        {kind === "Jewelry" && (
          <Field label="Karat">
            <Select value={karat} onChange={setKarat} aria-label="Karat" options={[{ value: "21", label: "21K" }, { value: "18", label: "18K" }, { value: "24", label: "24K" }]} />
          </Field>
        )}
      </div>
      <Field label="Name" hint="Optional — e.g. “Wedding ring”, “10 g bar”">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={holdingTitle({ kind, grams: g || 1, karat: k, name: null })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bought on">
          <DatePicker value={boughtAt} onChange={(v) => setBoughtAt(v ?? "")} placeholder="Optional" quick={["today"]} max={clock.today} title="Bought on" />
        </Field>
        <Field label="Total paid">
          <Input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Total paid includes workmanship and stamp — it&apos;s what your gain is measured against.</p>
      {!holding && paid && accounts.length > 0 && (
        <Field label="Paid from" hint="Recorded as money moved into gold — not as spending.">
          <Select
            value={fromAccountId}
            onChange={setFromAccountId}
            placeholder="Don't record a payment"
            aria-label="Paid from"
            options={accounts.map((a) => ({ value: a.id, label: a.type === "Cash" ? "Cash in hand" : a.name, icon: <BankLogo name={a.name} type={a.type} size="sm" className="size-5 rounded-md [&_svg]:size-3" />, hint: formatCurrency(a.currentBalance, a.currency, { compact: true }) }))}
          />
        </Field>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">{g > 0 && gram24 > 0 ? <>Worth now ≈ <span className="font-semibold text-foreground">{formatCurrency(Math.round(worth), settings.currency)}</span></> : null}</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!(g > 0) || saving}>{holding ? "Save" : "Add gold"}</Button>
        </div>
      </div>
    </form>
  )
}

function SellDialog({ holding, onClose, accounts }: { holding: GoldHoldingDTO | null; onClose: () => void; accounts: AccountDTO[] }) {
  return (
    <Dialog open={!!holding} onOpenChange={(o) => !o && onClose()} title="Sold gold" size="sm">
      {holding && <SellForm key={holding.id} holding={holding} accounts={accounts} onClose={onClose} />}
    </Dialog>
  )
}

function SellForm({ holding, accounts, onClose }: { holding: GoldHoldingDTO; accounts: AccountDTO[]; onClose: () => void }) {
  const { refresh } = useApp()
  const clock = useClock()
  const toast = useToast()
  const [soldFor, setSoldFor] = useState(holding.value ? String(Math.round(holding.value)) : "")
  const [toAccountId, setToAccountId] = useState(accounts.find((a) => a.type === "Cash")?.id ?? "")
  const [date, setDate] = useState(clock.today)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number(soldFor) || saving) return
    setSaving(true)
    try {
      await api(`/api/gold/${holding.id}`, { method: "PATCH", body: { sell: { soldFor, toAccountId: toAccountId || null, date } } })
      toast.success("Marked as sold")
      refresh()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[13px] text-muted-foreground">{holdingTitle(holding)} · {grams(holding.grams)} {holding.karat}K</p>
      <Field label="Sold for" hint="What the shop actually paid you">
        <Input autoFocus inputMode="decimal" value={soldFor} onChange={(e) => setSoldFor(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Money went to">
          <Select
            value={toAccountId}
            onChange={setToAccountId}
            placeholder="Don't record"
            aria-label="Money went to"
            options={accounts.map((a) => ({ value: a.id, label: a.type === "Cash" ? "Cash in hand" : a.name }))}
          />
        </Field>
        <Field label="On">
          <DatePicker value={date} onChange={(v) => setDate(v ?? clock.today)} clearable={false} quick={["today"]} max={clock.today} title="Sold on" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!Number(soldFor) || saving}>Mark as sold</Button>
      </div>
    </form>
  )
}

function PriceDialog({ open, onOpenChange, quote }: { open: boolean; onOpenChange: (o: boolean) => void; quote: GoldQuoteDTO | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Today's gold price" size="sm">
      {open && <PriceForm quote={quote} onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function PriceForm({ quote, onClose }: { quote: GoldQuoteDTO | null; onClose: () => void }) {
  const { refresh, settings } = useApp()
  const toast = useToast()
  const [karat, setKarat] = useState("21")
  const [price, setPrice] = useState(quote ? String(Math.round(quote.gram24 * (21 / 24))) : "")
  const [saving, setSaving] = useState(false)

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setSaving(true)
    try {
      await fn()
      toast.success(msg)
      refresh()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (Number(price) > 0) run(() => api("/api/gold/price", { body: { price, karat } }), "Price saved for today")
      }}
      className="space-y-4"
    >
      <p className="text-[13px] text-muted-foreground">
        The live price is the global price at the official dollar rate. Shops in Egypt can differ — enter what a shop pays per gram and it&apos;s used for the rest of today.
      </p>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Field label="Karat">
          <Select
            value={karat}
            onChange={(v) => {
              if (quote && Number(price) === Math.round(quote.gram24 * (Number(karat) / 24))) setPrice(String(Math.round(quote.gram24 * (Number(v) / 24))))
              setKarat(v)
            }}
            aria-label="Karat"
            options={[{ value: "21", label: "21K" }, { value: "24", label: "24K" }, { value: "18", label: "18K" }]}
          />
        </Field>
        <Field label={`Price per gram (${settings.currency})`}>
          <Input autoFocus inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        {quote?.source === "manual" ? (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => run(() => api("/api/gold/price", { method: "DELETE" }), "Back to the live price")}>
            <RefreshCw /> Use live price
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!(Number(price) > 0) || saving}>Save price</Button>
        </div>
      </div>
    </form>
  )
}
