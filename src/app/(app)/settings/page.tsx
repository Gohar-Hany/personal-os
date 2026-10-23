import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/utils"
import { SettingsClient } from "@/components/settings/SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const settings = await prisma.userSettings.findUnique({ where: { id: "default" } })
  return <SettingsClient settings={settings ? serialize(settings) : null} />
}
