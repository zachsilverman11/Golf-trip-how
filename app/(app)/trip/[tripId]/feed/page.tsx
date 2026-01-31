import Link from 'next/link'
import { getTripFeedAction, type FeedEvent } from '@/lib/supabase/feed-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

interface FeedPageProps {
  params: { tripId: string }
}

export default async function FeedPage({ params }: FeedPageProps) {
  const { events, error } = await getTripFeedAction(params.tripId)

  // Group events by round
  const groupedByRound = groupEventsByRound(events)

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

      {/* Error state */}
      {error && (
        <Card className="p-4 text-center">
          <p className="text-sm text-bad">{error}</p>
        </Card>
      )}

      {/* Empty state */}
      {!error && events.length === 0 && (
        <Card className="p-8 text-center">
          <div className="mb-3 text-3xl opacity-40">⛳</div>
          <h2 className="mb-1 font-display text-lg font-bold text-text-0">
            No activity yet
          </h2>
          <p className="text-sm text-text-2">
            Events will appear here once rounds are in progress and scores are
            being entered.
          </p>
        </Card>
      )}

      {/* Feed grouped by round */}
      {groupedByRound.map((group) => (
        <section key={group.roundId} className="mb-6">
          {/* Round header */}
          <h2 className="mb-3 font-display text-sm font-bold text-accent uppercase tracking-wide">
            {group.roundName}
          </h2>

          <div className="space-y-2">
            {group.events.map((event) => (
              <FeedEventRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </LayoutContainer>
  )
}

// ============================================================================
// Feed Event Row
// ============================================================================

function FeedEventRow({ event }: { event: FeedEvent }) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Intensity dot */}
        <div className="mt-1.5 flex-shrink-0">
          <IntensityDot intensity={event.intensity} />
        </div>

        {/* Narrative content */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm leading-snug ${
              event.intensity === 'high'
                ? 'text-gold font-medium'
                : event.intensity === 'medium'
                  ? 'text-text-1'
                  : 'text-text-2'
            }`}
          >
            {event.narrative}
          </p>
          <p className="mt-0.5 text-xs text-text-2">
            {formatEventType(event.type)}
          </p>
        </div>

        {/* Hole number badge */}
        {event.holeNumber && (
          <div className="flex-shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-2 text-xs font-medium text-text-1">
              {event.holeNumber}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

// ============================================================================
// Intensity Dot
// ============================================================================

function IntensityDot({ intensity }: { intensity: FeedEvent['intensity'] }) {
  const colorMap = {
    high: 'bg-gold',
    medium: 'bg-accent',
    low: 'bg-text-2',
  }

  return (
    <span
      className={`block h-2 w-2 rounded-full ${colorMap[intensity]}`}
      aria-label={`${intensity} intensity`}
    />
  )
}

// ============================================================================
// Helpers
// ============================================================================

interface RoundGroup {
  roundId: string
  roundName: string
  events: FeedEvent[]
}

function groupEventsByRound(events: FeedEvent[]): RoundGroup[] {
  const map = new Map<string, RoundGroup>()

  for (const event of events) {
    if (!map.has(event.roundId)) {
      map.set(event.roundId, {
        roundId: event.roundId,
        roundName: event.roundName,
        events: [],
      })
    }
    map.get(event.roundId)!.events.push(event)
  }

  // Return groups in order of most-recent event first
  return Array.from(map.values()).sort((a, b) => {
    const aLatest = new Date(a.events[0].timestamp).getTime()
    const bLatest = new Date(b.events[0].timestamp).getTime()
    return bLatest - aLatest
  })
}

function formatEventType(type: FeedEvent['type']): string {
  const labels: Record<FeedEvent['type'], string> = {
    round_started: 'Round',
    round_completed: 'Round',
    hole_result: 'Hole',
    press_added: 'Press',
    match_closed: 'Match',
    match_status: 'Match',
  }
  return labels[type]
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
