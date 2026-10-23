import fs from "fs"
import path from "path"

async function run() {
  const logosDir = path.join(process.cwd(), "public", "logos")

  // Download QNB
  const res = await fetch("https://upload.wikimedia.org/wikipedia/commons/8/8f/QNB_Logo.svg", {
    headers: { "User-Agent": "PersonalOS/1.0 (admin@personal-os.local)" },
  })
  if (res.ok) {
    const text = await res.text()
    fs.writeFileSync(path.join(logosDir, "qnb.svg"), text, "utf-8")
    console.log("Saved qnb.svg:", text.length, "bytes")
  } else {
    console.error("QNB download failed:", res.status)
  }
}

run()
