'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import type { DbJunkBet, DbJunkBetInsert, JunkType, RoundJunkConfig } from '../junk-types'

// ============================================================================
// Types
// ============================================================================

export interface JunkActionResult {
  success: boolean
  id?: string
  error?: string
}

// ============================================================================
// Get Junk Bets for a Round
// ============================================================================

export async function getJunkBetsAction(roundId: string): Promise<{
  bets: DbJunkBet[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { bets: [], error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase
      .from('junk_bets')
      .select('*')
      .eq('round_id', roundId)
      .order('hole_number')

    if (error) {
      console.error('Get junk bets error:', error)
      return { bets: [], error: error.message }
    }

    return { bets: (data || []) as DbJunkBet[] }
  } catch (err) {
    console.error('Get junk bets error:', err)
    return {
      bets: [],
      error: err instanceof Error ? err.message : 'Failed to load junk bets',
    }
  }
}

// ============================================================================
// Get Junk Bets for a Specific Hole
// ============================================================================

export async function getJunkBetsForHoleAction(
  roundId: string,
  holeNumber: number
): Promise<{
  bets: DbJunkBet[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { bets: [], error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase
      .from('junk_bets')
      .select('*')
      .eq('round_id', roundId)
      .eq('hole_number', holeNumber)

    if (error) {
      console.error('Get junk bets for hole error:', error)
      return { bets: [], error: error.message }
    }

    return { bets: (data || []) as DbJunkBet[] }
  } catch (err) {
    console.error('Get junk bets for hole error:', err)
    return {
      bets: [],
      error: err instanceof Error ? err.message : 'Failed to load junk bets for hole',
    }
  }
}

// ============================================================================
// Toggle Junk Bet (claim or unclaim)
// ============================================================================

export async function toggleJunkBetAction(input: {
  roundId: string
  playerId: string
  holeNumber: number
  junkType: JunkType
  value: number
}): Promise<JunkActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Check if this claim already exists
    const { data: existing, error: checkError } = await supabase
      .from('junk_bets')
      .select('id')
      .eq('round_id', input.roundId)
      .eq('player_id', input.playerId)
      .eq('hole_number', input.holeNumber)
      .eq('junk_type', input.junkType)
      .maybeSingle()

    if (checkError) {
      console.error('Check junk bet error:', checkError)
      return { success: false, error: checkError.message }
    }

    if (existing) {
      // Remove the claim (unclaim)
      const { error: deleteError } = await supabase
        .from('junk_bets')
        .delete()
        .eq('id', existing.id)

      if (deleteError) {
        console.error('Delete junk bet error:', deleteError)
        return { success: false, error: deleteError.message }
      }

      return { success: true }
    } else {
      // Create the claim
      const { data, error: insertError } = await supabase
        .from('junk_bets')
        .insert({
          round_id: input.roundId,
          player_id: input.playerId,
          hole_number: input.holeNumber,
          junk_type: input.junkType,
          value: input.value,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Insert junk bet error:', insertError)
        return { success: false, error: insertError.message }
      }

      return { success: true, id: data.id }
    }
  } catch (err) {
    console.error('Toggle junk bet error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle junk bet',
    }
  }
}

// ============================================================================
// Get Junk Config for a Round
// ============================================================================

export async function getJunkConfigAction(roundId: string): Promise<{
  config: RoundJunkConfig | null
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { config: null, error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('junk_config')
      .eq('id', roundId)
      .single()

    if (error) {
      console.error('Get junk config error:', error)
      return { config: null, error: error.message }
    }

    return { config: (data.junk_config as RoundJunkConfig) || null }
  } catch (err) {
    console.error('Get junk config error:', err)
    return {
      config: null,
      error: err instanceof Error ? err.message : 'Failed to load junk config',
    }
  }
}

// ============================================================================
// Save Junk Config for a Round
// ============================================================================

export async function saveJunkConfigAction(
  roundId: string,
  config: RoundJunkConfig
): Promise<JunkActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('rounds')
      .update({ junk_config: config })
      .eq('id', roundId)

    if (error) {
      console.error('Save junk config error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Save junk config error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save junk config',
    }
  }
}

// ============================================================================
// Get Junk Settlement for a Round
// ============================================================================

export async function getJunkSettlementAction(roundId: string): Promise<{
  bets: DbJunkBet[]
  config: RoundJunkConfig | null
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { bets: [], config: null, error: 'Not authenticated' }
  }

  try {
    const [betsResult, configResult] = await Promise.all([
      supabase
        .from('junk_bets')
        .select('*')
        .eq('round_id', roundId)
        .order('hole_number'),
      supabase
        .from('rounds')
        .select('junk_config')
        .eq('id', roundId)
        .single(),
    ])

    if (betsResult.error) {
      console.error('Get junk settlement bets error:', betsResult.error)
      return { bets: [], config: null, error: betsResult.error.message }
    }

    if (configResult.error) {
      console.error('Get junk settlement config error:', configResult.error)
      return { bets: [], config: null, error: configResult.error.message }
    }

    return {
      bets: (betsResult.data || []) as DbJunkBet[],
      config: (configResult.data.junk_config as RoundJunkConfig) || null,
    }
  } catch (err) {
    console.error('Get junk settlement error:', err)
    return {
      bets: [],
      config: null,
      error: err instanceof Error ? err.message : 'Failed to load junk settlement',
    }
  }
}

// ============================================================================
// Get All Junk Bets for a Trip (for settlement page)
// ============================================================================

export async function getTripJunkBetsAction(tripId: string): Promise<{
  roundBets: {
    roundId: string
    roundName: string
    bets: DbJunkBet[]
    config: RoundJunkConfig | null
  }[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { roundBets: [], error: 'Not authenticated' }
  }

  try {
    // Get all rounds with junk enabled
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, name, junk_config')
      .eq('trip_id', tripId)
      .not('junk_config', 'is', null)
      .order('date')

    if (roundsError) {
      console.error('Get trip rounds for junk error:', roundsError)
      return { roundBets: [], error: roundsError.message }
    }

    if (!rounds || rounds.length === 0) {
      return { roundBets: [] }
    }

    // Get all junk bets for these rounds
    const roundIds = rounds.map((r) => r.id)
    const { data: bets, error: betsError } = await supabase
      .from('junk_bets')
      .select('*')
      .in('round_id', roundIds)
      .order('hole_number')

    if (betsError) {
      console.error('Get trip junk bets error:', betsError)
      return { roundBets: [], error: betsError.message }
    }

    // Group bets by round
    const result = rounds
      .filter((r) => {
        const config = r.junk_config as RoundJunkConfig | null
        return config?.enabled
      })
      .map((r) => ({
        roundId: r.id,
        roundName: r.name,
        bets: ((bets || []) as DbJunkBet[]).filter((b) => b.round_id === r.id),
        config: r.junk_config as RoundJunkConfig | null,
      }))

    return { roundBets: result }
  } catch (err) {
    console.error('Get trip junk bets error:', err)
    return {
      roundBets: [],
      error: err instanceof Error ? err.message : 'Failed to load trip junk bets',
    }
  }
}
