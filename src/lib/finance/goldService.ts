import { prisma } from "@/lib/prisma"
import { userClock } from "@/lib/userTime"
import { BadRequest } from "@/lib/http"

// ─── PRICES ───────────────────────────────────────────────
//
// Live price = global spot (USD per troy ounce) × the official USD→EGP rate.
// Egyptian shops can quote a little differently, so a price typed in by hand
// wins for the rest of that day.

const TROY_OUNCE_GRAMS = 31.1034768
const STALE_MS = 6 * 60 * 60 * 1000
export const GOLD_POUND_GRAMS = 8 // an Egyptian gold pound: 8 g of 21K
export const KARATS = [24, 21, 18] as const

export const purity = (karat: number) => karat / 24

export interface GoldQuote {
  date: string
  gram24: number
  source: "live" | "manual"
  fetchedAt: string
  /** The previous day's price, for "today's change". */
  previous: number | null
  /** True when a refresh was due but the live sources didn't answer. */
  stale: boolean
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

async function fetchLive() {
  const [gold, fx] = await Promise.all([fetchJson("https://api.gold-api.com/price/XAU"), fetchJson("https://open.er-api.com/v6/latest/USD")])
  const usdPerOz = Number(gold?.price)
  const egpPerUsd = Number(fx?.rates?.EGP)
  if (!(usdPerOz > 0) || !(egpPerUsd > 0)) throw new Error("Unexpected price data")
  return { usdPerOz, egpPerUsd, gram24: (usdPerOz / TROY_OUNCE_GRAMS) * egpPerUsd }
}

/**
 * Today's gold price. With `refresh`, fetches a live price when the stored one is
 * older than a few hours (never over a manual price set today).
 */
export async function getGoldQuote({ refresh = true } = {}): Promise<GoldQuote | null> {
  const { today } = await userClock()
  let latest = await prisma.goldPrice.findFirst({ orderBy: { date: "desc" } })
  let stale = false

  const manualToday = latest?.date === today && latest.source === "manual"
  if (refresh && !manualToday && (!latest || Date.now() - latest.fetchedAt.getTime() > STALE_MS || latest.date !== today)) {
    try {
      const live = await fetchLive()
      latest = await prisma.goldPrice.upsert({
        where: { date: today },
        create: { date: today, source: "live", ...live },
        update: { source: "live", fetchedAt: new Date(), ...live },
      })
    } catch (err) {
      console.warn("[gold] live price unavailable:", (err as Error).message)
      stale = true
    }
  }
  if (!latest) return null

  const prev = await prisma.goldPrice.findFirst({ where: { date: { lt: latest.date } }, orderBy: { date: "desc" } })
  return {
    date: latest.date,
    gram24: latest.gram24,
    source: latest.source === "manual" ? "manual" : "live",
    fetchedAt: latest.fetchedAt.toISOString(),
    previous: prev?.gram24 ?? null,
    stale,
  }
}

/** A shop's price for one gram of `karat`, stored as the 24K equivalent for today. */
export async function setManualPrice(pricePerGram: number, karat: number) {
  if (!(pricePerGram > 0)) throw new BadRequest("Enter the price per gram")
  if (!KARATS.includes(karat as (typeof KARATS)[number])) throw new BadRequest("Karat must be 24, 21 or 18")
  const { today } = await userClock()
  const gram24 = pricePerGram / purity(karat)
  await prisma.goldPrice.upsert({
    where: { date: today },
    create: { date: today, gram24, source: "manual" },
    update: { gram24, source: "manual", fetchedAt: new Date(), usdPerOz: null, egpPerUsd: null },
  })
  return getGoldQuote({ refresh: false })
}

/** Drop today's manual price and go back to the live one. */
export async function resetToLivePrice() {
  const { today } = await userClock()
  await prisma.goldPrice.deleteMany({ where: { date: today, source: "manual" } })
  return getGoldQuote()
}

// ─── HOLDINGS ─────────────────────────────────────────────

const KINDS = ["Jewelry", "Coin", "Bar"] as const

export async function getHoldings() {
  return prisma.goldHolding.findMany({ where: { soldAt: null }, orderBy: [{ karat: "desc" }, { createdAt: "asc" }] })
}

/** Holdings + price → totals for the Money page and the Today card. */
export async function getGoldOverview({ refresh = true } = {}) {
  const [holdings, quote] = await Promise.all([getHoldings(), getGoldQuote({ refresh })])
  const gram24 = quote?.gram24 ?? 0
  const valueOf = (h: { grams: number; karat: number }) => h.grams * purity(h.karat) * gram24
  const value = holdings.reduce((s, h) => s + valueOf(h), 0)
  const costed = holdings.filter((h) => h.paid != null)
  const paid = costed.reduce((s, h) => s + (h.paid ?? 0), 0)
  return {
    holdings: holdings.map((h) => ({ ...h, value: quote ? valueOf(h) : null })),
    quote,
    value: quote ? value : null,
    /** Pure-gold grams (24K equivalent) — what zakat's nisab (85 g) is measured in. */
    pureGrams: holdings.reduce((s, h) => s + h.grams * purity(h.karat), 0),
    pureGramsJewelry: holdings.filter((h) => h.kind === "Jewelry").reduce((s, h) => s + h.grams * purity(h.karat), 0),
    grams: holdings.reduce((s, h) => s + h.grams, 0),
    /** Gain only over holdings with a known cost. */
    gain: quote && costed.length ? costed.reduce((s, h) => s + valueOf(h), 0) - paid : null,
    paid: costed.length ? paid : null,
  }
}

function describe(h: { kind: string; karat: number; grams: number; name?: string | null }) {
  const what = h.kind === "Coin" ? `${+(h.grams / GOLD_POUND_GRAMS).toFixed(2)} gold pound${h.grams === GOLD_POUND_GRAMS ? "" : "s"}` : `${+h.grams.toFixed(2)} g ${h.karat}K ${h.kind === "Bar" ? "bar" : "gold"}`
  return h.name ? `${h.name} (${what})` : what
}

interface HoldingInput {
  kind?: string
  karat?: number
  grams?: number
  name?: string | null
  boughtAt?: Date | null
  paid?: number | null
}

function normalise(data: HoldingInput, current?: { kind: string; karat: number }) {
  const kind = data.kind ?? current?.kind ?? "Jewelry"
  if (!KINDS.includes(kind as (typeof KINDS)[number])) throw new BadRequest("Kind must be Jewelry, Coin or Bar")
  // Gold pounds are always 21K, bars 24K
  const karat = kind === "Coin" ? 21 : kind === "Bar" ? 24 : (data.karat ?? current?.karat ?? 21)
  if (!KARATS.includes(karat as (typeof KARATS)[number])) throw new BadRequest("Karat must be 24, 21 or 18")
  if (data.grams !== undefined && !(data.grams > 0)) throw new BadRequest("Weight must be more than 0")
  if (data.paid != null && data.paid < 0) throw new BadRequest("Paid can't be negative")
  return { kind, karat }
}

/**
 * Adds gold. When `fromAccountId` and `paid` are given, the purchase is recorded as a
 * transfer out of that account — money moved into gold, not spending.
 */
export async function createHolding(data: HoldingInput & { grams: number; fromAccountId?: string | null }) {
  const { kind, karat } = normalise(data)
  const { fromAccountId, ...rest } = data
  return prisma.$transaction(async (tx) => {
    let transactionId: string | null = null
    if (fromAccountId && rest.paid) {
      const account = await tx.account.findUnique({ where: { id: fromAccountId } })
      if (!account) throw new BadRequest("Account not found")
      const t = await tx.transaction.create({
        data: {
          type: "Transfer",
          amount: rest.paid,
          currency: account.currency,
          category: "Gold",
          fromAccountId,
          date: rest.boughtAt ?? new Date(),
          description: `Bought ${describe({ ...rest, kind, karat })}`,
        },
      })
      transactionId = t.id
    }
    return tx.goldHolding.create({ data: { ...rest, kind, karat, transactionId } })
  })
}

export async function updateHolding(id: string, data: HoldingInput) {
  const current = await prisma.goldHolding.findUnique({ where: { id } })
  if (!current) throw new BadRequest("Gold item not found")
  const { kind, karat } = normalise(data, current)
  return prisma.goldHolding.update({ where: { id }, data: { ...data, kind, karat } })
}

/** Marks gold as sold; with `toAccountId`, the money is recorded coming into that account. */
export async function sellHolding(id: string, { soldFor, toAccountId, date }: { soldFor: number; toAccountId?: string | null; date?: Date | null }) {
  if (!(soldFor > 0)) throw new BadRequest("Enter what you sold it for")
  const h = await prisma.goldHolding.findUnique({ where: { id } })
  if (!h) throw new BadRequest("Gold item not found")
  if (h.soldAt) throw new BadRequest("Already sold")
  return prisma.$transaction(async (tx) => {
    if (toAccountId) {
      const account = await tx.account.findUnique({ where: { id: toAccountId } })
      if (!account) throw new BadRequest("Account not found")
      await tx.transaction.create({
        data: { type: "Transfer", amount: soldFor, currency: account.currency, category: "Gold", toAccountId, date: date ?? new Date(), description: `Sold ${describe(h)}` },
      })
    }
    return tx.goldHolding.update({ where: { id }, data: { soldAt: date ?? new Date(), soldFor } })
  })
}

/** Removes a gold item. Its purchase transfer goes too, so the money is back in that account. */
export async function deleteHolding(id: string) {
  const h = await prisma.goldHolding.findUnique({ where: { id } })
  if (!h) return
  await prisma.$transaction([
    ...(h.transactionId ? [prisma.transaction.deleteMany({ where: { id: h.transactionId } })] : []),
    prisma.goldHolding.delete({ where: { id } }),
  ])
}
