"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/misc"
import { useApp } from "@/components/app/AppProvider"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { NAV_GROUPS, SETTINGS_ITEM, isActive } from "@/components/layout/nav"

export function Sidebar() {
  const pathname = usePathname()
  const { quickAdd, inboxCount, settings } = useApp()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/60 backdrop-blur-xl lg:flex">
      <Link href="/" className="flex h-14 items-center gap-2.5 px-4">
        <img src="/logo-mark.webp" alt="" className="size-8 rounded-xl object-cover ring-1 ring-border" />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-foreground">{settings.name}</div>
          <div className="text-[11px] text-muted-foreground">Personal OS</div>
        </div>
      </Link>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => quickAdd()}
          className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] transition-colors hover:bg-primary-hover"
        >
          <Plus className="size-4" />
          <span className="flex-1 text-left">Quick add</span>
          <Kbd className="border-white/20 bg-white/15 text-primary-foreground">Ctrl K</Kbd>
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground/80">{group.label}</div>
            <div className="space-y-px">
              {group.items.map(({ href, label, icon: Icon, ...item }) => {
                const active = isActive(href, pathname)
                const badge = "badge" in item && item.badge === "inbox" && inboxCount > 0 ? inboxCount : null
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors",
                      active ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular">{badge}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <Link
          href={SETTINGS_ITEM.href}
          className={cn(
            "flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors",
            isActive(SETTINGS_ITEM.href, pathname) ? "bg-card font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <SETTINGS_ITEM.icon className="size-4" />
          Settings
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  )
}
