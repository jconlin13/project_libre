import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export function BookCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <Skeleton className="h-32 w-20 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-20 mt-1" />
          <div className="mt-auto flex gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      </div>
    </Card>
  )
}

export function MemberCardSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded" />
        <Skeleton className="h-16 w-full rounded" />
      </div>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <MemberCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
