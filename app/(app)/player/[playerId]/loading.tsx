import { LayoutContainer } from '@/components/ui/LayoutContainer'

export default function PlayerProfileLoading() {
  return (
    <LayoutContainer className="py-6">
      {/* Back link skeleton */}
      <div className="mb-4 h-4 w-28 animate-pulse rounded bg-bg-2" />

      {/* Header skeleton */}
      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-bg-2" />
        <div>
          <div className="mb-2 h-7 w-36 animate-pulse rounded bg-bg-2" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-bg-2" />
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="mb-6">
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-bg-2" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-card-sm bg-bg-2 p-3">
              <div className="mb-2 h-2.5 w-16 animate-pulse rounded bg-stroke" />
              <div className="h-6 w-12 animate-pulse rounded bg-stroke" />
            </div>
          ))}
        </div>
      </div>

      {/* Handicap chart skeleton */}
      <div className="mb-6 rounded-card-sm bg-bg-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-stroke" />
          <div className="h-4 w-10 animate-pulse rounded bg-stroke" />
        </div>
        <div className="h-[100px] w-full animate-pulse rounded bg-stroke/30" />
      </div>

      {/* Round history skeleton */}
      <div className="mb-6">
        <div className="mb-3 h-3 w-28 animate-pulse rounded bg-bg-2" />
        <div className="rounded-card border border-stroke bg-bg-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3 ${
                i < 3 ? 'border-b border-stroke/60' : ''
              }`}
            >
              <div>
                <div className="mb-1.5 h-4 w-28 animate-pulse rounded bg-bg-2" />
                <div className="h-3 w-40 animate-pulse rounded bg-bg-2" />
              </div>
              <div className="h-6 w-10 animate-pulse rounded bg-bg-2" />
            </div>
          ))}
        </div>
      </div>
    </LayoutContainer>
  )
}
