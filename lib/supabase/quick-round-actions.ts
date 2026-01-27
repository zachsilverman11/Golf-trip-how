'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'

interface QuickRoundPlayer {
  name: string
  handicap: number | null
}

export interface CreateQuickRoundInput {
  players: QuickRoundPlayer[]
  teeId: string | null
  courseName: string | null
  format: 'stroke_play' | 'match_play' | 'points_hilo' | 'stableford'
  scoringBasis: 'gross' | 'net'
  teeTime: string | null  // HH:MM format
  teamAssignments?: Record<string, 1 | 2>  // draftPlayerId -> team (1 or 2)
}

export interface QuickRoundResult {
  success: boolean
  tripId?: string
  roundId?: string
  error?: string
}

/**
 * Creates a "Quick Round" - a trip with a single round using inline player entry.
 * Uses a Supabase RPC (SECURITY DEFINER) to atomically create all entities,
 * bypassing the RLS race condition that occurred with separate inserts.
 */
export async function createQuickRoundAction(input: CreateQuickRoundInput): Promise<QuickRoundResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to start a round' }
  }

  // Client-side validation (RPC will also validate)
  if (input.players.length === 0) {
    return { success: false, error: 'At least one player is required' }
  }

  // Format-specific validation
  if (input.format === 'match_play') {
    if (input.players.length !== 2 && input.players.length !== 4) {
      return { success: false, error: 'Match play requires 2 or 4 players' }
    }
    if (input.players.length === 4 && !input.teamAssignments) {
      return { success: false, error: 'Match play with 4 players requires team assignments' }
    }
  }

  if (input.format === 'points_hilo') {
    if (input.players.length !== 4) {
      return { success: false, error: 'Points Hi/Lo requires exactly 4 players' }
    }
    if (!input.teamAssignments) {
      return { success: false, error: 'Points Hi/Lo requires team assignments' }
    }
  }

  // Validate team assignments have 2 per team if provided
  if (input.teamAssignments && input.players.length === 4) {
    const team1Count = Object.values(input.teamAssignments).filter(t => t === 1).length
    const team2Count = Object.values(input.teamAssignments).filter(t => t === 2).length
    if (team1Count !== 2 || team2Count !== 2) {
      return { success: false, error: 'Teams must have exactly 2 players each' }
    }
  }

  try {
    // Build payload for RPC
    // Team assignments are already keyed by player index (0, 1, 2, 3) from the client
    const payload = {
      players: input.players.map(p => ({
        name: p.name,
        handicap: p.handicap,
      })),
      teeId: input.teeId,
      courseName: input.courseName,
      format: input.format,
      scoringBasis: input.scoringBasis,
      teeTime: input.teeTime,
      ...(input.teamAssignments && { teamAssignments: input.teamAssignments }),
    }

    // Call the atomic RPC
    const { data, error } = await supabase.rpc('create_quick_round', {
      payload,
    })

    if (error) {
      console.error('create_quick_round RPC error:', error)

      // Map specific errors to user-friendly messages
      if (error.message.includes('Not authenticated')) {
        return { success: false, error: 'You must be logged in to start a round' }
      }
      if (error.message.includes('At least one player')) {
        return { success: false, error: 'At least one player is required' }
      }
      if (error.message.includes('requires')) {
        return { success: false, error: error.message }
      }

      return { success: false, error: 'Failed to create round. Please try again.' }
    }

    // RPC returns array with single row containing trip_id and round_id
    const result = Array.isArray(data) ? data[0] : data

    if (!result?.trip_id || !result?.round_id) {
      console.error('create_quick_round: Missing IDs in response', data)
      return { success: false, error: 'Failed to create round. Please try again.' }
    }

    revalidatePath('/trips')
    return {
      success: true,
      tripId: result.trip_id,
      roundId: result.round_id,
    }
  } catch (err) {
    console.error('Create quick round error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create quick round',
    }
  }
}
