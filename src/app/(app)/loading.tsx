// Shown instantly while a page's data loads, so navigation never feels stuck.
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  )
}
