import { prisma } from "@/lib/prisma"
import { BadRequest } from "@/lib/http"

// Money owed either way.
//  • they_owe — I paid for someone. It's a normal expense in its category (so it
//    reads like any other in the list) but isn't counted as my spending — see
//    countedWhere(). When they pay, a transfer brings the money back.
//  • i_owe — someone paid for me. Nothing moves until I pay them; that payment
//    is my expense, in the category of what they bought.

export const OWED_CATEGORY = "Owed to me"
export const DIRECTIONS = ["they_owe", "i_owe"] as const
export type Direction = (typeof DIRECTIONS)[number]

const what = (d: { description?: string | null; category?: string | null }) => d.description || d.category || "money"

export async function getDebts() {
  const all = await prisma.debt.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] })
  const open = all.filter((d) => !d.settledAt)
  const sum = (dir: Direction) => open.filter((d) => d.direction === dir).reduce((s, d) => s + d.amount, 0)
  return { all, owedToMe: sum("they_owe"), iOwe: sum("i_owe") }
}

export async function createDebt(data: {
  direction: Direction
  person: string
  amount: number
  description?: string | null
  category?: string | null
  date?: Date | null
  /** they_owe: the account I paid from. */
  accountId?: string | null
}) {
  if (!DIRECTIONS.includes(data.direction)) throw new BadRequest("Pick who owes whom")
  if (!data.person.trim()) throw new BadRequest("Who is it?")
  if (!(data.amount > 0)) throw new BadRequest("Enter the amount")
  const { accountId, ...rest } = data
  const date = rest.date ?? new Date()

  return prisma.$transaction(async (tx) => {
    let transactionId: string | null = null
    let currency = "EGP"
    if (data.direction === "they_owe" && accountId) {
      const account = await tx.account.findUnique({ where: { id: accountId } })
      if (!account) throw new BadRequest("Account not found")
      currency = account.currency
      const t = await tx.transaction.create({
        data: { type: "Expense", amount: data.amount, currency, category: rest.category || "Other", accountId, date, description: rest.description || null },
      })
      transactionId = t.id
    }
    return tx.debt.create({ data: { ...rest, person: rest.person.trim(), date, currency, transactionId } })
  })
}

/**
 * Close a debt. they_owe: the money comes back into `accountId`.
 * i_owe: I pay from `accountId`, recorded as my expense.
 * Without an account it's just marked settled (e.g. settled some other way).
 */
export async function settleDebt(id: string, { accountId, date }: { accountId?: string | null; date?: Date | null }) {
  const debt = await prisma.debt.findUnique({ where: { id } })
  if (!debt) throw new BadRequest("Not found")
  if (debt.settledAt) throw new BadRequest("Already settled")
  const when = date ?? new Date()
  if (accountId === undefined && debt.transactionId) {
    // (purchases logged before this was an expense were transfers: fromAccountId)
    const bought = await prisma.transaction.findUnique({ where: { id: debt.transactionId }, select: { accountId: true, fromAccountId: true } })
    accountId = bought?.accountId ?? bought?.fromAccountId ?? null
  }

  return prisma.$transaction(async (tx) => {
    let settleTransactionId: string | null = null
    if (accountId) {
      const account = await tx.account.findUnique({ where: { id: accountId } })
      if (!account) throw new BadRequest("Account not found")
      const t =
        debt.direction === "they_owe"
          ? await tx.transaction.create({
              data: { type: "Transfer", amount: debt.amount, currency: account.currency, category: OWED_CATEGORY, toAccountId: accountId, date: when, description: `${debt.person} paid back · ${what(debt)}` },
            })
          : await tx.transaction.create({
              data: { type: "Expense", amount: debt.amount, currency: account.currency, category: debt.category || "Other", accountId, date: when, description: debt.description || null },
            })
      settleTransactionId = t.id
    }
    return tx.debt.update({ where: { id }, data: { settledAt: when, settleTransactionId } })
  })
}

/** Reopen a settled debt: its settling transaction is removed. */
export async function reopenDebt(id: string) {
  const debt = await prisma.debt.findUnique({ where: { id } })
  if (!debt) throw new BadRequest("Not found")
  return prisma.$transaction(async (tx) => {
    if (debt.settleTransactionId) await tx.transaction.deleteMany({ where: { id: debt.settleTransactionId } })
    return tx.debt.update({ where: { id }, data: { settledAt: null, settleTransactionId: null } })
  })
}

/** Remove a debt and every transaction it created, so balances are as if it never happened. */
export async function deleteDebt(id: string) {
  const debt = await prisma.debt.findUnique({ where: { id } })
  if (!debt) return
  const txIds = [debt.transactionId, debt.settleTransactionId].filter((x): x is string => !!x)
  await prisma.$transaction([
    ...(txIds.length ? [prisma.transaction.deleteMany({ where: { id: { in: txIds } } })] : []),
    prisma.debt.delete({ where: { id } }),
  ])
}
