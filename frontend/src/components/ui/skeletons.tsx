import { Skeleton } from '@/components/ui/skeleton'

export const BattleCardSkeleton = () => (
  <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-soft">
    <Skeleton className="h-5 w-40" />
    <Skeleton className="h-4 w-56" />
    <div className="flex gap-2">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-28" />
    </div>
  </div>
)

export const AgentCardSkeleton = () => (
  <div className="space-y-2 rounded-lg border border-border bg-card p-4">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-3 w-44" />
    <div className="flex gap-2">
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-7 w-16" />
    </div>
  </div>
)

export const TableRowSkeleton = () => (
  <div className="grid grid-cols-4 gap-3 rounded-lg border border-border bg-card p-4">
    <Skeleton className="h-4 w-10" />
    <Skeleton className="h-4 w-28" />
    <Skeleton className="h-4 w-12" />
    <Skeleton className="h-4 w-20" />
  </div>
)

export const FormSkeleton = () => (
  <div className="space-y-3 rounded-lg border border-border bg-card p-4">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-9 w-full" />
    <div className="grid gap-3 sm:grid-cols-2">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
    <Skeleton className="h-9 w-32" />
  </div>
)
