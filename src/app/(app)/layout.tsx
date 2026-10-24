import { prisma } from "@/lib/prisma"
import { getProjectOptions } from "@/lib/projects/projectService"
import { serialize } from "@/lib/utils"
import { userClock } from "@/lib/userTime"
import { AppProvider } from "@/components/app/AppProvider"
import { Sidebar } from "@/components/layout/Sidebar"
import { MobileNav } from "@/components/layout/MobileNav"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [projects, settings, inboxCount, clock] = await Promise.all([
    getProjectOptions(),
    prisma.userSettings.findUnique({ where: { id: "default" } }),
    prisma.inboxItem.count({ where: { status: "Pending" } }),
    userClock(),
  ])

  return (
    <AppProvider
      projects={serialize(projects)}
      inboxCount={inboxCount}
      today={clock.today}
      tz={clock.tz}
      settings={{
        name: settings?.name ?? "Gohar",
        currency: settings?.defaultCurrency ?? "EGP",
        charityPct: settings?.charityPercentage ?? 5,
      }}
    >
      <div className="min-h-dvh bg-background">
        <Sidebar />
        <div className="lg:pl-60">
          <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 2xl:px-12">{children}</main>
        </div>
        <MobileNav />
      </div>
    </AppProvider>
  )
}
