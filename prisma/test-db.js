const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const { createClient } = require('@libsql/client')
const path = require('path')

const DB_PATH = 'D:/Tracker/personal-os/prisma/dev.db'
console.log('DB:', DB_PATH)

const adapter = new PrismaLibSql({ url: `file:${DB_PATH}` })
const p = new PrismaClient({ adapter })

p.userSettings.upsert({
  where: { id: 'default' },
  create: { id: 'default', name: 'Ahmed' },
  update: {}
}).then(r => {
  console.log('OK:', r.id)
  return p.$disconnect()
}).catch(e => {
  console.error('ERR:', e.message)
  process.exit(1)
})
