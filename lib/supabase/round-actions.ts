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
import { generateRoundEvent } from './feed-actions'

// ============================================================================
// Check if Round has Scores
// ============================================================================

export async function checkRoundHasScoresAction(roundId: string): Promise<{
  hasScores: boolean
  scoreCount: number
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { hasScores: false, scoreCount: 0, error: 'Not authenticated' }
  }

  try {
    const { count, error } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', roundId)
      .not('gross_strokes', 'is', null)

    if (error) {
      console.error('Check scores error:', error)
      return { hasScores: false, scoreCount: 0, error: error.message }
    }

    return { hasScores: (count || 0) > 0, scoreCount: count || 0 }
  } catch (err) {
    console.error('Check scores error:', err)
    return {
      hasScores: false,
      scoreCount: 0,
      error: err instanceof Error ? err.message : 'Failed to check scores',
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export interface CreateRoundInput {
  trip_id: string
  tee_id?: string | null
  name: string
  date: string
  tee_time?: string | null  // Round-level tee time (TIMESTAMPTZ)
  format?: import('./types').RoundFormat
  scoring_basis?: 'gross' | 'net'
}

export interface UpdateRoundInput {
  name?: string
  date?: string
  tee_time?: string | null
  status?: 'upcoming' | 'in_progress' | 'completed'
  format?: import('./types').RoundFormat
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
// Get Active (in-progress) Round for Trip
// ============================================================================

export async function getActiveRoundAction(tripId: string): Promise<{
  roundId: string | null
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { roundId: null, error: 'Not authenticated' }
  }

  try {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('id')
      .eq('trip_id', tripId)
      .eq('status', 'in_progress')
      .order('date', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Get active round error:', error)
      return { roundId: null, error: error.message }
    }

    return { roundId: rounds && rounds.length > 0 ? rounds[0].id : null }
  } catch (err) {
    console.error('Get active round error:', err)
    return {
      roundId: null,
      error: err instanceof Error ? err.message : 'Failed to check active round',
    }
  }
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

    // Generate feed event for round status changes (fire and forget)
    if (input.status === 'in_progress' || input.status === 'completed') {
      const { data: roundData } = await supabase
        .from('rounds')
        .select('name')
        .eq('id', roundId)
        .single()

      if (roundData) {
        const eventType = input.status === 'in_progress' ? 'round_start' as const : 'round_complete' as const
        generateRoundEvent(tripId, roundId, roundData.name, eventType).catch(() => {})
      }
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
// Update Team Assignments (for Points Hi/Lo format)
// ============================================================================

export async function updateTeamAssignmentsAction(
  roundId: string,
  tripId: string,
  teamAssignments: Record<string, 1 | 2>
): Promise<RoundActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get all group_players for this round
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, group_players (id, player_id)')
      .eq('round_id', roundId)

    if (groupsError) {
      return { success: false, error: groupsError.message }
    }

    // Update team_number for each player
    for (const group of groups || []) {
      for (const gp of (group as any).group_players || []) {
        const teamNumber = teamAssignments[gp.player_id]
        if (teamNumber) {
          const { error: updateError } = await supabase
            .from('group_players')
            .update({ team_number: teamNumber })
            .eq('id', gp.id)

          if (updateError) {
            console.error('Update team assignment error:', updateError)
          }
        }
      }
    }

    revalidatePath(`/trip/${tripId}/round/${roundId}`)
    return { success: true, roundId }
  } catch (err) {
    console.error('Update team assignments error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update team assignments',
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
  // Junk/side bet configuration (optional overlay)
  junk_config?: import('../junk-types').RoundJunkConfig | null
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
  const needsTeams = input.format === 'points_hilo' || input.format === 'nassau'
  if (needsTeams) {
    const allPlayerIds = input.groups.flatMap(g => g.player_ids)

    // Must have exactly 4 players for team formats
    if (allPlayerIds.length !== 4) {
      return {
        success: false,
        error: `${input.format === 'nassau' ? 'Nassau' : 'Points Hi/Lo'} format requires exactly 4 players`
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

  // Wolf requires exactly 4 players
  if (input.format === 'wolf') {
    const allPlayerIds = input.groups.flatMap(g => g.player_ids)
    if (allPlayerIds.length !== 4) {
      return {
        success: false,
        error: 'Wolf format requires exactly 4 players'
      }
    }
  }

  try {
    // Create the round
    const roundInsert: Record<string, unknown> = {
      trip_id: input.trip_id,
      tee_id: input.tee_id ?? null,
      name: input.name,
      date: input.date,
      tee_time: input.tee_time ?? null,
      format: input.format || 'stroke_play',
      scoring_basis: input.scoring_basis || 'net',
      status: 'upcoming',
    }

    // Include junk config if provided
    if (input.junk_config) {
      roundInsert.junk_config = input.junk_config
    }

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert(roundInsert)
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
        team_number: needsTeams ? (input.team_assignments?.[playerId] ?? null) : null,
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
