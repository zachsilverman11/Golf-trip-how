import { LayoutContainer } from '@/components/ui/LayoutContainer'

export default function FeedLoading() {
  return (
    <LayoutContainer className="py-6">
      <div className="mb-4 h-4 w-20 animate-pulse rounded bg-bg-2" />
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-bg-2" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-card border border-stroke bg-bg-1 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-6 w-6 animate-pulse rounded-full bg-bg-2" />
              <div className="h-3 w-20 animate-pulse rounded bg-bg-2" />
            </div>
            <div className="h-4 w-full animate-pulse rounded bg-bg-2" />
          </div>
        ))}
      </div>
    </LayoutContainer>
  )
}
