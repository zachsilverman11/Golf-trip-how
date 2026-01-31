import { LayoutContainer } from '@/components/ui/LayoutContainer'

export default function RoundLoading() {
  return (
    <LayoutContainer className="py-6">
      <div className="mb-4 h-4 w-20 animate-pulse rounded bg-bg-2" />
      <div className="mb-2 h-8 w-48 animate-pulse rounded bg-bg-2" />
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-bg-2" />
      <div className="h-64 animate-pulse rounded-card border border-stroke bg-bg-1" />
    </LayoutContainer>
  )
}
