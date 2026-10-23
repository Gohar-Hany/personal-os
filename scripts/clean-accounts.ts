import { prisma } from "../src/lib/prisma"

async function cleanAccounts() {
  console.log("Starting accounts cleanup...")

  // Desired accounts
  const targetAccounts = [
    { name: "CIB Bank", type: "Bank", currency: "EGP", openingBalance: 14000, color: "#003B70" },
    { name: "National Bank of Egypt (NBE)", type: "Bank", currency: "EGP", openingBalance: 5000, color: "#006A4E" },
    { name: "QNB Alahli", type: "Bank", currency: "EGP", openingBalance: 3500, color: "#7A153A" },
    { name: "Orange Cash", type: "DigitalWallet", currency: "EGP", openingBalance: 1200, color: "#FF7900" },
    { name: "Cash Wallet", type: "Cash", currency: "EGP", openingBalance: 1000, color: "#10B981" },
  ]

  // Rename any legacy accounts
  const cibLegacy = await prisma.account.findFirst({ where: { name: { contains: "Bank Account (CIB)" } } })
  if (cibLegacy) {
    await prisma.account.update({ where: { id: cibLegacy.id }, data: { name: "CIB Bank" } })
  }

  // Ensure target accounts exist
  for (const t of targetAccounts) {
    const existing = await prisma.account.findFirst({ where: { name: t.name } })
    if (!existing) {
      await prisma.account.create({ data: t })
    } else {
      await prisma.account.update({ where: { id: existing.id }, data: { type: t.type, color: t.color } })
    }
  }

  // Find CIB to reassign orphan transactions
  const cib = await prisma.account.findFirst({ where: { name: "CIB Bank" } })

  // Delete unwanted accounts
  const allAccounts = await prisma.account.findMany()
  for (const acc of allAccounts) {
    const isTarget = targetAccounts.some((t) => t.name === acc.name)
    if (!isTarget) {
      console.log(`Removing account: ${acc.name}`)
      if (cib) {
        await prisma.transaction.updateMany({ where: { accountId: acc.id }, data: { accountId: cib.id } })
      }
      await prisma.account.delete({ where: { id: acc.id } })
    }
  }

  const final = await prisma.account.findMany({ select: { id: true, name: true, type: true } })
  console.log("FINAL ACCOUNTS IN DATABASE:")
  console.table(final)
}

cleanAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
