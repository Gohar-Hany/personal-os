import { prisma } from "@/lib/prisma"
import { userClock } from "@/lib/userTime"
import { getGoldOverview } from "@/lib/finance/goldService"
import type { TransactionType, AccountType, Currency } from "@/types"

// ─── ACCOUNTS ─────────────────────────────────────────────

/** Active accounts with balances computed from their transactions (3 queries total). */
export async function getAccounts() {
  const [accounts, byAccount, outgoing, incoming] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({ by: ["accountId", "type"], where: { accountId: { not: null } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ["fromAccountId"], where: { type: "Transfer", fromAccountId: { not: null } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ["toAccountId"], where: { type: "Transfer", toAccountId: { not: null } }, _sum: { amount: true } }),
  ])

  const delta: Record<string, number> = {}
  for (const r of byAccount) {
    if (!r.accountId) continue
    const amt = r._sum.amount ?? 0
    if (r.type === "Income") delta[r.accountId] = (delta[r.accountId] ?? 0) + amt
    else if (r.type === "Expense" || r.type === "Charity") delta[r.accountId] = (delta[r.accountId] ?? 0) - amt
  }
  for (const r of outgoing) if (r.fromAccountId) delta[r.fromAccountId] = (delta[r.fromAccountId] ?? 0) - (r._sum.amount ?? 0)
  for (const r of incoming) if (r.toAccountId) delta[r.toAccountId] = (delta[r.toAccountId] ?? 0) + (r._sum.amount ?? 0)

  return accounts.map((a) => ({ ...a, currentBalance: a.openingBalance + (delta[a.id] ?? 0) }))
}

export async function createAccount(data: {
  name: string
  type?: AccountType
  currency?: Currency | string
  openingBalance?: number
  color?: string
}) {
  return prisma.account.create({ data })
}

export async function updateAccount(id: string, data: Partial<{
  name: string
  type: AccountType
  currency: string
  openingBalance: number
  isActive: boolean
  color: string | null
}>) {
  return prisma.account.update({ where: { id }, data })
}

/**
 * Removes an account from view. If it has history it's archived (kept for totals),
 * otherwise it's deleted outright.
 */
export async function deleteAccount(id: string) {
  const used = await prisma.transaction.count({
    where: { OR: [{ accountId: id }, { fromAccountId: id }, { toAccountId: id }] },
  })
  if (used > 0) return prisma.account.update({ where: { id }, data: { isActive: false } })
  return prisma.account.delete({ where: { id } })
}

// ─── TRANSACTIONS ──────────────────────────────────────────

/** Month boundaries in the user's time zone (not the server's — it runs in UTC). */
async function monthRange(month: string) {
  return (await userClock()).monthRange(month)
}

export async function currentMonth() {
  return (await userClock()).month
}

const txInclude = {
  account: { select: { id: true, name: true } },
  fromAccount: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
}

