import { forwardRef } from "react"
import { cn } from "@/lib/utils"

const fieldBase =
  "w-full rounded-lg border border-border bg-card px-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors outline-none hover:border-border-strong focus:border-ring focus:ring-3 focus:ring-ring/15 disabled:opacity-50"

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10 sm:h-9", className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(fieldBase, "resize-none py-2 leading-relaxed", className)} {...props} />
  },
)

export { Select, type SelectOption } from "@/components/ui/select"

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground/80">{hint}</span>}
    </label>
  )
}
