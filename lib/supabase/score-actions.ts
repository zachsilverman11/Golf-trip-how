'use server'

import { createClient } from './server'
import type { DbScore } from './types'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Types
// ============================================================================

export interface UpsertScoreInput {
  round_id: string
  player_id: string
  hole_number: number
  gross_strokes: number | null
}

export interface ScoreActionResult {
  success: boolean
  scoreId?: string
  error?: string
}

export interface RoundScores {
  [playerId: string]: {
    [holeNumber: number]: number | null
  }
}

// ============================================================================
// Get Scores for Round
// ============================================================================

export async function getRoundScoresAction(roundId: string): Promise<{
  scores: DbScore[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { scores: [], error: 'Not authenticated' }
  }

  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('*')
      .eq('round_id', roundId)
      .order('hole_number')

    if (error) {
      console.error('Get scores error:', error)
      return { scores: [], error: error.message }
    }

    return { scores: scores || [] }
  } catch (err) {
    console.error('Get scores error:', err)
    return {
      scores: [],
      error: err instanceof Error ? err.message : 'Failed to load scores',
    }
  }
}

// ============================================================================
// Get Scores as Map (easier to work with)
// ============================================================================

export async function getRoundScoresMapAction(roundId: string): Promise<{
  scores: RoundScores
  error?: string
}> {
  const result = await getRoundScoresAction(roundId)

  if (result.error) {
    return { scores: {}, error: result.error }
  }

  const scoresMap: RoundScores = {}

  for (const score of result.scores) {
    if (!scoresMap[score.player_id]) {
      scoresMap[score.player_id] = {}
    }
    scoresMap[score.player_id][score.hole_number] = score.gross_strokes
  }

  return { scores: scoresMap }
}

// ============================================================================
// Upsert Score (insert or update)
// ============================================================================

export async function upsertScoreAction(input: UpsertScoreInput): Promise<ScoreActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Check if score exists
    const { data: existing } = await supabase
      .from('scores')
      .select('id')
      .eq('round_id', input.round_id)
      .eq('player_id', input.player_id)
      .eq('hole_number', input.hole_number)
      .single()

    if (existing) {
      // Update
      const { error } = await supabase
        .from('scores')
        .update({ gross_strokes: input.gross_strokes })
        .eq('id', existing.id)

      if (error) {
        console.error('Update score error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, scoreId: existing.id }
    } else {
      // Insert
      const { data: score, error } = await supabase
        .from('scores')
        .insert({
          round_id: input.round_id,
          player_id: input.player_id,
          hole_number: input.hole_number,
          gross_strokes: input.gross_strokes,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Insert score error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, scoreId: score.id }
    }
  } catch (err) {
    console.error('Upsert score error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save score',
    }
  }
}

// ============================================================================
// Bulk Upsert Scores
// ============================================================================

export async function bulkUpsertScoresAction(
  scores: UpsertScoreInput[]
): Promise<ScoreActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Use upsert with onConflict
    const { error } = await supabase
      .from('scores')
      .upsert(
        scores.map((s) => ({
          round_id: s.round_id,
          player_id: s.player_id,
          hole_number: s.hole_number,
          gross_strokes: s.gross_strokes,
        })),
        {
          onConflict: 'round_id,player_id,hole_number',
        }
      )

    if (error) {
      console.error('Bulk upsert scores error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Bulk upsert scores error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save scores',
    }
  }
}

// ============================================================================
// Delete Score
// ============================================================================

export async function deleteScoreAction(
  roundId: string,
  playerId: string,
  holeNumber: number
): Promise<ScoreActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .eq('hole_number', holeNumber)

    if (error) {
      console.error('Delete score error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Delete score error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete score',
    }
  }
}

// ============================================================================
// Get Player Total Scores for Round
// ============================================================================

export interface PlayerRoundScore {
  playerId: string
  playerName: string
  handicapIndex: number | null
  playingHandicap: number | null
  grossTotal: number
  netTotal: number
  holesPlayed: number
  thru: number
}

export async function getPlayerRoundScoresAction(roundId: string): Promise<{
  playerScores: PlayerRoundScore[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { playerScores: [], error: 'Not authenticated' }
  }

  try {
    // Get round with groups and players
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select(`
        *,
        groups (
          *,
          group_players (
            *,
            players (*)
          )
        )
      `)
      .eq('id', roundId)
      .single()

    if (roundError) {
      return { playerScores: [], error: roundError.message }
    }

    // Get all scores for round
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .eq('round_id', roundId)

    if (scoresError) {
      return { playerScores: [], error: scoresError.message }
    }

    // Build player scores
    const playerScores: PlayerRoundScore[] = []

    for (const group of round.groups || []) {
      for (const gp of group.group_players || []) {
        const player = (gp as any).players
        if (!player) continue

        const playerScoreRecords = scores?.filter((s) => s.player_id === player.id) || []
        const grossTotal = playerScoreRecords.reduce(
          (sum, s) => sum + (s.gross_strokes || 0),
          0
        )
        const holesPlayed = playerScoreRecords.filter((s) => s.gross_strokes !== null).length
        const thru = holesPlayed > 0 ? Math.max(...playerScoreRecords.map((s) => s.hole_number)) : 0

        playerScores.push({
          playerId: player.id,
          playerName: player.name,
          handicapIndex: player.handicap_index,
          playingHandicap: gp.playing_handicap,
          grossTotal,
          netTotal: grossTotal, // Will be calculated properly with handicap
          holesPlayed,
          thru,
        })
      }
    }

    return { playerScores }
  } catch (err) {
    console.error('Get player round scores error:', err)
    return {
      playerScores: [],
      error: err instanceof Error ? err.message : 'Failed to load player scores',
    }
  }
}