export async function getTransactions(filters?: { month?: string; limit?: number }) {
  const [accounts, allTx] = await Promise.all([
    prisma.account.findMany({ select: { id: true, openingBalance: true } }),
    prisma.transaction.findMany({
      include: txInclude,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ])

  const running: Record<string, number> = {}
  for (const a of accounts) {
    running[a.id] = a.openingBalance
  }

  const enriched = allTx.map((tx) => {
    let balanceBefore: number | null = null
    let balanceAfter: number | null = null
    let fromBalanceBefore: number | null = null
    let fromBalanceAfter: number | null = null
    let toBalanceBefore: number | null = null
    let toBalanceAfter: number | null = null

    if (tx.type === "Transfer") {
      if (tx.fromAccountId) {
        fromBalanceBefore = running[tx.fromAccountId] ?? 0
        fromBalanceAfter = fromBalanceBefore - tx.amount
        running[tx.fromAccountId] = fromBalanceAfter
      }
      if (tx.toAccountId) {
        toBalanceBefore = running[tx.toAccountId] ?? 0
        toBalanceAfter = toBalanceBefore + tx.amount
        running[tx.toAccountId] = toBalanceAfter
      }
    } else if (tx.accountId) {
      const cur = running[tx.accountId] ?? 0
      balanceBefore = cur
      if (tx.type === "Income") {
        balanceAfter = cur + tx.amount
      } else {
        balanceAfter = cur - tx.amount
      }
      running[tx.accountId] = balanceAfter
    }

    return {
      ...tx,
      balanceBefore,
      balanceAfter,
      fromBalanceBefore,
      fromBalanceAfter,
      toBalanceBefore,
      toBalanceAfter,
    }
  })

  // Sort descending by date and time
  enriched.sort((a, b) => {
    const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (timeDiff !== 0) return timeDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  let result = enriched
  if (filters?.month) {
    const { start, end } = await monthRange(filters.month)
    result = result.filter((tx) => {
      const d = new Date(tx.date)
      return d >= start && d < end
    })
  }

  if (filters?.limit) {
    result = result.slice(0, filters.limit)
  }

  return result
}

export async function createTransaction(data: {
  type: TransactionType
  amount: number
  currency?: string
  category?: string | null
  accountId?: string | null
  fromAccountId?: string | null
  toAccountId?: string | null
  date?: Date
  description?: string | null
  isCharity?: boolean
}) {
  return prisma.transaction.create({ data, include: txInclude })
}

export async function updateTransaction(id: string, data: Partial<{
  type: TransactionType
  amount: number
  category: string | null
  accountId: string | null
  fromAccountId: string | null
  toAccountId: string | null
  date: Date
  description: string | null
  isCharity: boolean
}>) {
  return prisma.transaction.update({ where: { id }, data, include: txInclude })
}

export async function deleteTransaction(id: string) {
  const debts = await prisma.debt.findMany({ where: { OR: [{ transactionId: id }, { settleTransactionId: id }] } })
  return prisma.$transaction(async (tx) => {
    for (const d of debts) {
      if (d.transactionId === id) {
        // The purchase itself is gone: drop the debt and any repayment
        if (d.settleTransactionId) await tx.transaction.deleteMany({ where: { id: d.settleTransactionId } })
        await tx.debt.delete({ where: { id: d.id } })
      } else {
        // Only the repayment/payment is gone: the debt is open again
        await tx.debt.update({ where: { id: d.id }, data: { settledAt: null, settleTransactionId: null } })
      }
    }
    await tx.transaction.deleteMany({ where: { id } })
    return { ok: true }
  })
}

// ─── SUMMARIES ─────────────────────────────────────────────

/** Category used by "Count cash" / balance corrections. Not real income or spending. */
export const ADJUSTMENT = "Adjustment"
export const NOT_ADJUSTMENT = { OR: [{ category: null }, { category: { not: ADJUSTMENT } }] }

/**
 * Transactions that count as real income/spending: no balance corrections, and no
 * expenses someone else is paying back (those are money owed to me, not my spending).
 */
export async function countedWhere() {
  const owed = await prisma.debt.findMany({ where: { direction: "they_owe", transactionId: { not: null } }, select: { transactionId: true } })
  const ids = owed.map((d) => d.transactionId!)
  return ids.length ? { AND: [NOT_ADJUSTMENT, { id: { notIn: ids } }] } : NOT_ADJUSTMENT
}

export const isCashAccount = (a: { type: string }) => a.type === "Cash"

export async function getMonthSummary(month?: string) {
  month ??= await currentMonth()
  const { start, end } = await monthRange(month)
  const counted = await countedWhere()
  const [byType, byCategory] = await Promise.all([
    prisma.transaction.groupBy({ by: ["type"], where: { date: { gte: start, lt: end }, ...counted }, _sum: { amount: true } }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { type: "Expense", date: { gte: start, lt: end }, ...counted },
      _sum: { amount: true },
    }),
  ])
  const sum = (t: string) => byType.find((r) => r.type === t)?._sum.amount ?? 0
  const income = sum("Income")
  const expenses = sum("Expense")
  const charity = sum("Charity")
  return {
    month,
    income,
    expenses,
    charity,
    savings: income - expenses - charity,
    byCategory: byCategory
      .map((r) => ({ category: r.category || "Other", amount: r._sum.amount ?? 0 }))
      .sort((a, b) => b.amount - a.amount),
  }
}

/** Compact numbers for the Today page. */
export async function getMoneySnapshot() {
  const clock = await userClock()
  const { start: today, end: tomorrow } = clock.day(clock.today)
  const counted = await countedWhere()
  const [accounts, month, spentToday, gold] = await Promise.all([
    getAccounts(),
    getMonthSummary(),
    prisma.transaction.aggregate({
      where: { type: "Expense", date: { gte: today, lt: tomorrow }, ...counted },
      _sum: { amount: true },
    }),
    getGoldOverview({ refresh: false }).catch(() => null),
  ])
  return {
    gold: gold?.holdings.length && gold.value !== null ? gold.value : null,
    totalBalance: accounts.reduce((s, a) => s + a.currentBalance, 0),
    cash: accounts.some(isCashAccount) ? accounts.filter(isCashAccount).reduce((s, a) => s + a.currentBalance, 0) : null,
    spentToday: spentToday._sum.amount ?? 0,
    monthExpenses: month.expenses,
    monthIncome: month.income,
    monthSavings: month.savings,
  }
}
