import { PrismaClient } from "@prisma/client"
import path from "path"
import fs from "fs"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaLibSql } = require("@prisma/adapter-libsql")

function getDbUrl() {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL
  }

  // On Vercel serverless environments, the source folder is read-only.
  // Use /tmp so SQLite database operations can read and write cleanly.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = path.join("/tmp", "dev.db")
    if (!fs.existsSync(tmpDbPath)) {
      const srcDbPath = path.join(process.cwd(), "prisma", "dev.db")
      if (fs.existsSync(srcDbPath)) {
        try {
          fs.copyFileSync(srcDbPath, tmpDbPath)
        } catch (e) {
          console.error("Failed to copy dev.db to /tmp:", e)
        }
      }
    }
    return `file:${tmpDbPath}`
  }

  // Normalize to forward slashes for libsql file URL
  const dbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")
  return `file:${dbPath}`
}

function createPrismaClient() {
  const url = getDbUrl()
  const authToken = process.env.TURSO_AUTH_TOKEN
  const adapter = new PrismaLibSql({ url, authToken })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma


