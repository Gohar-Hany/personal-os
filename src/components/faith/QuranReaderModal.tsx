"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic, useMediaQuery } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/form"
import { ReaderShell } from "@/components/faith/ReaderShell"
import { SURAH_PAGES, getQuranPageMeta, TOTAL_QURAN_PAGES } from "@/lib/faith/quranData"

interface QuranReaderModalProps {
  isOpen: boolean
  onClose: () => void
  /** Bookmark: the first page of the next portion to read. */
  currentPage: number
  onPageChange: (newPage: number) => Promise<void>
  onCompleteWird: () => Promise<void>
  /** Pages in the daily portion (the Quran habit's target). */
  pagesPerDay?: number
  /** Today's portion is already done — open it for review, don't advance again. */
  doneToday?: boolean
}

const clamp = (p: number) => Math.max(1, Math.min(TOTAL_QURAN_PAGES, p))

export function QuranReaderModal({
  isOpen,
  onClose,
  currentPage,
  onPageChange,
  onCompleteWird,
  pagesPerDay = 2,
  doneToday = false,
}: QuranReaderModalProps) {
  const wide = useMediaQuery("(min-width: 1024px)")
  const per = Math.max(1, Math.round(pagesPerDay))
  // When already done, the bookmark has moved past today's portion — show that portion again.
  const startNow = clamp(doneToday ? currentPage - per : currentPage)

  const [page, setPage] = useState(startNow)
  // Last page read continuously from the start of today's portion (jumping elsewhere doesn't count)
  const [furthest, setFurthest] = useState(startNow - 1)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  // Freeze today's portion when the reader opens, so saving (which changes the props) doesn't reset it
  const [session, setSession] = useState<{ start: number; review: boolean } | null>(null)
  if (isOpen && !session) {
    setSession({ start: startNow, review: doneToday })
    setPage(startNow)
    setFurthest(startNow - 1)
    setFinished(false)
  } else if (!isOpen && session) {
    setSession(null)
  }
  const wirdStart = session?.start ?? startNow
  const wirdEnd = clamp(wirdStart + per - 1)
  const reviewing = session?.review ?? doneToday

  // Spread on desktop: odd page on the right (first in RTL), like a printed mushaf
  const spreadStart = page % 2 === 1 ? page : page - 1
  const visible = wide ? [spreadStart, spreadStart + 1].filter((p) => p >= 1 && p <= TOTAL_QURAN_PAGES) : [page]
  const step = wide ? 2 : 1
  const lastVisible = visible[visible.length - 1]

  // Pages on screen count as read only if they continue on from what was read before
  const furthestRead = visible[0] <= furthest + 1 ? Math.max(furthest, lastVisible) : furthest

  const turn = (dir: 1 | -1) => {
    const next = clamp((wide ? spreadStart : page) + dir * step)
    if (next === page) return
    haptic(6)
    if (dir === 1) setFurthest(furthestRead)
    setPage(next)
  }

  // Preload neighbours so turning a page is instant
  const firstVisible = visible[0]
  useEffect(() => {
    if (!isOpen) return
    for (const p of [lastVisible + 1, lastVisible + 2, firstVisible - 1]) {
      if (p >= 1 && p <= TOTAL_QURAN_PAGES) {
        const img = new Image()
        img.src = getQuranPageMeta(p).imageUrl
      }
    }
  }, [isOpen, lastVisible, firstVisible])

  // Keyboard (RTL: ← next, → previous)
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return
      if (e.key === "ArrowLeft") turn(1)
      if (e.key === "ArrowRight") turn(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const finish = async () => {
    setSaving(true)
    haptic(30)
    try {
      await onCompleteWird()
      // Bookmark moves past today's portion — or past wherever you read to, if further
      await onPageChange(clamp(Math.max(wirdEnd, furthestRead) + 1))
      setFinished(true)
    } finally {
      setSaving(false)
    }
  }

  const jump = (p: number) => setPage(clamp(p))

  const meta = getQuranPageMeta(visible[0])
  const inWird = visible.some((p) => p >= wirdStart && p <= wirdEnd)
  const readPct = Math.round((lastVisible / TOTAL_QURAN_PAGES) * 100)

  return (
    <ReaderShell
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={meta.surahNameAr}
      subtitle={
        <span className="tabular">
          الجزء {meta.juzNumber} · صفحة {visible.join("–")} من {TOTAL_QURAN_PAGES} · ورد اليوم ص {wirdStart}
          {wirdEnd !== wirdStart && `–${wirdEnd}`}
        </span>
      }
      progress={readPct}
      actions={
        <div className="w-36 sm:w-56" dir="ltr">
          <Select
            size="sm"
            value=""
            onChange={(v) => v && jump(Number(v))}
            placeholder="انتقل إلى سورة…"
            title="السور"
            aria-label="انتقل إلى سورة"
            searchable
            options={SURAH_PAGES.map((s) => ({ value: String(s.page), label: `${s.no}. ${s.name}`, hint: `ص ${s.page}` }))}
          />
        </div>
      }
      footer={
        finished ? undefined : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" className="h-11 rounded-xl" onClick={() => turn(-1)} disabled={visible[0] <= 1} aria-label="الصفحة السابقة">
              <ChevronRight /> <span className="hidden sm:inline">السابقة</span>
            </Button>
            <div className="flex min-w-0 flex-1 flex-col items-center text-xs text-muted-foreground">
              {reviewing ? (
                <span className="inline-flex items-center gap-1 font-medium text-success"><Check className="size-3.5" /> أتممت ورد اليوم — هذه مراجعة</span>
              ) : (
                <span className="tabular">{inWird ? "أنت في ورد اليوم" : furthestRead > wirdEnd ? `قرأت حتى ص ${furthestRead}` : `ورد اليوم يبدأ من ص ${wirdStart}`}</span>
              )}
            </div>
            <Button variant="outline" size="md" className="h-11 rounded-xl" onClick={() => turn(1)} disabled={lastVisible >= TOTAL_QURAN_PAGES} aria-label="الصفحة التالية">
              <span className="hidden sm:inline">التالية</span> <ChevronLeft />
            </Button>
            {!reviewing && (
              <Button variant="primary" size="md" className="h-11 rounded-xl px-5 font-semibold" onClick={finish} disabled={saving}>
                <Check /> أتممت الورد
              </Button>
            )}
          </div>
        )
      }
    >
      {finished ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-success-soft text-success"><Sparkles className="size-10" /></div>
          <h3 className="font-arabic text-3xl font-bold">هنيئاً لك، تقبّل الله</h3>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            تم تسجيل ورد اليوم. ورد الغد يبدأ من صفحة {clamp(Math.max(wirdEnd, furthestRead) + 1)} إن شاء الله.
          </p>
          <Button variant="primary" size="md" onClick={onClose} className="rounded-xl px-8">تم</Button>
        </div>
      ) : (
        <Pages pages={visible} wirdStart={wirdStart} wirdEnd={wirdEnd} onSwipe={turn} />
      )}
    </ReaderShell>
  )
}

