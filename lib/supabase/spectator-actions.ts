'use server'

/**
 * Spectator-specific server actions.
 * All use admin client to bypass RLS (no auth required).
 */

import { createAdminClient } from './server'
import type { FeedEvent } from './feed-actions'
import type { DbMatchWithPresses, DbPress } from './match-types'

// ============================================================================
// Types
// ============================================================================

export interface SpectatorMatchInfo {
  match: DbMatchWithPresses
  teamANames: string
  teamBNames: string
  roundName: string
  roundStatus: string
}

export interface SpectatorTripInfo {
  id: string
  name: string
  description: string | null
  hasActiveRound: boolean
}

// ============================================================================
// Get Trip Info (for metadata + header)
// ============================================================================

export async function getSpectatorTripInfoAction(
  token: string
): Promise<{
  trip?: SpectatorTripInfo
  error?: string
}> {
  const supabase = createAdminClient()

  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select(`
        id,
        name,
        description,
        rounds (status)
      `)
      .eq('spectator_token', token)
      .single()

    if (error || !trip) {
      return { error: 'Invalid spectator link' }
    }

    const rounds = (trip as Record<string, unknown>).rounds as Array<{ status: string }> | undefined
    const hasActiveRound = (rounds || []).some((r) => r.status === 'in_progress')

    return {
      trip: {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        hasActiveRound,
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load trip' }
  }
}

// ============================================================================
// Get All Matches for Trip (spectator)
// ============================================================================

export async function getSpectatorMatchesAction(
  token: string
): Promise<{ matches: SpectatorMatchInfo[]; error?: string }> {
  const supabase = createAdminClient()

  try {
    // Look up trip by spectator token
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id')
      .eq('spectator_token', token)
      .single()

    if (tripError || !trip) {
      return { matches: [], error: 'Invalid spectator link' }
    }

    // Get all rounds with matches and presses
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        id,
        name,
        status,
        matches (
          *,
          presses (*)
        )
      `)
      .eq('trip_id', trip.id)
      .order('date', { ascending: false })

    if (roundsError) {
      return { matches: [], error: roundsError.message }
    }

    const result: SpectatorMatchInfo[] = []

    for (const round of rounds || []) {
      const roundData = round as Record<string, unknown>
      const matches = (roundData.matches as Array<Record<string, unknown>>) || []

      for (const match of matches) {
        // Get player names
        const playerIds = [
          match.team_a_player1_id as string,
          match.team_a_player2_id as string | null,
          match.team_b_player1_id as string,
          match.team_b_player2_id as string | null,
        ].filter((id): id is string => Boolean(id))

        if (playerIds.length === 0) continue

        const { data: players } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds)

        const nameMap: Record<string, string> = {}
        for (const p of players || []) {
          nameMap[p.id] = p.name.split(' ')[0]
        }

        const teamANames = [
          nameMap[match.team_a_player1_id as string],
          match.team_a_player2_id ? nameMap[match.team_a_player2_id as string] : null,
        ]
          .filter(Boolean)
          .join(' & ')

        const teamBNames = [
          nameMap[match.team_b_player1_id as string],
          match.team_b_player2_id ? nameMap[match.team_b_player2_id as string] : null,
        ]
          .filter(Boolean)
          .join(' & ')

        const presses = (match.presses as DbPress[]) || []

        result.push({
          match: {
            id: match.id as string,
            round_id: match.round_id as string,
            match_type: match.match_type as '1v1' | '2v2',
            stake_per_man: match.stake_per_man as number,
            team_a_player1_id: match.team_a_player1_id as string,
            team_a_player2_id: (match.team_a_player2_id as string) || null,
            team_b_player1_id: match.team_b_player1_id as string,
            team_b_player2_id: (match.team_b_player2_id as string) || null,
            status: match.status as 'in_progress' | 'completed' | 'canceled',
            winner: match.winner as 'team_a' | 'team_b' | 'halved' | null,
            final_result: (match.final_result as string) || null,
            current_lead: match.current_lead as number,
            holes_played: match.holes_played as number,
            created_at: match.created_at as string,
            updated_at: match.updated_at as string,
            presses,
          },
          teamANames,
          teamBNames,
          roundName: round.name,
          roundStatus: round.status,
        })
      }
    }

    return { matches: result }
  } catch (err) {
    return {
      matches: [],
      error: err instanceof Error ? err.message : 'Failed to load matches',
    }
  }
}

// ============================================================================
// Get Feed Events for Trip (spectator, no auth)
// ============================================================================

export async function getSpectatorFeedAction(
  token: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ events: FeedEvent[]; error?: string }> {
  const supabase = createAdminClient()

  try {
    // Look up trip by spectator token
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id')
      .eq('spectator_token', token)
      .single()

    if (tripError || !trip) {
      return { events: [], error: 'Invalid spectator link' }
    }

    const { data, error } = await supabase
      .from('trip_feed_events')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return { events: [] }
      }
      return { events: [], error: error.message }
    }

    return { events: (data as FeedEvent[]) || [] }
  } catch (err) {
    return {
      events: [],
      error: err instanceof Error ? err.message : 'Failed to load feed',
    }
  }
}
