import { BadRequest, optionalString, oneOf } from "@/lib/http"
import { parseDateInput } from "@/lib/dates"
import { TRANSACTION_TYPES } from "@/lib/constants"

/** Validate a transaction body. `partial` is for PATCH (only sent fields). */
export function parseTransaction(b: Record<string, unknown>, partial: boolean) {
  const type = oneOf(b.type, TRANSACTION_TYPES, "type") ?? (partial ? undefined : "Expense")
  let amount: number | undefined
  if (b.amount !== undefined || !partial) {
    amount = Number(b.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequest("Enter an amount greater than zero")
  }
  const isTransfer = type === "Transfer"
  const fromAccountId = optionalString(b.fromAccountId)
  const toAccountId = optionalString(b.toAccountId)
  if (isTransfer && !partial) {
    if (!fromAccountId || !toAccountId) throw new BadRequest("Choose both accounts for a transfer")
    if (fromAccountId === toAccountId) throw new BadRequest("Choose two different accounts")
  }
  const date = parseDateInput(b.date)
  return {
    type,
    amount,
    category: optionalString(b.category),
    description: optionalString(b.description),
    // A transfer uses from/to; everything else uses a single account
    accountId: type === undefined ? optionalString(b.accountId) : isTransfer ? null : optionalString(b.accountId),
    fromAccountId: type === undefined ? fromAccountId : isTransfer ? fromAccountId : null,
    toAccountId: type === undefined ? toAccountId : isTransfer ? toAccountId : null,
    isCharity: type === undefined ? undefined : type === "Charity",
    date: date ?? undefined,
  }
}
