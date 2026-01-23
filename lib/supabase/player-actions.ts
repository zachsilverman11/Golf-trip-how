'use server'

import { createClient } from './server'
import type { DbPlayer, DbPlayerInsert } from './types'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Types
// ============================================================================

export interface CreatePlayerInput {
  trip_id: string
  name: string
  handicap_index?: number | null
  user_id?: string | null
}

export interface UpdatePlayerInput {
  name?: string
  handicap_index?: number | null
  user_id?: string | null
}

export interface PlayerActionResult {
  success: boolean
  playerId?: string
  error?: string
}

// ============================================================================
// Get Players for Trip
// ============================================================================

export async function getPlayersAction(tripId: string): Promise<{
  players: DbPlayer[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { players: [], error: 'Not authenticated' }
  }

  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .eq('trip_id', tripId)
      .order('name')

    if (error) {
      console.error('Get players error:', error)
      return { players: [], error: error.message }
    }

    return { players: players || [] }
  } catch (err) {
    console.error('Get players error:', err)
    return {
      players: [],
      error: err instanceof Error ? err.message : 'Failed to load players',
    }
  }
}

// ============================================================================
// Create Player
// ============================================================================

export async function createPlayerAction(input: CreatePlayerInput): Promise<PlayerActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: player, error } = await supabase
      .from('players')
      .insert({
        trip_id: input.trip_id,
        name: input.name,
        handicap_index: input.handicap_index ?? null,
        user_id: input.user_id ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create player error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${input.trip_id}/players`)
    return { success: true, playerId: player.id }
  } catch (err) {
    console.error('Create player error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create player',
    }
  }
}

// ============================================================================
// Update Player
// ============================================================================

export async function updatePlayerAction(
  playerId: string,
  tripId: string,
  input: UpdatePlayerInput
): Promise<PlayerActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('players')
      .update({
        name: input.name,
        handicap_index: input.handicap_index,
        user_id: input.user_id,
      })
      .eq('id', playerId)

    if (error) {
      console.error('Update player error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}/players`)
    return { success: true, playerId }
  } catch (err) {
    console.error('Update player error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update player',
    }
  }
}

// ============================================================================
// Delete Player
// ============================================================================

export async function deletePlayerAction(
  playerId: string,
  tripId: string
): Promise<PlayerActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)

    if (error) {
      console.error('Delete player error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}/players`)
    return { success: true }
  } catch (err) {
    console.error('Delete player error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete player',
    }
  }
}

// ============================================================================
// Bulk Create Players
// ============================================================================

export async function bulkCreatePlayersAction(
  tripId: string,
  players: Array<{ name: string; handicap_index?: number | null }>
): Promise<PlayerActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const playersToInsert = players.map((p) => ({
      trip_id: tripId,
      name: p.name,
      handicap_index: p.handicap_index ?? null,
      user_id: null,
    }))

    const { error } = await supabase
      .from('players')
      .insert(playersToInsert)

    if (error) {
      console.error('Bulk create players error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}/players`)
    return { success: true }
  } catch (err) {
    console.error('Bulk create players error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create players',
    }
  }
}
