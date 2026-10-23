import { createClient } from "@libsql/client"
import fs from "fs"
import path from "path"

const envPath = path.join(process.cwd(), ".env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
const env = {}
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let value = match[2] || ""
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    env[match[1]] = value
  }
}

const tursoUrl = env.TURSO_DATABASE_URL
const tursoAuthToken = env.TURSO_AUTH_TOKEN

console.log("Local DB: file:prisma/dev.db")
console.log("Turso Cloud URL:", tursoUrl)

const localDb = createClient({ url: "file:prisma/dev.db" })
const turso = createClient({ url: tursoUrl, authToken: tursoAuthToken })

async function run() {
  const schemaRes = await localDb.execute(
    "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations' ORDER BY type DESC"
  )

  const schemaObjects = schemaRes.rows
  console.log(`Found ${schemaObjects.length} schema objects.`)

  const tables = schemaObjects.filter((o) => o.type === "table")
  for (const t of tables) {
    console.log(`Creating table: ${t.name}`)
    try {
      await turso.execute(String(t.sql))
    } catch (e) {
      if (!e.message.includes("already exists")) {
        console.error(`Error creating table ${t.name}:`, e.message)
      }
    }
  }

  const indexes = schemaObjects.filter((o) => o.type === "index")
  for (const idx of indexes) {
    try {
      await turso.execute(String(idx.sql))
    } catch (e) {
      if (!e.message.includes("already exists")) {
        console.error(`Index notice ${idx.name}:`, e.message)
      }
    }
  }

  for (const t of tables) {
    const res = await localDb.execute(`SELECT * FROM "${t.name}"`)
    const rows = res.rows
    console.log(`Copying ${rows.length} rows for ${t.name}...`)
    if (rows.length === 0) continue

    const columns = res.columns
    const placeholders = columns.map(() => "?").join(", ")
    const insertSql = `INSERT OR REPLACE INTO "${t.name}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`

    for (const row of rows) {
      const args = columns.map((c) => row[c] ?? null)
      await turso.execute({ sql: insertSql, args })
    }
  }

  console.log("SUCCESS! All tables and data synced to Turso Cloud!")
}

run().catch((e) => {
  console.error("FATAL ERROR:", e)
  process.exit(1)
})
