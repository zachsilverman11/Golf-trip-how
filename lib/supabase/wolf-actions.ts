'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { computeWolfState } from '../wolf-utils'
import type { WolfState, WolfPlayerInfo, WolfDecision } from '../wolf-utils'
import type { DbHole } from './types'

// ============================================================================
// Create Wolf Bet
// ============================================================================

export interface CreateWolfInput {
  roundId: string
  stakePerHole: number
  loneWolfMultiplier?: number
  teeOrder: string[] // 4 player IDs
}

export async function createWolfBetAction(input: CreateWolfInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (input.teeOrder.length !== 4) {
    return { success: false, error: 'Wolf requires exactly 4 players' }
  }

  try {
    const { data, error } = await supabase
      .from('wolf_bets')
      .insert({
        round_id: input.roundId,
        stake_per_hole: input.stakePerHole,
        lone_wolf_multiplier: input.loneWolfMultiplier ?? 2,
        tee_order: input.teeOrder,
      })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, id: data.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create Wolf bet' }
  }
}

// ============================================================================
// Make Wolf Decision (pick partner or go lone wolf)
// ============================================================================

export interface WolfDecisionInput {
  roundId: string
  holeNumber: number
  partnerId: string | null // null = lone wolf
  isLoneWolf: boolean
}

export async function makeWolfDecisionAction(input: WolfDecisionInput): Promise<{
  success: boolean
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    // Get wolf bet
    const { data: wolfBet, error: betError } = await supabase
      .from('wolf_bets')
      .select('id, tee_order')
      .eq('round_id', input.roundId)
      .single()

    if (betError || !wolfBet) {
      return { success: false, error: 'Wolf bet not found' }
    }

    // Determine wolf for this hole
    const teeOrder = wolfBet.tee_order as string[]
    const wolfId = teeOrder[(input.holeNumber - 1) % teeOrder.length]

    // Upsert decision
    const { error } = await supabase
      .from('wolf_decisions')
      .upsert({
        wolf_bet_id: wolfBet.id,
        hole_number: input.holeNumber,
        wolf_player_id: wolfId,
        partner_player_id: input.partnerId,
        is_lone_wolf: input.isLoneWolf,
      }, {
        onConflict: 'wolf_bet_id,hole_number',
      })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save Wolf decision' }
  }
}

// ============================================================================
// Get Wolf State
// ============================================================================

export async function getWolfStateAction(roundId: string): Promise<{
  wolfState?: WolfState
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  try {
    // Get wolf bet config
    const { data: wolfBet, error: wolfError } = await supabase
      .from('wolf_bets')
      .select('*, wolf_decisions (*)')
      .eq('round_id', roundId)
      .single()

    if (wolfError || !wolfBet) {
      return { error: 'Wolf bet not found' }
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
    const players: WolfPlayerInfo[] = []
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

    // Map DB wolf decisions to util format
    const rawDecisions = (wolfBet as unknown as { wolf_decisions: Array<{
      hole_number: number
      wolf_player_id: string
      partner_player_id: string | null
      is_lone_wolf: boolean
    }> }).wolf_decisions || []
    const wolfDecisions: WolfDecision[] = rawDecisions.map(d => ({
      holeNumber: d.hole_number,
      wolfId: d.wolf_player_id,
      partnerId: d.partner_player_id,
      isLoneWolf: d.is_lone_wolf,
    }))

    const teeOrder = wolfBet.tee_order as string[]

    const wolfState = computeWolfState(
      roundId,
      wolfBet.stake_per_hole,
      wolfBet.lone_wolf_multiplier,
      teeOrder,
      players,
      scoresMap,
      holes,
      wolfDecisions
    )

    return { wolfState }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to get Wolf state' }
  }
}
