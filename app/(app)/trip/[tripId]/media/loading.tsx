import { LayoutContainer } from '@/components/ui/LayoutContainer'

export default function MediaLoading() {
  return (
    <LayoutContainer className="py-6">
      <div className="mb-6">
        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-bg-2" />
        <div className="h-8 w-48 animate-pulse rounded bg-bg-2" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-card-sm bg-bg-2"
          />
        ))}
      </div>
    </LayoutContainer>
  )
}
