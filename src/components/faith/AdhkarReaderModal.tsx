"use client"

import { useEffect, useState } from "react"
import { Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { MORNING_ADHKAR, EVENING_ADHKAR, type DhikrItem } from "@/lib/faith/adhkarData"

interface AdhkarReaderModalProps {
  isOpen: boolean
  onClose: () => void
  type: "morning" | "evening"
  onComplete?: () => void
}

export function AdhkarReaderModal({ isOpen, onClose, type, onComplete }: AdhkarReaderModalProps) {
  const list = type === "morning" ? MORNING_ADHKAR : EVENING_ADHKAR
  const title = type === "morning" ? "أذكار الصباح" : "أذكار المساء"

  const [currentIndex, setCurrentIndex] = useState(0)
  // Track remaining counts for each dhikr
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [completedDhikrs, setCompletedDhikrs] = useState<Record<string, boolean>>({})
  const [isDoneAll, setIsDoneAll] = useState(false)
  const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false)

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0)
      const initialCounts: Record<string, number> = {}
      list.forEach((d) => {
        initialCounts[d.id] = d.count
      })
      setCounts(initialCounts)
      setCompletedDhikrs({})
      setIsDoneAll(false)
      setHasNotifiedComplete(false)
    }
  }, [isOpen, list])

  if (!isOpen) return null

  const currentItem: DhikrItem = list[currentIndex] || list[0]
  const currentRemaining = counts[currentItem.id] ?? currentItem.count
  const isCurrentFinished = currentRemaining <= 0 || completedDhikrs[currentItem.id]

  const totalDhikrs = list.length
  const completedCount = Object.values(completedDhikrs).filter(Boolean).length
  const progressPct = Math.round((completedCount / totalDhikrs) * 100)

  const handleTap = () => {
    if (isCurrentFinished) return

    haptic(12)
    const nextCount = Math.max(0, currentRemaining - 1)
    setCounts((prev) => ({ ...prev, [currentItem.id]: nextCount }))

    if (nextCount === 0) {
      haptic(25)
      setCompletedDhikrs((prev) => {
        const updated = { ...prev, [currentItem.id]: true }
        // Check if all are done
        const totalDone = Object.values(updated).filter(Boolean).length
        if (totalDone === totalDhikrs) {
          setIsDoneAll(true)
          if (!hasNotifiedComplete) {
            setHasNotifiedComplete(true)
            onComplete?.()
          }
        }
        return updated
      })

      // Auto advance to next unfinished dhikr after 400ms
      setTimeout(() => {
        if (currentIndex < totalDhikrs - 1) {
          setCurrentIndex((idx) => idx + 1)
        }
      }, 350)
    }
  }

  const handleResetCurrent = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCounts((prev) => ({ ...prev, [currentItem.id]: currentItem.count }))
    setCompletedDhikrs((prev) => ({ ...prev, [currentItem.id]: false }))
    setIsDoneAll(false)
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentIndex < totalDhikrs - 1) setCurrentIndex((i) => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="relative flex flex-col w-full max-w-xl h-[92vh] max-h-[800px] rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary font-semibold text-sm">
              {currentIndex + 1} / {totalDhikrs}
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
              <p className="text-xs text-muted-foreground">{completedCount} من {totalDhikrs} مكتمل</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-gradient-to-l from-primary to-success transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Body Content */}
        {isDoneAll ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-in">
            <div className="flex size-20 items-center justify-center rounded-full bg-success-soft text-success shadow-lg">
              <Sparkles className="size-10" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">تقبّل الله طاعتكم ✨</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              تم إتمام جميع {title} بنجاح وحفظها كإنجاز في وردك اليومي. بارك الله في يومك ورزقك بركته وحفظه.
            </p>
            <div className="pt-4">
              <Button variant="primary" size="md" onClick={onClose} className="rounded-xl px-8">
                <Check className="size-4 ml-1.5" /> تم وإنهاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-7 space-y-5">
            {/* Dhikr Title if available */}
            {currentItem.title && (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  {currentItem.title}
                </span>
                <button
                  type="button"
                  onClick={handleResetCurrent}
                  title="إعادة تعيين الذكر الحالي"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <RotateCcw className="size-3.5" /> إعادة البدء
                </button>
              </div>
            )}

            {/* Dhikr Arabic Text Card (Tappable on mobile/desktop) */}
            <div
              onClick={handleTap}
              className={cn(
                "relative flex-1 flex flex-col justify-center rounded-2xl p-6 sm:p-7 border transition-all cursor-pointer select-none",
                isCurrentFinished
                  ? "border-success/40 bg-success-soft/30 shadow-sm"
                  : "border-border bg-subtle hover:border-primary/40 hover:bg-card active:scale-[0.99] shadow-sm"
              )}
            >
              <div className="space-y-4 text-center my-auto">
                <p className="font-serif text-lg sm:text-xl md:text-2xl font-medium leading-[2.2] tracking-wide text-foreground whitespace-pre-line">
                  {currentItem.text}
                </p>

                {/* Virtue / Benefit */}
                {currentItem.virtue && (
                  <div className="inline-block rounded-xl bg-success-soft/80 border border-success/20 px-3.5 py-1.5 text-xs font-medium text-success">
                    🌿 {currentItem.virtue}
                  </div>
                )}

                {/* Source Reference */}
                {currentItem.reference && (
                  <p className="text-[11px] text-muted-foreground/80 italic">
                    {currentItem.reference}
                  </p>
                )}
              </div>

              {/* Tappable Helper hint */}
              <div className="pt-4 text-center">
                <span className="text-[11px] text-muted-foreground/60">
                  {isCurrentFinished ? "تم إتمام هذا الذكر ✓" : "اضغط في أي مكان لاحتساب الذكر"}
                </span>
              </div>
            </div>

            {/* Counter and Navigation Bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex size-12 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="الذكر السابق"
              >
                <ChevronRight className="size-5" />
              </button>

              {/* Central Big Counter Button */}
              <button
                type="button"
                onClick={handleTap}
                className={cn(
                  "flex-1 h-14 flex items-center justify-center gap-3 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-md",
                  isCurrentFinished
                    ? "bg-success text-white hover:bg-success-hover"
                    : "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_4px_16px_-4px_var(--primary)]"
                )}
              >
                {isCurrentFinished ? (
                  <>
                    <Check className="size-6 stroke-[3]" />
                    <span>مكتمل ({currentItem.count})</span>
                  </>
                ) : (
                  <>
                    <span>تبقّى: {currentRemaining}</span>
                    <span className="text-xs font-normal opacity-80">(المطلوب {currentItem.count})</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex === totalDhikrs - 1}
                className="flex size-12 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="الذكر التالي"
              >
                <ChevronLeft className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
