'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'

// ============================================================================
// TYPES
// ============================================================================

export type FeedEventType =
  | 'score'
  | 'press'
  | 'match_result'
  | 'media'
  | 'milestone'
  | 'settlement'
  | 'round_start'
  | 'round_complete'

export interface FeedEvent {
  id: string
  trip_id: string
  event_type: FeedEventType
  player_name: string | null
  round_id: string | null
  hole_number: number | null
  headline: string
  detail: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CreateFeedEventInput {
  event_type: FeedEventType
  player_name?: string | null
  round_id?: string | null
  hole_number?: number | null
  headline: string
  detail?: string | null
  metadata?: Record<string, unknown> | null
}

// ============================================================================
// GET TRIP FEED (paginated, newest first)
// ============================================================================

export async function getTripFeedAction(
  tripId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ events: FeedEvent[]; error?: string }> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { events: [], error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase
      .from('trip_feed_events')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Table might not exist yet — return empty gracefully
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return { events: [] }
      }
      console.error('Get trip feed error:', error)
      return { events: [], error: error.message }
    }

    return { events: (data as FeedEvent[]) || [] }
  } catch (err) {
    console.error('Get trip feed error:', err)
    return {
      events: [],
      error: err instanceof Error ? err.message : 'Failed to load feed',
    }
  }
}

// ============================================================================
// CREATE FEED EVENT
// ============================================================================

export async function createFeedEventAction(
  tripId: string,
  event: CreateFeedEventInput
): Promise<{ success: boolean; event?: FeedEvent; error?: string }> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase
      .from('trip_feed_events')
      .insert({
        trip_id: tripId,
        event_type: event.event_type,
        player_name: event.player_name ?? null,
        round_id: event.round_id ?? null,
        hole_number: event.hole_number ?? null,
        headline: event.headline,
        detail: event.detail ?? null,
        metadata: event.metadata ?? null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Create feed event error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, event: data as FeedEvent }
  } catch (err) {
    console.error('Create feed event error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create feed event',
    }
  }
}

// ============================================================================
// GENERATE SCORE EVENTS
// ============================================================================

/**
 * Auto-generate feed events when a score is saved.
 * Only creates events for notable scores (birdie, eagle, double bogey+).
 * Fire-and-forget — errors are logged but don't propagate.
 */
export async function generateScoreEvents(
  tripId: string,
  roundId: string,
  _playerId: string,
  playerName: string,
  holeNumber: number,
  score: number | null,
  par: number
): Promise<void> {
  if (score === null || score <= 0) return

  const diff = score - par
  const firstName = playerName.split(' ')[0]

  let headline: string | null = null
  let detail: string | null = null
  let metadata: Record<string, unknown> = {
    score,
    par,
    diff,
    hole_number: holeNumber,
  }

  if (diff <= -3) {
    // Albatross / Double Eagle
    headline = `🦅 ${firstName} made albatross on #${holeNumber}!`
    detail = `${score} on the par ${par} — absolutely legendary`
  } else if (diff === -2) {
    // Eagle
    headline = `🦅 ${firstName} eagled #${holeNumber}!`
    detail = `${score} on the par ${par}`
  } else if (diff === -1) {
    // Birdie
    headline = `🏌️ ${firstName} birdied #${holeNumber}`
    detail = `${score} on the par ${par}`
  } else if (diff === 2) {
    // Double bogey
    headline = `😬 ${firstName} made double bogey on #${holeNumber}`
    detail = `${score} on the par ${par}`
  } else if (diff === 3) {
    // Triple bogey
    headline = `💀 ${firstName} made triple bogey on #${holeNumber}`
    detail = `${score} on the par ${par} — ouch`
  } else if (diff >= 4) {
    // Blow-up hole
    headline = `🔥 ${firstName} made +${diff} on #${holeNumber}`
    detail = `${score} on the par ${par} — we don't talk about this one`
  }
  // Par and bogey are skipped (too noisy)

  if (!headline) return

  try {
    await createFeedEventAction(tripId, {
      event_type: 'score',
      player_name: firstName,
      round_id: roundId,
      hole_number: holeNumber,
      headline,
      detail,
      metadata,
    })
  } catch (err) {
    // Fire and forget — don't break scoring flow
    console.error('Generate score feed event error:', err)
  }
}

// ============================================================================
// GENERATE PRESS EVENT
// ============================================================================

export async function generatePressEvent(
  tripId: string,
  roundId: string,
  startingHole: number,
  endingHole: number,
  stakePerMan: number,
  pressingTeamNames?: string
): Promise<void> {
  try {
    const who = pressingTeamNames || 'A team'
    const headline = `🔥 ${who} pressed on #${startingHole}`
    const rangeStr = endingHole < 18 ? ` →${endingHole}` : ''
    const detail = `New bet from hole ${startingHole}${rangeStr} — $${stakePerMan}/man`

    await createFeedEventAction(tripId, {
      event_type: 'press',
      round_id: roundId,
      hole_number: startingHole,
      headline,
      detail,
      metadata: {
        starting_hole: startingHole,
        ending_hole: endingHole,
        stake_per_man: stakePerMan,
      },
    })
  } catch (err) {
    console.error('Generate press feed event error:', err)
  }
}

// ============================================================================
// GENERATE MEDIA EVENT
// ============================================================================

export async function generateMediaEvent(
  tripId: string,
  playerName: string,
  holeNumber?: number | null,
  roundId?: string | null,
  mediaType?: string
): Promise<void> {
  try {
    const firstName = playerName.split(' ')[0]
    const type = mediaType === 'video' ? 'video' : 'photo'
    const locationStr = holeNumber ? ` from #${holeNumber}` : ''
    const headline = `📸 ${firstName} posted a ${type}${locationStr}`

    await createFeedEventAction(tripId, {
      event_type: 'media',
      player_name: firstName,
      round_id: roundId ?? null,
      hole_number: holeNumber ?? null,
      headline,
      metadata: { media_type: mediaType },
    })
  } catch (err) {
    console.error('Generate media feed event error:', err)
  }
}

// ============================================================================
// GENERATE ROUND EVENT
// ============================================================================

export async function generateRoundEvent(
  tripId: string,
  roundId: string,
  roundName: string,
  status: 'round_start' | 'round_complete'
): Promise<void> {
  try {
    const headline =
      status === 'round_start'
        ? `⛳ ${roundName} is underway!`
        : `🏆 ${roundName} is complete`

    await createFeedEventAction(tripId, {
      event_type: status,
      round_id: roundId,
      headline,
    })
  } catch (err) {
    console.error('Generate round feed event error:', err)
  }
}
