'use client'

import { useEffect, useState, useCallback } from 'react'
import { getTripFeedAction, type FeedEvent, type FeedEventType } from '@/lib/supabase/feed-actions'
import { Card } from '@/components/ui/Card'

interface TripFeedProps {
  tripId: string
  initialEvents?: FeedEvent[]
}

// ============================================================================
// Event Config
// ============================================================================

interface EventStyle {
  emoji: string
  borderColor: string
  textColor: string
}

function getEventStyle(event: FeedEvent): EventStyle {
  const eventType = event.event_type
  const metadata = event.metadata as Record<string, unknown> | null

  // Score events — differentiate by performance
  if (eventType === 'score') {
    const diff = typeof metadata?.diff === 'number' ? metadata.diff : 0
    if (diff < 0) {
      return { emoji: '🏌️', borderColor: 'border-l-good', textColor: 'text-good' }
    }
    return { emoji: '😬', borderColor: 'border-l-bad', textColor: 'text-bad' }
  }

  const styles: Record<FeedEventType, EventStyle> = {
    score: { emoji: '🏌️', borderColor: 'border-l-text-2', textColor: 'text-text-1' },
    press: { emoji: '🔥', borderColor: 'border-l-gold', textColor: 'text-gold' },
    match_result: { emoji: '🏆', borderColor: 'border-l-accent', textColor: 'text-accent' },
    media: { emoji: '📸', borderColor: 'border-l-text-2', textColor: 'text-text-1' },
    milestone: { emoji: '🎯', borderColor: 'border-l-gold', textColor: 'text-gold' },
    settlement: { emoji: '💰', borderColor: 'border-l-good', textColor: 'text-good' },
    round_start: { emoji: '⛳', borderColor: 'border-l-accent', textColor: 'text-accent' },
    round_complete: { emoji: '🏆', borderColor: 'border-l-accent', textColor: 'text-accent' },
  }

  return styles[eventType] || styles.score
}

// ============================================================================
// Time formatting
// ============================================================================

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
  if (days < 7) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// Main Component
// ============================================================================

const PAGE_SIZE = 20

export function TripFeed({ tripId, initialEvents }: TripFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>(initialEvents || [])
  const [loading, setLoading] = useState(!initialEvents)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    if (initialEvents) return

    let mounted = true
    async function load() {
      const result = await getTripFeedAction(tripId, PAGE_SIZE, 0)
      if (!mounted) return
      if (result.error) {
        setError(result.error)
      } else {
        setEvents(result.events)
        setHasMore(result.events.length >= PAGE_SIZE)
      }
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [tripId, initialEvents])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getTripFeedAction(tripId, PAGE_SIZE, 0)
      if (!result.error && result.events.length > 0) {
        setEvents((prev) => {
          // Merge new events: use the latest fetch for the first page
          const existingIds = new Set(prev.slice(PAGE_SIZE).map((e) => e.id))
          const freshPage = result.events
          const olderEvents = prev.slice(PAGE_SIZE).filter((e) => !existingIds.has(e.id) || existingIds.has(e.id))
          // Simply replace first page, keep any loaded-more events
          const olderLoaded = prev.slice(PAGE_SIZE)
          return [...freshPage, ...olderLoaded.filter((e) => !freshPage.some((f) => f.id === e.id))]
        })
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [tripId])

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)

    const result = await getTripFeedAction(tripId, PAGE_SIZE, events.length)
    if (!result.error) {
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id))
        const newEvents = result.events.filter((e) => !existingIds.has(e.id))
        return [...prev, ...newEvents]
      })
      setHasMore(result.events.length >= PAGE_SIZE)
    }
    setLoadingMore(false)
  }, [tripId, events.length, loadingMore, hasMore])

  // Loading state
  if (loading) {
    return (
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
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="p-4 text-center">
        <p className="text-sm text-bad">{error}</p>
      </Card>
    )
  }

  // Empty state
  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="mb-3 text-3xl opacity-40">⛳</div>
        <h2 className="mb-1 font-display text-lg font-bold text-text-0">
          No activity yet
        </h2>
        <p className="text-sm text-text-2">
          Start a round to see the action unfold — birdies, presses, and drama will appear here.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <FeedEventCard key={event.id} event={event} />
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-card border border-stroke bg-bg-1 p-3 text-sm font-medium text-text-2 hover:text-text-1 hover:border-accent/40 transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

// ============================================================================
// Feed Event Card
// ============================================================================

function FeedEventCard({ event }: { event: FeedEvent }) {
  const style = getEventStyle(event)

  return (
    <Card className={`border-l-4 ${style.borderColor} px-4 py-3`}>
      <div className="flex items-start gap-3">
        {/* Emoji icon */}
        <div className="mt-0.5 flex-shrink-0 text-lg leading-none">
          {style.emoji}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-0 leading-snug">
            {event.headline}
          </p>
          {event.detail && (
            <p className="mt-0.5 text-xs text-text-2 leading-snug">
              {event.detail}
            </p>
          )}
          <p className="mt-1 text-xs text-text-2">
            {timeAgo(event.created_at)}
          </p>
        </div>

        {/* Hole number badge */}
        {event.hole_number && (
          <div className="flex-shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-2 text-xs font-medium text-text-1">
              {event.hole_number}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}