/** The page images on warm paper, with a loading state and swipe on touch screens. */
function Pages({ pages, wirdStart, wirdEnd, onSwipe }: { pages: number[]; wirdStart: number; wirdEnd: number; onSwipe: (dir: 1 | -1) => void }) {
  const start = useRef<number | null>(null)
  return (
    <div
      className="flex h-full touch-pan-y items-stretch justify-center gap-0 overflow-auto bg-[#efe9dd] p-2 sm:p-4 dark:bg-[#16150f]"
      onTouchStart={(e) => (start.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (start.current === null) return
        const dx = e.changedTouches[0].clientX - start.current
        start.current = null
        // RTL book: swiping right turns forward
        if (Math.abs(dx) > 60) onSwipe(dx > 0 ? 1 : -1)
      }}
    >
      {pages.map((p, i) => (
        <QuranPage key={p} page={p} inWird={p >= wirdStart && p <= wirdEnd} side={pages.length === 2 ? (i === 0 ? "right" : "left") : "single"} />
      ))}
    </div>
  )
}

function QuranPage({ page, inWird, side }: { page: number; inWird: boolean; side: "right" | "left" | "single" }) {
  const meta = getQuranPageMeta(page)
  const [loaded, setLoaded] = useState(false)
  const [src, setSrc] = useState(meta.imageUrl)
  return (
    <figure
      className={cn(
        "relative flex max-h-full min-w-0 flex-1 flex-col items-center justify-center bg-[#fbf7ee] shadow-[0_2px_16px_-6px_rgb(60_40_10/0.35)] dark:bg-[#1d1c17]",
        side === "right" && "rounded-r-xl border-l border-[#e5dcc8] dark:border-[#2c2a22]",
        side === "left" && "rounded-l-xl",
        side === "single" && "rounded-xl",
        "max-w-[560px]",
      )}
    >
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#a8957a]">
          <BookOpen className="size-8 animate-pulse" />
          <span className="text-xs">جارٍ تحميل الصفحة…</span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`مصحف المدينة — صفحة ${page}`}
        onLoad={() => setLoaded(true)}
        onError={() => src !== meta.fallbackImageUrl && setSrc(meta.fallbackImageUrl)}
        draggable={false}
        className={cn("h-full max-h-full w-auto object-contain p-3 transition-opacity duration-300 select-none dark:invert-[0.88] dark:sepia-[0.15]", loaded ? "opacity-100" : "opacity-0")}
      />
      <figcaption className={cn("absolute bottom-1.5 rounded-full px-2 text-[10px] tabular", inWird ? "bg-primary-soft text-primary" : "text-[#a8957a]")}>
        {page}
      </figcaption>
    </figure>
  )
}
