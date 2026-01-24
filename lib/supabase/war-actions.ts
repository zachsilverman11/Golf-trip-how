'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'
import type { DbTripTeamAssignment } from './types'

// ============================================================================
// Types
// ============================================================================

export interface WarActionResult {
  success: boolean
  error?: string
}

export interface WarTotals {
  teamA: {
    points: number
    wins: number
    losses: number
    ties: number
  }
  teamB: {
    points: number
    wins: number
    losses: number
    ties: number
  }
}

// ============================================================================
// Toggle War Mode
// ============================================================================

export async function toggleWarModeAction(
  tripId: string,
  enabled: boolean
): Promise<WarActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('trips')
      .update({ war_enabled: enabled })
      .eq('id', tripId)

    if (error) {
      console.error('Toggle war mode error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true }
  } catch (err) {
    console.error('Toggle war mode error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle war mode',
    }
  }
}

// ============================================================================
// Get Team Assignments
// ============================================================================

export async function getWarTeamAssignmentsAction(tripId: string): Promise<{
  assignments: DbTripTeamAssignment[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { assignments: [], error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase
      .from('trip_team_assignments')
      .select('*')
      .eq('trip_id', tripId)

    if (error) {
      console.error('Get war team assignments error:', error)
      return { assignments: [], error: error.message }
    }

    return { assignments: data || [] }
  } catch (err) {
    console.error('Get war team assignments error:', err)
    return {
      assignments: [],
      error: err instanceof Error ? err.message : 'Failed to load team assignments',
    }
  }
}

// ============================================================================
// Save Team Assignments
// ============================================================================

export async function saveWarTeamAssignmentsAction(
  tripId: string,
  assignments: Record<string, 'A' | 'B'>
): Promise<WarActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Delete existing assignments for this trip
    const { error: deleteError } = await supabase
      .from('trip_team_assignments')
      .delete()
      .eq('trip_id', tripId)

    if (deleteError) {
      console.error('Delete team assignments error:', deleteError)
      return { success: false, error: deleteError.message }
    }

    // Insert new assignments
    const assignmentsToInsert = Object.entries(assignments).map(([playerId, team]) => ({
      trip_id: tripId,
      player_id: playerId,
      team,
    }))

    if (assignmentsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('trip_team_assignments')
        .insert(assignmentsToInsert)

      if (insertError) {
        console.error('Insert team assignments error:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true }
  } catch (err) {
    console.error('Save team assignments error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save team assignments',
    }
  }
}

// ============================================================================
// Calculate War Totals
// ============================================================================

export async function getWarTotalsAction(tripId: string): Promise<{
  totals: WarTotals | null
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { totals: null, error: 'Not authenticated' }
  }

  try {
    // Get team assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('trip_team_assignments')
      .select('player_id, team')
      .eq('trip_id', tripId)

    if (assignmentsError) {
      return { totals: null, error: assignmentsError.message }
    }

    if (!assignments || assignments.length === 0) {
      return { totals: null }
    }

    // Build player -> team map
    const playerTeamMap: Record<string, 'A' | 'B'> = {}
    for (const a of assignments) {
      playerTeamMap[a.player_id] = a.team as 'A' | 'B'
    }

    // Get all matches for this trip
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, format')
      .eq('trip_id', tripId)

    if (roundsError) {
      return { totals: null, error: roundsError.message }
    }

    // Get matches for valid formats (match_play, points_hilo)
    const validRoundIds = rounds
      ?.filter((r) => r.format === 'match_play' || r.format === 'points_hilo')
      .map((r) => r.id) || []

    if (validRoundIds.length === 0) {
      return {
        totals: {
          teamA: { points: 0, wins: 0, losses: 0, ties: 0 },
          teamB: { points: 0, wins: 0, losses: 0, ties: 0 },
        },
      }
    }

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .in('round_id', validRoundIds)
      .eq('status', 'completed')

    if (matchesError) {
      return { totals: null, error: matchesError.message }
    }

    // Calculate totals
    const totals: WarTotals = {
      teamA: { points: 0, wins: 0, losses: 0, ties: 0 },
      teamB: { points: 0, wins: 0, losses: 0, ties: 0 },
    }

    for (const match of matches || []) {
      // Determine which war team each match team belongs to
      const matchTeamAWarTeam = playerTeamMap[match.team_a_player1_id]
      const matchTeamBWarTeam = playerTeamMap[match.team_b_player1_id]

      if (!matchTeamAWarTeam || !matchTeamBWarTeam) continue
      if (matchTeamAWarTeam === matchTeamBWarTeam) continue // Same war team, doesn't count

      // Determine winner (positive final_result = team A wins holes)
      if (match.final_result > 0) {
        // Match team A won
        if (matchTeamAWarTeam === 'A') {
          totals.teamA.wins++
          totals.teamA.points += match.final_result
          totals.teamB.losses++
        } else {
          totals.teamB.wins++
          totals.teamB.points += match.final_result
          totals.teamA.losses++
        }
      } else if (match.final_result < 0) {
        // Match team B won
        if (matchTeamBWarTeam === 'A') {
          totals.teamA.wins++
          totals.teamA.points += Math.abs(match.final_result)
          totals.teamB.losses++
        } else {
          totals.teamB.wins++
          totals.teamB.points += Math.abs(match.final_result)
          totals.teamA.losses++
        }
      } else {
        // Tie
        totals.teamA.ties++
        totals.teamB.ties++
      }
    }

    return { totals }
  } catch (err) {
    console.error('Get war totals error:', err)
    return {
      totals: null,
      error: err instanceof Error ? err.message : 'Failed to calculate war totals',
    }
  }
}
