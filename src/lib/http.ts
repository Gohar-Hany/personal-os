import { NextResponse } from "next/server"

export class BadRequest extends Error {}

/** Wrap a route handler: JSON errors, 400 for BadRequest, 500 otherwise. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      return NextResponse.json(await fn(...args))
    } catch (err) {
      if (err instanceof BadRequest) return NextResponse.json({ error: err.message }, { status: 400 })
      console.error(err)
      return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 })
    }
  }
}

/** Copy only the listed keys that are present in the body. */
export function pick<K extends string>(body: Record<string, unknown>, keys: readonly K[]) {
  const out: Partial<Record<K, unknown>> = {}
  for (const k of keys) if (k in body) out[k] = body[k]
  return out
}

export function requiredString(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} is required`)
  return v.trim()
}

/** undefined stays undefined, ""/null → null, otherwise trimmed string. */
export function optionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}

/** undefined stays undefined, ""/null → null, otherwise a finite number. */
export function optionalNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  const n = Number(v)
  if (!Number.isFinite(n)) throw new BadRequest("Invalid number")
  return n
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  if (v === undefined) return undefined
  if (!allowed.includes(v as T)) throw new BadRequest(`Invalid ${field}`)
  return v as T
}

/** Drop undefined values so Prisma leaves those columns alone. */
export function clean<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>
  }
}
