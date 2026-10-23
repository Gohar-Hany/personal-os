"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckSquare, LayoutGrid, Plus, Sun, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { useApp } from "@/components/app/AppProvider"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { ALL_NAV, isActive } from "@/components/layout/nav"

const PRIMARY = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  null, // the + button
  { href: "/finance", label: "Money", icon: Wallet },
]

/** Bottom bar for phones: 3 destinations, a big + for capture, and "More". */
export function MobileNav() {
  const pathname = usePathname()
  const { quickAdd, inboxCount } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMoreOpen(false)
  }

  const inMore = !PRIMARY.some((i) => i && isActive(i.href, pathname))

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 rounded-[22px] border border-border bg-card/85 shadow-[var(--shadow-pop)] backdrop-blur-xl">
          {PRIMARY.map((item, i) =>
            item ? (
              <NavButton key={item.href} href={item.href} label={item.label} icon={item.icon} active={isActive(item.href, pathname)} />
            ) : (
              <div key={i} className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => quickAdd()}
                  aria-label="Quick add"
                  className="-mt-6 flex size-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-[0_8px_24px_-6px_var(--primary)] ring-4 ring-background transition-transform active:scale-90"
                >
                  <Plus className="size-6" />
                </button>
              </div>
            ),
          )}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex cursor-pointer flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              inMore ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", inMore && "bg-primary-soft")}>
              <LayoutGrid className="size-5" />
            </span>
            More
            {inboxCount > 0 && <span className="absolute top-2.5 right-[calc(50%-18px)] size-2 rounded-full bg-primary ring-2 ring-card" />}
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="Menu">
        <div className="grid grid-cols-3 gap-2 pt-1">
          {ALL_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium",
                isActive(href, pathname) ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-subtle text-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
              {href === "/inbox" && inboxCount > 0 && (
                <span className="absolute top-2 right-2 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground">{inboxCount}</span>
              )}
            </Link>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-subtle px-3 py-2.5">
          <span className="text-[13px] text-muted-foreground">Appearance</span>
          <ThemeToggle />
        </div>
      </Dialog>
    </>
  )
}

function NavButton({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-95", active ? "text-primary" : "text-muted-foreground")}
    >
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}>
        <Icon className="size-5" strokeWidth={active ? 2.3 : 1.8} />
      </span>
      {label}
    </Link>
  )
}
