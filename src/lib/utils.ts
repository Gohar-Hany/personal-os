import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EGP: "EGP",
  USD: "$",
  SAR: "SAR",
  EUR: "€",
  GBP: "£",
}

export function formatCurrency(amount: number, currency: string = "EGP", opts?: { compact?: boolean }) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const abs = Math.abs(amount)
  const digits = opts?.compact || Number.isInteger(abs) ? 0 : 2
  const num = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const sign = amount < 0 ? "−" : ""
  return symbol.length === 1 ? `${sign}${symbol}${num}` : `${sign}${num} ${symbol}`
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export function calcProgress(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((completed / total) * 100))
}

/** The JSON shape of T: Dates become ISO strings. */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T

/** Next.js can only pass plain JSON to client components. */
export function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value))
}

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`
}
