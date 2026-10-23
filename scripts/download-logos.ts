import fs from "fs"
import path from "path"

async function downloadSvg(url: string, dest: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PersonalOS/1.0 (https://personal-os.local; admin@personal-os.local)",
      },
    })
    if (!res.ok) {
      console.error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
      return false
    }
    const text = await res.text()
    fs.writeFileSync(dest, text, "utf-8")
    console.log(`Saved: ${dest} (${text.length} bytes)`)
    return true
  } catch (err) {
    console.error(`Error downloading ${url}:`, err)
    return false
  }
}

async function run() {
  const logosDir = path.join(process.cwd(), "public", "logos")
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true })
  }

  // 1. CIB
  await downloadSvg("https://upload.wikimedia.org/wikipedia/commons/b/b1/Cib_Logo.svg", path.join(logosDir, "cib.svg"))

  // 2. QNB
  await downloadSvg("https://upload.wikimedia.org/wikipedia/commons/d/d4/QNB_Logo.svg", path.join(logosDir, "qnb.svg"))

  // 3. Orange
  await downloadSvg("https://upload.wikimedia.org/wikipedia/commons/c/c8/Orange_logo.svg", path.join(logosDir, "orange.svg"))

  // 4. NBE (National Bank of Egypt)
  await downloadSvg("https://upload.wikimedia.org/wikipedia/commons/e/ea/National_Bank_of_Egypt.svg", path.join(logosDir, "nbe.svg"))
}

run()
