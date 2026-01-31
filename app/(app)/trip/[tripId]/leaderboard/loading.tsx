import { LayoutContainer } from '@/components/ui/LayoutContainer'

export default function LeaderboardLoading() {
  return (
    <LayoutContainer className="py-6">
      <div className="mb-4 h-4 w-20 animate-pulse rounded bg-bg-2" />
      <div className="mb-6 h-8 w-40 animate-pulse rounded bg-bg-2" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-card border border-stroke bg-bg-1 p-4">
            <div className="h-8 w-8 animate-pulse rounded-full bg-bg-2" />
            <div className="flex-1">
              <div className="mb-1 h-4 w-24 animate-pulse rounded bg-bg-2" />
              <div className="h-3 w-16 animate-pulse rounded bg-bg-2" />
            </div>
            <div className="h-6 w-12 animate-pulse rounded bg-bg-2" />
          </div>
        ))}
      </div>
    </LayoutContainer>
  )
}
