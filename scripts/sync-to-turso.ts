import { createClient, type InValue } from "@libsql/client"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: ".env.local" })

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

if (!tursoUrl || !tursoAuthToken) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local")
  process.exit(1)
}

const localDbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")
const localDb = createClient({ url: `file:${localDbPath}` })
const turso = createClient({ url: tursoUrl, authToken: tursoAuthToken })

async function main() {
  console.log("Connecting to Turso:", tursoUrl)

  // 1. Get all table and index definitions from dev.db
  const schemaRes = await localDb.execute(
    "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations' ORDER BY type DESC"
  )

  const schemaObjects = schemaRes.rows as unknown as { type: string; name: string; tbl_name: string; sql: string }[]
  console.log(`Found ${schemaObjects.length} schema objects in local SQLite.`)

  // 2. Create tables first
  const tables = schemaObjects.filter((o) => o.type === "table")
  for (const t of tables) {
    console.log(`Creating table ${t.name}...`)
    try {
      await turso.execute(t.sql)
    } catch (e: unknown) {
      const err = e as Error
      if (!err.message.includes("already exists")) {
        console.error(`Failed to create table ${t.name}:`, err.message)
      }
    }
  }

  // 3. Create indexes
  const indexes = schemaObjects.filter((o) => o.type === "index")
  for (const idx of indexes) {
    try {
      await turso.execute(idx.sql)
    } catch (e: unknown) {
      const err = e as Error
      if (!err.message.includes("already exists")) {
        console.error(`Index ${idx.name} notice:`, err.message)
      }
    }
  }

  // 4. Copy rows for each table
  for (const t of tables) {
    const res = await localDb.execute(`SELECT * FROM "${t.name}"`)
    const rows = res.rows as unknown as Record<string, InValue>[]
    console.log(`Copying ${rows.length} rows for ${t.name}...`)
    if (rows.length === 0) continue

    const columns = res.columns
    const placeholders = columns.map(() => "?").join(", ")
    const insertSql = `INSERT OR REPLACE INTO "${t.name}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`

    // Batch insert
    for (const row of rows) {
      const args: InValue[] = columns.map((c) => (row[c] !== undefined ? row[c] : null))
      await turso.execute({ sql: insertSql, args })
    }
  }

  console.log("Sync to Turso completed successfully!")
}

main().catch(console.error)
