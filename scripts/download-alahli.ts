import fs from "fs"
import path from "path"

async function run() {
  const logosDir = path.join(process.cwd(), "public", "logos")
  const url = "https://upload.wikimedia.org/wikipedia/commons/f/fc/NBE_logo.png"

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  })

  if (res.ok) {
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(path.join(logosDir, "alahli.png"), buffer)
    fs.writeFileSync(path.join(logosDir, "nbe.png"), buffer)
    console.log("Successfully downloaded NBE logo:", buffer.length, "bytes")
  } else {
    console.error("Failed to download NBE logo:", res.status, res.statusText)
  }
}

run()
