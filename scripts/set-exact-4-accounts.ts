import { prisma } from "../src/lib/prisma"

async function setExact4Accounts() {
  console.log("Configuring exact 4 accounts...")

  const targetAccounts = [
    { name: "CIB", type: "Bank", currency: "EGP", openingBalance: 14000, color: "#003B70" },
    { name: "QNB", type: "Bank", currency: "EGP", openingBalance: 3500, color: "#7A153A" },
    { name: "Al Ahly", type: "Bank", currency: "EGP", openingBalance: 5000, color: "#006A4E" },
    { name: "Orange Cash Wallet", type: "DigitalWallet", currency: "EGP", openingBalance: 1200, color: "#FF7900" },
  ]

  // Update existing or create target accounts
  for (const t of targetAccounts) {
    const existing = await prisma.account.findFirst({
      where: {
        OR: [
          { name: t.name },
          { name: { contains: t.name } },
          ...(t.name === "Al Ahly" ? [{ name: { contains: "Egypt" } }, { name: { contains: "NBE" } }, { name: { contains: "أهلي" } }] : []),
          ...(t.name === "Orange Cash Wallet" ? [{ name: { contains: "Orange" } }] : []),
        ],
      },
    })

    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { name: t.name, type: t.type, color: t.color },
      })
    } else {
      await prisma.account.create({ data: t })
    }
  }

  // Find CIB as fallback for orphaned transactions
  const cib = await prisma.account.findFirst({ where: { name: "CIB" } })

  // Remove any accounts not in the 4 target names
  const all = await prisma.account.findMany()
  for (const acc of all) {
    const isTarget = targetAccounts.some((t) => t.name === acc.name)
    if (!isTarget) {
      console.log(`Deleting extra account: ${acc.name}`)
      if (cib) {
        await prisma.transaction.updateMany({ where: { accountId: acc.id }, data: { accountId: cib.id } })
      }
      await prisma.account.delete({ where: { id: acc.id } })
    }
  }

  const final = await prisma.account.findMany()
  console.log("FINAL 4 ACCOUNTS IN DB:", final.map((f) => f.name))
}

setExact4Accounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
