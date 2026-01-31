import { LayoutContainer } from '@/components/ui/LayoutContainer'

export default function TripLoading() {
  return (
    <LayoutContainer className="py-6">
      {/* Back link skeleton */}
      <div className="mb-4 h-4 w-16 animate-pulse rounded bg-bg-2" />

      {/* Title skeleton */}
      <div className="mb-6">
        <div className="mb-2 h-8 w-48 animate-pulse rounded bg-bg-2" />
        <div className="h-4 w-32 animate-pulse rounded bg-bg-2" />
      </div>

      {/* Cards skeleton */}
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-card border border-stroke bg-bg-1" />
        <div className="h-20 animate-pulse rounded-card border border-stroke bg-bg-1" />
        <div className="h-16 animate-pulse rounded-card border border-stroke bg-bg-1" />
      </div>
    </LayoutContainer>
  )
}
