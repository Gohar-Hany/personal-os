import type { Metadata, Viewport } from "next"
import { Amiri, Inter } from "next/font/google"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import "./globals.css"

// Classic Naskh for Quran and adhkar text — far more readable than a generic serif
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-amiri",
})

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Gohar | Personal OS",
  description: "Personal life and productivity operating system",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-mark.webp", type: "image/webp" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gohar OS",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${amiri.variable}`}>
      <body className="font-sans text-sm">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
