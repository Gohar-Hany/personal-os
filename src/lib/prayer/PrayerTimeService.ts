/**
 * PrayerTimeService
 * Wraps the adhan-js library for offline prayer time calculation.
 * Location defaults to Alexandria, Egypt — configurable via settings.
 */

import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
} from "adhan"

export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha"

export interface PrayerTimesResult {
  fajr: Date
  sunrise: Date
  dhuhr: Date
  asr: Date
  maghrib: Date
  isha: Date
}

export interface PrayerLocation {
  latitude: number
  longitude: number
  method?: string
}

const METHOD_MAP: Record<string, ReturnType<typeof CalculationMethod.Egyptian>> = {
  MuslimWorldLeague: CalculationMethod.MuslimWorldLeague(),
  Egyptian: CalculationMethod.Egyptian(),
  Karachi: CalculationMethod.Karachi(),
  UmmAlQura: CalculationMethod.UmmAlQura(),
  Dubai: CalculationMethod.Dubai(),
  MoonsightingCommittee: CalculationMethod.MoonsightingCommittee(),
  NorthAmerica: CalculationMethod.NorthAmerica(),
  Kuwait: CalculationMethod.Kuwait(),
  Qatar: CalculationMethod.Qatar(),
  Singapore: CalculationMethod.Singapore(),
  Tehran: CalculationMethod.Tehran(),
  Turkey: CalculationMethod.Turkey(),
}


// Default: Alexandria, Egypt
const DEFAULT_LOCATION: PrayerLocation = {
  latitude: 31.2001,
  longitude: 29.9187,
  method: "Egyptian",
}

export class PrayerTimeService {
  private location: PrayerLocation

  constructor(location: PrayerLocation = DEFAULT_LOCATION) {
    this.location = location
  }

  getPrayerTimes(date: Date = new Date()): PrayerTimesResult | null {
    try {
      const coords = new Coordinates(this.location.latitude, this.location.longitude)
      const method = this.location.method
        ? METHOD_MAP[this.location.method] ?? METHOD_MAP.Egyptian
        : METHOD_MAP.Egyptian

      const params = method
      const pt = new PrayerTimes(coords, date, params)

      return {
        fajr: pt.fajr,
        sunrise: pt.sunrise,
        dhuhr: pt.dhuhr,
        asr: pt.asr,
        maghrib: pt.maghrib,
        isha: pt.isha,
      }
    } catch (err) {
      console.error("[PrayerTimeService] Failed to calculate prayer times:", err)
      return null
    }
  }

  getCurrentAndNextPrayer(prayerTimes: PrayerTimesResult): {
    current: PrayerName | null
    next: PrayerName | null
    nextTime: Date | null
  } {
    const now = new Date()
    const prayers: Array<{ name: PrayerName; time: Date }> = [
      { name: "fajr", time: prayerTimes.fajr },
      { name: "sunrise", time: prayerTimes.sunrise },
      { name: "dhuhr", time: prayerTimes.dhuhr },
      { name: "asr", time: prayerTimes.asr },
      { name: "maghrib", time: prayerTimes.maghrib },
      { name: "isha", time: prayerTimes.isha },
    ]

    let current: PrayerName | null = null
    let next: PrayerName | null = null
    let nextTime: Date | null = null

    for (let i = 0; i < prayers.length; i++) {
      if (now >= prayers[i].time) {
        current = prayers[i].name
        if (i + 1 < prayers.length) {
          next = prayers[i + 1].name
          nextTime = prayers[i + 1].time
        }
      }
    }

    if (!current) {
      // Before fajr — current is isha from previous day conceptually
      next = prayers[0].name
      nextTime = prayers[0].time
    }

    return { current, next, nextTime }
  }

  formatPrayerTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }
}

export const prayerService = new PrayerTimeService()
