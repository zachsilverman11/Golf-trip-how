'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTripFeedAction, type FeedEvent, type FeedEventType } from '@/lib/supabase/feed-actions'
import { Card } from '@/components/ui/Card'

interface FeedPreviewProps {
  tripId: string
}

// ============================================================================
// Event styling (matches TripFeed)
// ============================================================================

function getPreviewStyle(event: FeedEvent): { emoji: string; borderColor: string } {
  const eventType = event.event_type
  const metadata = event.metadata as Record<string, unknown> | null

  if (eventType === 'score') {
    const diff = typeof metadata?.diff === 'number' ? metadata.diff : 0
    if (diff < 0) {
      return { emoji: '🏌️', borderColor: 'border-l-good' }
    }
    return { emoji: '😬', borderColor: 'border-l-bad' }
  }

  const styles: Record<FeedEventType, { emoji: string; borderColor: string }> = {
    score: { emoji: '🏌️', borderColor: 'border-l-text-2' },
    press: { emoji: '🔥', borderColor: 'border-l-gold' },
    match_result: { emoji: '🏆', borderColor: 'border-l-accent' },
    media: { emoji: '📸', borderColor: 'border-l-text-2' },
    milestone: { emoji: '🎯', borderColor: 'border-l-gold' },
    settlement: { emoji: '💰', borderColor: 'border-l-good' },
    round_start: { emoji: '⛳', borderColor: 'border-l-accent' },
    round_complete: { emoji: '🏆', borderColor: 'border-l-accent' },
  }

  return styles[eventType] || styles.score
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

// ============================================================================
// Component
// ============================================================================

export function FeedPreview({ tripId }: FeedPreviewProps) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadFeed() {
      try {
        const result = await getTripFeedAction(tripId, 5, 0)
        if (mounted && result.events.length > 0) {
          setEvents(result.events.slice(0, 5))
        }
      } catch {
        // Silently fail — preview is non-critical
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadFeed()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadFeed, 30_000)
    return () => {
      mounted = false
      clearInterval(interval)
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
        {events.map((event) => {
          const style = getPreviewStyle(event)
          return (
            <div
              key={event.id}
              className={`flex items-start gap-3 px-4 py-3 border-l-4 ${style.borderColor}`}
            >
              {/* Emoji */}
              <div className="mt-0.5 flex-shrink-0 text-base leading-none">
                {style.emoji}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-0 leading-snug">
                  {event.headline}
                </p>
                <p className="mt-0.5 text-xs text-text-2">
                  {timeAgo(event.created_at)}
                </p>
              </div>

              {/* Hole badge */}
              {event.hole_number && (
                <span className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-2 text-xs text-text-2">
                  {event.hole_number}
                </span>
              )}
            </div>
          )
        })}
      </Card>
    </section>
  )
}
