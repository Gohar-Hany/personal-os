import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/utils"
import { InboxClient } from "@/components/inbox/InboxClient"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const items = await prisma.inboxItem.findMany({
    where: { status: { not: "Archived" } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return <InboxClient items={serialize(items)} />
}
