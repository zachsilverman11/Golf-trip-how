'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTripFeedAction, type FeedEvent } from '@/lib/supabase/feed-actions'
import { Card } from '@/components/ui/Card'

interface FeedPreviewProps {
  tripId: string
}

export function FeedPreview({ tripId }: FeedPreviewProps) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadFeed() {
      try {
        const result = await getTripFeedAction(tripId, 5)
        if (mounted && result.events.length > 0) {
          setEvents(result.events.slice(0, 3))
        }
      } catch {
        // Silently fail — preview is non-critical
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadFeed()
    return () => {
      mounted = false
    }
  }, [tripId])

  // Don't render anything if loading or no events
  if (loading || events.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-text-0">
          Latest Activity
        </h2>
        <Link
          href={`/trip/${tripId}/feed`}
          className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
        >
          View all →
        </Link>
      </div>

      <Card className="divide-y divide-stroke">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3 px-4 py-3">
            {/* Intensity dot */}
            <div className="mt-1.5 flex-shrink-0">
              <span
                className={`block h-2 w-2 rounded-full ${
                  event.intensity === 'high'
                    ? 'bg-gold'
                    : event.intensity === 'medium'
                      ? 'bg-accent'
                      : 'bg-text-2'
                }`}
              />
            </div>

            {/* Narrative */}
            <p
              className={`min-w-0 flex-1 text-sm leading-snug ${
                event.intensity === 'high'
                  ? 'text-gold font-medium'
                  : event.intensity === 'medium'
                    ? 'text-text-1'
                    : 'text-text-2'
              }`}
            >
              {event.narrative}
            </p>

            {/* Hole badge */}
            {event.holeNumber && (
              <span className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-2 text-xs text-text-2">
                {event.holeNumber}
              </span>
            )}
          </div>
        ))}
      </Card>
    </section>
  )
}
