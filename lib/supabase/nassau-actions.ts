'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { computeNassauState } from '../nassau-utils'
import type { NassauState, NassauPlayerInfo } from '../nassau-utils'
import type { DbHole } from './types'

// ============================================================================
// Create Nassau Bet
// ============================================================================

export interface CreateNassauInput {
  roundId: string
  stakePerMan: number
  autoPress?: boolean
  autoPressThreshold?: number
  highBallTiebreaker?: boolean
  teamAPlayer1Id: string
  teamAPlayer2Id?: string
  teamBPlayer1Id: string
  teamBPlayer2Id?: string
}

export async function createNassauBetAction(input: CreateNassauInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const { data, error } = await supabase
      .from('nassau_bets')
      .insert({
        round_id: input.roundId,
        stake_per_man: input.stakePerMan,
        auto_press: input.autoPress ?? false,
        auto_press_threshold: input.autoPressThreshold ?? 2,
        high_ball_tiebreaker: input.highBallTiebreaker ?? false,
        team_a_player1_id: input.teamAPlayer1Id,
        team_a_player2_id: input.teamAPlayer2Id ?? null,
        team_b_player1_id: input.teamBPlayer1Id,
        team_b_player2_id: input.teamBPlayer2Id ?? null,
      })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, id: data.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create Nassau bet' }
  }
}

// ============================================================================
// Get Nassau State
// ============================================================================

export async function getNassauStateAction(roundId: string): Promise<{
  nassauState?: NassauState
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  try {
    // Get nassau bet config
    const { data: nassau, error: nassauError } = await supabase
      .from('nassau_bets')
      .select('*')
      .eq('round_id', roundId)
      .single()

    if (nassauError || !nassau) {
      return { error: 'Nassau bet not found' }
    }

    // Get round with holes
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select(`
        id,
        tees (
          id,
          holes (*)
        ),
        groups (
          id,
          group_players (
            id,
            player_id,
            playing_handicap,
            players (id, name)
          )
        )
      `)
      .eq('id', roundId)
      .single()

    if (roundError || !round) return { error: 'Round not found' }

    const holes = (round.tees as unknown as { holes: DbHole[] } | null)?.holes as DbHole[] | undefined
    if (!holes?.length) return { error: 'No hole data' }

    // Build player info from groups
    const playerMap: Record<string, NassauPlayerInfo> = {}
    for (const group of round.groups || []) {
      for (const gp of group.group_players || []) {
        const player = (gp as unknown as { players: { id: string; name: string } | null }).players
        if (player) {
          playerMap[player.id] = {
            id: player.id,
            name: player.name,
            playingHandicap: gp.playing_handicap,
          }
        }
      }
    }

    // Build teams
    const teamA = [
      playerMap[nassau.team_a_player1_id],
      nassau.team_a_player2_id ? playerMap[nassau.team_a_player2_id] : null,
    ].filter((p): p is NassauPlayerInfo => p !== null)

    const teamB = [
      playerMap[nassau.team_b_player1_id],
      nassau.team_b_player2_id ? playerMap[nassau.team_b_player2_id] : null,
    ].filter((p): p is NassauPlayerInfo => p !== null)

    // Get scores
    const { data: scores } = await supabase
      .from('scores')
      .select('player_id, hole_number, gross_strokes')
      .eq('round_id', roundId)

    const scoresMap: Record<string, Record<number, number>> = {}
    for (const score of scores || []) {
      if (!scoresMap[score.player_id]) scoresMap[score.player_id] = {}
      if (score.gross_strokes !== null) {
        scoresMap[score.player_id][score.hole_number] = score.gross_strokes
      }
    }

    const nassauState = computeNassauState(
      roundId,
      nassau.stake_per_man,
      nassau.auto_press,
      nassau.auto_press_threshold,
      { teamA, teamB },
      scoresMap,
      holes
    )

    return { nassauState }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to get Nassau state' }
  }
}
