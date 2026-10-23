"use client"

import { Banknote, Landmark, PiggyBank, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-7 rounded-lg [&_svg]:size-3.5",
  md: "size-10 rounded-xl [&_svg]:size-5",
  lg: "size-12 rounded-2xl [&_svg]:size-6",
}

const BRANDS = [
  { match: ["qnb"], src: "/logos/qnb-burgundy.svg", bg: "bg-[#4B0C27]", label: "QNB" },
  { match: ["cib"], src: "/logos/cib-blue.svg", bg: "bg-[#004B8D]", label: "CIB" },
  { match: ["ahly", "ahli", "أهلي", "الأهلي", "nbe", "national bank"], src: "/logos/alahli-green.svg", bg: "bg-[#006A4E]", label: "Al Ahly" },
  { match: ["orange", "اورانج", "أورانج"], src: "/logos/orange-cash.svg", bg: "bg-[#FF7900]", label: "Orange Cash" },
]

/** Account avatar: the bank's real logo when known, otherwise an icon for the account type. */
export function BankLogo({
  name,
  type,
  size = "md",
  className,
}: {
  name: string
  type?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const lower = name.toLowerCase()
  const brand = BRANDS.find((b) => b.match.some((m) => lower.includes(m)))

  if (brand) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden p-0.5 ring-1 ring-black/5 select-none", SIZES[size], brand.bg, className)} title={brand.label}>
        <img src={brand.src} alt={brand.label} className="size-full object-contain" />
      </span>
    )
  }

  const isCash = type === "Cash" || /cash|كاش|نقد/.test(lower)
  const kind = isCash ? "cash" : type === "Wallet" || type === "DigitalWallet" ? "wallet" : type === "Other" ? "other" : "bank"
  const style = {
    cash: { icon: <Banknote />, cls: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white" },
    wallet: { icon: <Wallet />, cls: "bg-gradient-to-br from-violet-400 to-violet-600 text-white" },
    bank: { icon: <Landmark />, cls: "bg-gradient-to-br from-sky-400 to-blue-600 text-white" },
    other: { icon: <PiggyBank />, cls: "bg-gradient-to-br from-amber-400 to-orange-500 text-white" },
  }[kind]

  return (
    <span className={cn("flex shrink-0 items-center justify-center shadow-sm select-none", SIZES[size], style.cls, className)} aria-hidden>
      {style.icon}
    </span>
  )
}
