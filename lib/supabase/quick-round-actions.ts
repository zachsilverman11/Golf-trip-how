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
}

export interface QuickRoundResult {
  success: boolean
  tripId?: string
  roundId?: string
  error?: string
}

/**
 * Creates a "Quick Round" - a trip with a single round using inline player entry.
 * Trip is named "Quick Round - {date}" for easy identification.
 */
export async function createQuickRoundAction(input: CreateQuickRoundInput): Promise<QuickRoundResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (input.players.length === 0) {
    return { success: false, error: 'At least one player is required' }
  }

  const today = new Date().toISOString().split('T')[0]
  const displayDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  try {
    // 1. Create the trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        name: `Quick Round - ${displayDate}`,
        description: input.courseName ? `Quick round at ${input.courseName}` : 'Quick round',
        start_date: today,
        end_date: today,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (tripError) {
      console.error('Create trip error:', tripError)
      return { success: false, error: tripError.message }
    }

    // 2. Add user as trip admin
    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) {
      console.error('Add member error:', memberError)
    }

    // 3. Create players
    const playersToInsert = input.players.map((p) => ({
      trip_id: trip.id,
      name: p.name,
      handicap_index: p.handicap,
    }))

    const { data: players, error: playersError } = await supabase
      .from('players')
      .insert(playersToInsert)
      .select('id, name')

    if (playersError || !players) {
      console.error('Create players error:', playersError)
      return { success: false, error: playersError?.message || 'Failed to create players' }
    }

    // 4. Create the round
    let teeTimeTimestamp: string | null = null
    if (input.teeTime) {
      teeTimeTimestamp = `${today}T${input.teeTime}:00`
    }

    const roundName = input.courseName || 'Quick Round'

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        trip_id: trip.id,
        tee_id: input.teeId,
        name: roundName,
        date: today,
        tee_time: teeTimeTimestamp,
        format: input.format,
        scoring_basis: input.scoringBasis,
        status: 'upcoming',
      })
      .select('id')
      .single()

    if (roundError) {
      console.error('Create round error:', roundError)
      return { success: false, error: roundError.message }
    }

    // 5. Create a single group with all players
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        round_id: round.id,
        group_number: 1,
        tee_time: input.teeTime || null,
        scorer_player_id: players[0]?.id || null,
      })
      .select('id')
      .single()

    if (groupError) {
      console.error('Create group error:', groupError)
      return { success: false, error: groupError.message }
    }

    // 6. Add all players to the group
    const groupPlayersData = players.map((player) => {
      const inputPlayer = input.players.find((p) => p.name === player.name)
      return {
        group_id: group.id,
        player_id: player.id,
        playing_handicap: inputPlayer?.handicap ?? null,
      }
    })

    const { error: gpError } = await supabase
      .from('group_players')
      .insert(groupPlayersData)

    if (gpError) {
      console.error('Add players to group error:', gpError)
    }

    revalidatePath('/trips')
    return { success: true, tripId: trip.id, roundId: round.id }
  } catch (err) {
    console.error('Create quick round error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create quick round',
    }
  }
}
