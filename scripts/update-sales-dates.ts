import { createClient } from "@libsql/client"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: ".env.local" })

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

const localDbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")
const localDb = createClient({ url: `file:${localDbPath}` })
const tursoDb = tursoUrl ? createClient({ url: tursoUrl, authToken: tursoAuthToken }) : null

async function executeBoth(sql: string, args: any[] = []) {
  await localDb.execute({ sql, args })
  if (tursoDb) {
    await tursoDb.execute({ sql, args })
  }
}

async function main() {
  console.log("Updating Sales tasks & milestone dates to current week (Oct 24 - Oct 29/31)...")

  // Update Milestones dueDates
  await executeBoth("UPDATE Milestone SET dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%Automation%'")
  await executeBoth("UPDATE Milestone SET dueDate = '2026-10-31T23:59:59.000Z' WHERE title LIKE '%Outreach%'")
  await executeBoth("UPDATE Milestone SET dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%Hot Deals%'")
  await executeBoth("UPDATE Milestone SET dueDate = '2026-10-31T23:59:59.000Z' WHERE title LIKE '%Victoria%'")
  await executeBoth("UPDATE Milestone SET dueDate = '2026-10-31T23:59:59.000Z' WHERE title LIKE '%Mahatet%'")

  // 1. n8n Automation: Scheduled Oct 25, Due Thursday Oct 29
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-25T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[TECH-01]%'"
  )

  // 2. Solo Outreach: From Oct 24 to Thursday Oct 29
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-24T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[OUTREACH-01]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-24T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[SECTOR-01]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-29T00:00:00.000Z', dueDate = '2026-10-31T23:59:59.000Z' WHERE title LIKE '%[SECTOR-02]%'"
  )

  // 3. Hot Deals: Scheduled Oct 25-26, Due Thursday Oct 29
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-25T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-010]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-25T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-026]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-26T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-027]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-26T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-049]%'"
  )

  // 4. Warm Leads: Scheduled Oct 25-27, Due Thursday Oct 29
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-25T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-025]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-25T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-033]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-26T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-028]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-26T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-046]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-27T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-048]%'"
  )
  await executeBoth(
    "UPDATE Task SET scheduledDate = '2026-10-27T00:00:00.000Z', dueDate = '2026-10-29T23:59:59.000Z' WHERE title LIKE '%[KN-051]%'"
  )

  // 5. Cold Leads: Scheduled Oct 27-28, Due Saturday Oct 31
  const coldCodes = [
    "KN-030", "KN-047", "KN-053", "KN-032",
    "KN-029", "KN-052", "KN-054", "KN-002",
    "KN-003", "KN-004", "KN-005", "KN-034"
  ]
  for (const c of coldCodes) {
    await executeBoth(
      `UPDATE Task SET scheduledDate = '2026-10-28T00:00:00.000Z', dueDate = '2026-10-31T23:59:59.000Z' WHERE title LIKE '%[${c}]%'`
    )
  }

  // 6. Dead / Archived leads: Keep scheduledDate and dueDate as null
  await executeBoth("UPDATE Task SET scheduledDate = NULL, dueDate = NULL WHERE title LIKE '%[KN-031]%'")
  await executeBoth("UPDATE Task SET scheduledDate = NULL, dueDate = NULL WHERE title LIKE '%[KN-009]%'")

  console.log("All dates updated successfully!")
  process.exit(0)
}

main().catch((e) => {
  console.error("Error updating dates:", e)
  process.exit(1)
})
