'use server'

import { createClient } from './server'
import type {
  DbRound,
  DbRoundWithTee,
  DbRoundWithGroups,
  DbGroup,
  DbGroupWithPlayers,
  DbGroupInsert,
  DbGroupPlayerInsert,
} from './types'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Types
// ============================================================================

export interface CreateRoundInput {
  trip_id: string
  tee_id?: string | null
  name: string
  date: string
  tee_time?: string | null  // Round-level tee time (TIMESTAMPTZ)
  format?: 'stroke_play' | 'match_play' | 'points_hilo' | 'stableford'
  scoring_basis?: 'gross' | 'net'
}

export interface UpdateRoundInput {
  name?: string
  date?: string
  tee_time?: string | null
  status?: 'upcoming' | 'in_progress' | 'completed'
  format?: 'stroke_play' | 'match_play' | 'points_hilo' | 'stableford'
  scoring_basis?: 'gross' | 'net'
  tee_id?: string | null
}

export interface CreateGroupInput {
  round_id: string
  group_number: number
  tee_time?: string | null
  scorer_player_id?: string | null
}

export interface RoundActionResult {
  success: boolean
  roundId?: string
  error?: string
}

export interface GroupActionResult {
  success: boolean
  groupId?: string
  error?: string
}

// ============================================================================
// Get Rounds for Trip
// ============================================================================

export async function getRoundsAction(tripId: string): Promise<{
  rounds: DbRoundWithTee[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { rounds: [], error: 'Not authenticated' }
  }

  try {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select(`
        *,
        tees (
          *,
          holes (*),
          courses (*)
        )
      `)
      .eq('trip_id', tripId)
      .order('date', { ascending: false })

    if (error) {
      console.error('Get rounds error:', error)
      return { rounds: [], error: error.message }
    }

    return { rounds: rounds as DbRoundWithTee[] }
  } catch (err) {
    console.error('Get rounds error:', err)
    return {
      rounds: [],
      error: err instanceof Error ? err.message : 'Failed to load rounds',
    }
  }
}

// ============================================================================
// Get Single Round with Groups
// ============================================================================

export async function getRoundAction(roundId: string): Promise<{
  round?: DbRoundWithGroups
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const { data: round, error } = await supabase
      .from('rounds')
      .select(`
        *,
        tees (
          *,
          holes (*),
          courses (*)
        ),
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

    if (error) {
      console.error('Get round error:', error)
      return { error: error.message }
    }

    return { round: round as DbRoundWithGroups }
  } catch (err) {
    console.error('Get round error:', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to load round',
    }
  }
}

// ============================================================================
// Create Round
// ============================================================================

export async function createRoundAction(input: CreateRoundInput): Promise<RoundActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: round, error } = await supabase
      .from('rounds')
      .insert({
        trip_id: input.trip_id,
        tee_id: input.tee_id ?? null,
        name: input.name,
        date: input.date,
        format: input.format || 'stroke_play',
        scoring_basis: input.scoring_basis || 'net',
        status: 'upcoming',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create round error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${input.trip_id}`)
    return { success: true, roundId: round.id }
  } catch (err) {
    console.error('Create round error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create round',
    }
  }
}

// ============================================================================
// Update Round
// ============================================================================

export async function updateRoundAction(
  roundId: string,
  tripId: string,
  input: UpdateRoundInput
): Promise<RoundActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('rounds')
      .update(input)
      .eq('id', roundId)

    if (error) {
      console.error('Update round error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}/round/${roundId}`)
    return { success: true, roundId }
  } catch (err) {
    console.error('Update round error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update round',
    }
  }
}

// ============================================================================
// Delete Round
// ============================================================================

export async function deleteRoundAction(
  roundId: string,
  tripId: string
): Promise<RoundActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('rounds')
      .delete()
      .eq('id', roundId)

    if (error) {
      console.error('Delete round error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true }
  } catch (err) {
    console.error('Delete round error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete round',
    }
  }
}

// ============================================================================
// Create Group
// ============================================================================

export async function createGroupAction(input: CreateGroupInput): Promise<GroupActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        round_id: input.round_id,
        group_number: input.group_number,
        tee_time: input.tee_time ?? null,
        scorer_player_id: input.scorer_player_id ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create group error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, groupId: group.id }
  } catch (err) {
    console.error('Create group error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create group',
    }
  }
}

// ============================================================================
// Add Player to Group
// ============================================================================

