'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { computeSkinsState } from '../skins-utils'
import type { SkinsState, SkinsPlayerInfo } from '../skins-utils'
import type { DbHole } from './types'

// ============================================================================
// Create Skins Bet
// ============================================================================

export interface CreateSkinsInput {
  roundId: string
  skinValue: number
  carryover?: boolean
}

export async function createSkinsBetAction(input: CreateSkinsInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const { data, error } = await supabase
      .from('skins_bets')
      .insert({
        round_id: input.roundId,
        skin_value: input.skinValue,
        carryover: input.carryover ?? true,
      })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, id: data.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create Skins bet' }
  }
}

// ============================================================================
// Get Skins State
// ============================================================================

export async function getSkinsStateAction(roundId: string): Promise<{
  skinsState?: SkinsState
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  try {
    // Get skins bet config
    const { data: skins, error: skinsError } = await supabase
      .from('skins_bets')
      .select('*')
      .eq('round_id', roundId)
      .single()

    if (skinsError || !skins) {
      return { error: 'Skins bet not found' }
    }

    // Get round with holes and players
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

    // Build player info
    const players: SkinsPlayerInfo[] = []
    for (const group of round.groups || []) {
      for (const gp of group.group_players || []) {
        const player = (gp as unknown as { players: { id: string; name: string } | null }).players
        if (player) {
          players.push({
            id: player.id,
            name: player.name,
            playingHandicap: gp.playing_handicap,
          })
        }
      }
    }

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

    const skinsState = computeSkinsState(
      roundId,
      skins.skin_value,
      skins.carryover,
      players,
      scoresMap,
      holes
    )

    return { skinsState }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to get Skins state' }
  }
}
