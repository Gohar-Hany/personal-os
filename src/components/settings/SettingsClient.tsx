"use client"

import { useState } from "react"
import { Check, LocateFixed } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { CURRENCIES } from "@/lib/constants"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/form"
import { PageHeader } from "@/components/ui/misc"
import { useToast } from "@/components/ui/toast"
import { useApp } from "@/components/app/AppProvider"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import type { SettingsDTO } from "@/types"

const PRAYER_METHODS = [
  { value: "Egyptian", label: "Egyptian General Authority" },
  { value: "MuslimWorldLeague", label: "Muslim World League" },
  { value: "UmmAlQura", label: "Umm Al-Qura, Makkah" },
  { value: "Karachi", label: "University of Islamic Sciences, Karachi" },
  { value: "Dubai", label: "Dubai" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "Qatar", label: "Qatar" },
  { value: "Turkey", label: "Diyanet, Turkey" },
  { value: "Singapore", label: "Singapore" },
  { value: "NorthAmerica", label: "ISNA, North America" },
  { value: "MoonsightingCommittee", label: "Moonsighting Committee" },
]

export function SettingsClient({ settings }: { settings: SettingsDTO | null }) {
  const { refresh } = useApp()
  const toast = useToast()
  const initial = {
    name: settings?.name ?? "Gohar",
    location: settings?.location ?? "Alexandria, Egypt",
    timezone: settings?.timezone ?? "Africa/Cairo",
    latitude: String(settings?.latitude ?? 31.2001),
    longitude: String(settings?.longitude ?? 29.9187),
    prayerMethod: settings?.prayerMethod ?? "Egyptian",
    defaultCurrency: settings?.defaultCurrency ?? "EGP",
    charityPercentage: String(settings?.charityPercentage ?? 5),
  }
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/settings", { method: "PATCH", body: form })
      setSaved(form)
      toast.success("Settings saved")
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Location isn't available in this browser")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(4),
          longitude: pos.coords.longitude.toFixed(4),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }))
        setLocating(false)
        toast.info("Location filled in — remember to save")
      },
      () => {
        setLocating(false)
        toast.error("Couldn't get your location")
      },
      { timeout: 10000 },
    )
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" />

      <Section title="Profile">
        <Field label="Your name">
          <Input value={form.name} onChange={(e) => set("name")(e.target.value)} />
        </Field>
      </Section>

      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <span className="text-[13px]">Theme</span>
          <ThemeToggle />
        </div>
      </Section>

      <Section title="Prayer times" description="Times are calculated from your coordinates — no internet needed.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City / label">
            <Input value={form.location} onChange={(e) => set("location")(e.target.value)} />
          </Field>
          <Field label="Calculation method">
            <Select value={form.prayerMethod} onChange={set("prayerMethod")} options={PRAYER_METHODS} />
          </Field>
          <Field label="Latitude">
            <Input inputMode="decimal" value={form.latitude} onChange={(e) => set("latitude")(e.target.value)} />
          </Field>
          <Field label="Longitude">
            <Input inputMode="decimal" value={form.longitude} onChange={(e) => set("longitude")(e.target.value)} />
          </Field>
        </div>
        <Button variant="outline" onClick={useMyLocation} disabled={locating}>
          <LocateFixed /> {locating ? "Locating…" : "Use my current location"}
        </Button>
      </Section>

      <Section title="Money">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Main currency">
            <Select value={form.defaultCurrency} onChange={set("defaultCurrency")} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Suggested charity" hint="Offered as a one-tap donation each time you log income.">
            <div className="relative">
              <Input inputMode="decimal" value={form.charityPercentage} onChange={(e) => set("charityPercentage")(e.target.value)} className="pr-8" />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </Field>
        </div>
      </Section>

      {/* Phones: a floating bar appears only when there's something to save. Desktop: always-visible footer. */}
      <div
        className={cn(
          "sticky bottom-24 z-10 items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 p-2 pl-4 shadow-[var(--shadow-pop)] backdrop-blur lg:bottom-4 lg:flex lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none",
          dirty ? "flex" : "hidden",
        )}
      >
        {dirty ? (
          <span className="mr-auto text-xs text-muted-foreground lg:hidden">Unsaved changes</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3.5" /> All changes saved
          </span>
        )}
        <Button type="submit" variant="primary" size="md" disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  )
}