export async function addPlayerToGroupAction(
  groupId: string,
  playerId: string,
  playingHandicap?: number | null
): Promise<GroupActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('group_players')
      .insert({
        group_id: groupId,
        player_id: playerId,
        playing_handicap: playingHandicap ?? null,
      })

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Player already in this group' }
      }
      console.error('Add player to group error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Add player to group error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add player to group',
    }
  }
}

// ============================================================================
// Remove Player from Group
// ============================================================================

export async function removePlayerFromGroupAction(
  groupId: string,
  playerId: string
): Promise<GroupActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('group_players')
      .delete()
      .eq('group_id', groupId)
      .eq('player_id', playerId)

    if (error) {
      console.error('Remove player from group error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Remove player from group error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove player from group',
    }
  }
}

// ============================================================================
// Update Playing Handicap
// ============================================================================

export async function updatePlayingHandicapAction(
  groupId: string,
  playerId: string,
  playingHandicap: number
): Promise<GroupActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('group_players')
      .update({ playing_handicap: playingHandicap })
      .eq('group_id', groupId)
      .eq('player_id', playerId)

    if (error) {
      console.error('Update playing handicap error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Update playing handicap error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update playing handicap',
    }
  }
}

// ============================================================================
// Delete Group
// ============================================================================

export async function deleteGroupAction(groupId: string): Promise<GroupActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      console.error('Delete group error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Delete group error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete group',
    }
  }
}

// ============================================================================
// Create Round with Groups and Players
// ============================================================================

export interface CreateRoundWithGroupsInput extends CreateRoundInput {
  groups: Array<{
    tee_time?: string | null
    player_ids: string[]
    playing_handicaps?: Record<string, number>
  }>
  // Team assignments for Points Hi/Lo and Stableford formats
  // Maps playerId -> team number (1 or 2)
  team_assignments?: Record<string, 1 | 2>
}

export async function createRoundWithGroupsAction(
  input: CreateRoundWithGroupsInput
): Promise<RoundActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate team assignments for format rounds
  const formatRequiresTeams = input.format === 'points_hilo' || input.format === 'stableford'
  if (formatRequiresTeams) {
    const allPlayerIds = input.groups.flatMap(g => g.player_ids)

    // Must have exactly 4 players for v1
    if (allPlayerIds.length !== 4) {
      return {
        success: false,
        error: 'Points Hi/Lo and Stableford formats require exactly 4 players'
      }
    }

    // Must have team assignments
    if (!input.team_assignments) {
      return {
        success: false,
        error: 'Team assignments required for this format'
      }
    }

    // Validate 2 players per team
    const team1Count = allPlayerIds.filter(id => input.team_assignments![id] === 1).length
    const team2Count = allPlayerIds.filter(id => input.team_assignments![id] === 2).length

    if (team1Count !== 2 || team2Count !== 2) {
      return {
        success: false,
        error: 'Each team must have exactly 2 players'
      }
    }
  }

  try {
    // Create the round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        trip_id: input.trip_id,
        tee_id: input.tee_id ?? null,
        name: input.name,
        date: input.date,
        tee_time: input.tee_time ?? null,
        format: input.format || 'stroke_play',
        scoring_basis: input.scoring_basis || 'net',
        status: 'upcoming',
      })
      .select('id')
      .single()

    if (roundError) {
      console.error('Create round error:', roundError)
      return { success: false, error: roundError.message }
    }

    // Create groups and add players
    for (let i = 0; i < input.groups.length; i++) {
      const groupInput = input.groups[i]

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          round_id: round.id,
          group_number: i + 1,
          tee_time: groupInput.tee_time ?? null,
          scorer_player_id: groupInput.player_ids[0] ?? null,
        })
        .select('id')
        .single()

      if (groupError) {
        console.error('Create group error:', groupError)
        continue
      }

      // Add players to group with team assignments
      const groupPlayersData = groupInput.player_ids.map((playerId) => ({
        group_id: group.id,
        player_id: playerId,
        playing_handicap: groupInput.playing_handicaps?.[playerId] ?? null,
        team_number: input.team_assignments?.[playerId] ?? null,
      }))

      if (groupPlayersData.length > 0) {
        const { error: playersError } = await supabase
          .from('group_players')
          .insert(groupPlayersData)

        if (playersError) {
          console.error('Add players to group error:', playersError)
        }
      }
    }

    revalidatePath(`/trip/${input.trip_id}`)
    return { success: true, roundId: round.id }
  } catch (err) {
    console.error('Create round with groups error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create round',
    }
  }
}
