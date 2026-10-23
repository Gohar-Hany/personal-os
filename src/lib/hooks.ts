"use client"

import { useState, useSyncExternalStore } from "react"

/**
 * Local state that resets whenever the server sends a new value
 * (e.g. after router.refresh()). Lets pages be optimistic but never stale.
 */
export function useSynced<T>(value: T) {
  const [state, setState] = useState(value)
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setState(value)
  }
  return [state, setState] as const
}

const MOBILE_QUERY = "(max-width: 639px)"

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

/** True on phone-sized screens. Pickers and menus become bottom sheets there. */
export function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false)
}

/** A short tap of the vibration motor on phones that support it. */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {}
}
