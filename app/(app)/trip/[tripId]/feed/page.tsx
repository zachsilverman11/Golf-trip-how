import Link from 'next/link'
import { getTripFeedAction } from '@/lib/supabase/feed-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { TripFeed } from '@/components/trip/TripFeed'

export const dynamic = 'force-dynamic'

interface FeedPageProps {
  params: { tripId: string }
}

export default async function FeedPage({ params }: FeedPageProps) {
  const { events } = await getTripFeedAction(params.tripId, 20, 0)

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/trip/${params.tripId}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trip
        </Link>
        <div className="flex items-baseline gap-2">
          <h1 className="font-display text-2xl font-bold text-text-0">
            Trip Feed
          </h1>
          {events.length > 0 && (
            <span className="text-sm text-text-2">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Feed */}
      <TripFeed tripId={params.tripId} initialEvents={events} />
    </LayoutContainer>
  )
}

// ============================================================================
// Icons
// ============================================================================

function BackIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5L8.25 12l7.5-7.5"
      />
    </svg>
  )
}
