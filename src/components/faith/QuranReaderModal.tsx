"use client"

import { useState } from "react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Edit3, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { getQuranPageMeta, TOTAL_QURAN_PAGES } from "@/lib/faith/quranData"

interface QuranReaderModalProps {
  isOpen: boolean
  onClose: () => void
  currentPage: number
  onPageChange: (newPage: number) => Promise<void>
  onCompleteWird: () => Promise<void>
}

export function QuranReaderModal({
  isOpen,
  onClose,
  currentPage,
  onPageChange,
  onCompleteWird,
}: QuranReaderModalProps) {
  // Safe page range: 1 to 604
  const p1 = Math.max(1, Math.min(TOTAL_QURAN_PAGES, currentPage || 1))
  const p2 = Math.min(TOTAL_QURAN_PAGES, p1 + 1)

  const [activeTab, setActiveTab] = useState<1 | 2>(1)
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [manualPageInput, setManualPageInput] = useState(String(p1))
  const [saving, setSaving] = useState(false)
  const [completedAnimation, setCompletedAnimation] = useState(false)

  if (!isOpen) return null

  const activePageNum = activeTab === 1 ? p1 : p2
  const activeMeta = getQuranPageMeta(activePageNum)
  const khatmahPct = ((p2 / TOTAL_QURAN_PAGES) * 100).toFixed(1)

  const handleFinishWird = async () => {
    setSaving(true)
    haptic(30)
    try {
      await onCompleteWird()
      // Advance bookmark by 2 pages for tomorrow
      const nextPage = Math.min(TOTAL_QURAN_PAGES, p1 + 2)
      await onPageChange(nextPage)
      setCompletedAnimation(true)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveManualPage = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseInt(manualPageInput, 10)
    if (!isNaN(num) && num >= 1 && num <= TOTAL_QURAN_PAGES) {
      setSaving(true)
      try {
        await onPageChange(num)
        setIsEditingPage(false)
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/85 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="relative flex flex-col w-full max-w-4xl h-[95vh] max-h-[900px] rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <BookOpen className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground leading-tight">
                  الورد اليومي (صفحتين)
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                  ص {p1} – {p2}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                الجزء {activeMeta.juzNumber} · {activeMeta.surahNameAr} · {khatmahPct}% من الختمة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setManualPageInput(String(p1))
                setIsEditingPage(!isEditingPage)
              }}
              title="تعديل رقم الصفحة"
              className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="تعديل مكان الورد"
            >
              <Edit3 className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Manual Page Selector Bar */}
        {isEditingPage && (
          <form onSubmit={handleSaveManualPage} className="flex items-center gap-2 px-6 py-2.5 bg-muted/60 border-b border-border animate-slide-down">
            <span className="text-xs font-medium text-muted-foreground">الانتقال إلى صفحة:</span>
            <input
              type="number"
              min={1}
              max={604}
              value={manualPageInput}
              onChange={(e) => setManualPageInput(e.target.value)}
              className="h-8 w-20 rounded-lg border border-border bg-card px-2.5 text-center text-sm font-semibold outline-none focus:border-primary"
            />
            <Button variant="primary" size="sm" type="submit" disabled={saving}>
              حفظ وتطبيق
            </Button>
            <button
              type="button"
              onClick={() => setIsEditingPage(false)}
              className="text-xs text-muted-foreground hover:text-foreground mr-2 cursor-pointer"
            >
              إلغاء
            </button>
          </form>
        )}

        {/* Main Body */}
        {completedAnimation ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-in">
            <div className="flex size-20 items-center justify-center rounded-full bg-success-soft text-success shadow-lg">
              <Sparkles className="size-10" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">هنيئاً لك إتمام ورد اليوم 🌿</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              تم تسجيل قراءة صفحتين بنجاح كعادة مكتملة لليوم، وتم نقل مكانك تلقائياً لصفحة {Math.min(TOTAL_QURAN_PAGES, p1 + 2)} لورد الغد إن شاء الله.
            </p>
            <div className="pt-3">
              <Button variant="primary" size="md" onClick={onClose} className="rounded-xl px-8">
                <Check className="size-4 ml-1.5" /> إغلاق
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Page Tab Selector for mobile & quick switch */}
            <div className="flex items-center justify-center gap-2 p-2.5 border-b border-border bg-subtle/50">
              <button
                type="button"
                onClick={() => {
                  haptic(8)
                  setActiveTab(1)
                }}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  activeTab === 1
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>الصفحة الأولى (ص {p1})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic(8)
                  setActiveTab(2)
                }}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  activeTab === 2
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>الصفحة الثانية (ص {p2})</span>
              </button>
            </div>

            {/* Quran Page Viewer (Centered crisp high-res image with dark mode styling) */}
            <div className="relative flex-1 flex items-center justify-center p-3 sm:p-5 overflow-auto bg-muted/20">
              <div className="relative max-w-full max-h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-lg border border-border bg-card">
                <img
                  src={activeMeta.imageUrl}
                  alt={`مصحف المدينة المنورة - صفحة ${activePageNum}`}
                  className="max-h-[68vh] w-auto object-contain select-none dark:invert-[0.93] dark:hue-rotate-180 transition-opacity duration-300"
                  onError={(e) => {
                    // Fallback to Quran.com CDN if needed
                    const target = e.target as HTMLImageElement
                    if (target.src !== activeMeta.fallbackImageUrl) {
                      target.src = activeMeta.fallbackImageUrl
                    }
                  }}
                />
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-border bg-card/80 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground hidden sm:block">
                الصفحة الحالية: <span className="font-semibold text-foreground">{activePageNum}</span> من {TOTAL_QURAN_PAGES}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {activeTab === 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      haptic(8)
                      setActiveTab(2)
                    }}
                    className="flex-1 sm:flex-initial rounded-xl"
                  >
                    الصفحة التالية <ChevronLeft className="size-4 mr-1" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      haptic(8)
                      setActiveTab(1)
                    }}
                    className="flex-1 sm:flex-initial rounded-xl"
                  >
                    <ChevronRight className="size-4 ml-1" /> الصفحة السابقة
                  </Button>
                )}

                <Button
                  variant="primary"
                  onClick={handleFinishWird}
                  disabled={saving}
                  className="flex-1 sm:flex-initial rounded-xl font-bold px-6 shadow-md shadow-primary/20"
                >
                  <Check className="size-4 ml-1.5" /> أتممت الورد اليومي ✨
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
