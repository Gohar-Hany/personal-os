"use client"

import { useSyncExternalStore } from "react"

// One shared minute-ticker for the whole app (clock, greeting, prayer countdown).
let current = new Date()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null

function tick() {
  current = new Date()
  listeners.forEach((l) => l())
  timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    current = new Date()
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}

/** Current time, refreshed on each minute. Null during server render (avoids hydration mismatch). */
export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}
