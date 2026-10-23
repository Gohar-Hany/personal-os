import { Activity, CheckSquare, FolderKanban, Inbox, RefreshCw, Settings, Sun, Target, Wallet } from "lucide-react"

export const NAV_GROUPS = [
  {
    label: "Plan",
    items: [
      { href: "/", label: "Today", icon: Sun },
      { href: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/goals", label: "Goals", icon: Target },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/habits", label: "Habits", icon: Activity },
      { href: "/finance", label: "Money", icon: Wallet },
      { href: "/weekly-review", label: "Weekly review", icon: RefreshCw },
    ],
  },
]

export const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: Settings }

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM]

export function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}
