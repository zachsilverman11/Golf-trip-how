'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'
import { computeFormatState } from '../format-utils'
import type { DbTripTeamAssignment, DbHole } from './types'

// ============================================================================
// Types
// ============================================================================

export interface WarActionResult {
  success: boolean
  error?: string
}

export interface WarTotals {
  competitionName: string
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
  rounds: {
    roundName: string
    roundFormat: string
    teamAPoints: number
    teamBPoints: number
  }[]
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
// Update Competition Name
// ============================================================================

export async function updateCompetitionNameAction(
  tripId: string,
  name: string
): Promise<WarActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('trips')
      .update({ competition_name: name.trim() || 'The Cup' })
      .eq('id', tripId)

    if (error) {
      console.error('Update competition name error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true }
  } catch (err) {
    console.error('Update competition name error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update competition name',
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
// Calculate War Totals — Fixed 1/0.5/0 Scoring
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
    // Get trip for competition name
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('competition_name')
      .eq('id', tripId)
      .single()

    if (tripError) {
      return { totals: null, error: tripError.message }
    }

    const competitionName = trip?.competition_name || 'The Cup'

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

    // Get all rounds for this trip
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, name, format, status')
      .eq('trip_id', tripId)

    if (roundsError) {
      return { totals: null, error: roundsError.message }
    }

    // Filter to relevant formats
    const matchPlayRounds = rounds?.filter((r) => r.format === 'match_play') || []
    const pointsHiLoRounds = rounds?.filter((r) => r.format === 'points_hilo') || []
    const scrambleRounds = rounds?.filter((r) => r.format === 'scramble') || []

    const totals: WarTotals = {
      competitionName,
      teamA: { points: 0, wins: 0, losses: 0, ties: 0 },
      teamB: { points: 0, wins: 0, losses: 0, ties: 0 },
      rounds: [],
    }

    // ---- MATCH PLAY SCORING (1/0.5/0 per match) ----
    const matchPlayRoundIds = matchPlayRounds.map((r) => r.id)

    if (matchPlayRoundIds.length > 0) {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('*, round_id')
        .in('round_id', matchPlayRoundIds)
        .eq('status', 'completed')

      if (matchesError) {
        return { totals: null, error: matchesError.message }
      }

      // Group matches by round for per-round breakdown
      const matchesByRound: Record<string, typeof matches> = {}
      for (const match of matches || []) {
        if (!matchesByRound[match.round_id]) {
          matchesByRound[match.round_id] = []
        }
        matchesByRound[match.round_id].push(match)
      }

      for (const round of matchPlayRounds) {
        const roundMatches = matchesByRound[round.id] || []
        let roundTeamA = 0
        let roundTeamB = 0

        for (const match of roundMatches) {
          // Determine which war team each match team belongs to
          const matchTeamAWarTeam = playerTeamMap[match.team_a_player1_id]
          const matchTeamBWarTeam = playerTeamMap[match.team_b_player1_id]

          if (!matchTeamAWarTeam || !matchTeamBWarTeam) continue
          if (matchTeamAWarTeam === matchTeamBWarTeam) continue // Same war team, doesn't count

          if (match.winner === 'team_a') {
            // Match team A won — award 1 point to their war team
            if (matchTeamAWarTeam === 'A') {
              totals.teamA.points += 1
              totals.teamA.wins++
              totals.teamB.losses++
              roundTeamA += 1
            } else {
              totals.teamB.points += 1
              totals.teamB.wins++
              totals.teamA.losses++
              roundTeamB += 1
            }
          } else if (match.winner === 'team_b') {
            // Match team B won — award 1 point to their war team
            if (matchTeamBWarTeam === 'A') {
              totals.teamA.points += 1
              totals.teamA.wins++
              totals.teamB.losses++
              roundTeamA += 1
            } else {
              totals.teamB.points += 1
              totals.teamB.wins++
              totals.teamA.losses++
              roundTeamB += 1
            }
          } else if (match.winner === 'halved') {
            totals.teamA.points += 0.5
            totals.teamB.points += 0.5
            totals.teamA.ties++
            totals.teamB.ties++
            roundTeamA += 0.5
            roundTeamB += 0.5
          }
        }

        if (roundMatches.length > 0) {
          totals.rounds.push({
            roundName: round.name,
            roundFormat: 'Match Play',
            teamAPoints: roundTeamA,
            teamBPoints: roundTeamB,
          })
        }
      }
    }

    // ---- POINTS HI/LO SCORING (1/0.5/0 per round based on team totals) ----
    for (const round of pointsHiLoRounds) {
      if (round.status !== 'completed' && round.status !== 'in_progress') continue

      // Get round data with tees and groups
      const { data: roundData, error: roundDataError } = await supabase
        .from('rounds')
        .select(`
          id,
          format,
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
              team_number,
              players (id, name)
            )
          )
        `)
        .eq('id', round.id)
        .single()

      if (roundDataError || !roundData) continue

      const holes = (roundData.tees as any)?.holes as DbHole[] | undefined
      if (!holes?.length) continue

      // Build players array
      const players: Array<{
        playerId: string
        playerName: string
        playingHandicap: number | null
        teamNumber: 1 | 2 | null
      }> = []

      for (const group of roundData.groups || []) {
        for (const gp of group.group_players || []) {
          const player = (gp as any).players
          if (player) {
            players.push({
              playerId: player.id,
              playerName: player.name,
              playingHandicap: gp.playing_handicap,
              teamNumber: gp.team_number as 1 | 2 | null,
            })
          }
        }
      }

      // Get scores
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('player_id, hole_number, gross_strokes')
        .eq('round_id', round.id)

      if (scoresError) continue

      // Build scores map
      const scoresMap: Record<string, Record<number, number>> = {}
      for (const score of scores || []) {
        if (!scoresMap[score.player_id]) {
          scoresMap[score.player_id] = {}
        }
        if (score.gross_strokes !== null) {
          scoresMap[score.player_id][score.hole_number] = score.gross_strokes
        }
      }

      // Compute format state
      const formatState = computeFormatState(
        'points_hilo',
        round.id,
        players,
        scoresMap,
        holes
      )

      if (!formatState || formatState.holesPlayed === 0) continue

      // Map round teams to war teams
      // For each team in the round, figure out which war team the majority of players belong to
      const team1WarTeams = formatState.team1.players
        .map((p) => playerTeamMap[p.id])
        .filter(Boolean)
      const team2WarTeams = formatState.team2.players
        .map((p) => playerTeamMap[p.id])
        .filter(Boolean)

      // Determine war team for round team 1 and 2
      const team1IsWarA = team1WarTeams.filter((t) => t === 'A').length >= team1WarTeams.filter((t) => t === 'B').length
      const team1WarTeam = team1IsWarA ? 'A' : 'B'
      const team2WarTeam = team1WarTeam === 'A' ? 'B' : 'A'

      const team1Total = formatState.team1Total
      const team2Total = formatState.team2Total

      const warATotal = team1WarTeam === 'A' ? team1Total : team2Total
      const warBTotal = team1WarTeam === 'A' ? team2Total : team1Total

      // Compare totals: higher total wins the round point
      if (warATotal > warBTotal) {
        totals.teamA.points += 1
        totals.teamA.wins++
        totals.teamB.losses++
      } else if (warBTotal > warATotal) {
        totals.teamB.points += 1
        totals.teamB.wins++
        totals.teamA.losses++
      } else {
        // Tied
        totals.teamA.points += 0.5
        totals.teamB.points += 0.5
        totals.teamA.ties++
        totals.teamB.ties++
      }

      totals.rounds.push({
        roundName: round.name,
        roundFormat: 'Points Hi/Lo',
        teamAPoints: warATotal > warBTotal ? 1 : warATotal === warBTotal ? 0.5 : 0,
        teamBPoints: warBTotal > warATotal ? 1 : warATotal === warBTotal ? 0.5 : 0,
      })
    }

    // ---- SCRAMBLE SCORING (1/0.5/0 per round based on team totals) ----
    for (const round of scrambleRounds) {
      if (round.status !== 'completed' && round.status !== 'in_progress') continue

      // Get round data with groups and players
      const { data: roundData, error: roundDataError } = await supabase
        .from('rounds')
        .select(`
          id,
          format,
          tees (
            id,
            holes (*)
          ),
          groups (
            id,
            group_players (
              id,
              player_id,
              team_number,
              players (id, name)
            )
          )
        `)
        .eq('id', round.id)
        .single()

      if (roundDataError || !roundData) continue

      const holes = (roundData.tees as any)?.holes as DbHole[] | undefined
      const totalHoles = holes?.length || 18

      // Build team rosters from group_players team_number
      const team1Players: string[] = []
      const team2Players: string[] = []

      for (const group of roundData.groups || []) {
        for (const gp of group.group_players || []) {
          if (gp.team_number === 1) team1Players.push(gp.player_id)
          if (gp.team_number === 2) team2Players.push(gp.player_id)
        }
      }

      if (team1Players.length === 0 || team2Players.length === 0) continue

      // In scramble, the first player of each team is the "captain"
      // whose player_id holds the team score
      const team1CaptainId = team1Players[0]
      const team2CaptainId = team2Players[0]

      // Get scores for both captains
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('player_id, hole_number, gross_strokes')
        .eq('round_id', round.id)
        .in('player_id', [team1CaptainId, team2CaptainId])

      if (scoresError) continue

      // Sum up team totals
      let team1Total = 0
      let team2Total = 0
      let team1Holes = 0
      let team2Holes = 0

      for (const score of scores || []) {
        if (score.gross_strokes === null) continue
        if (score.player_id === team1CaptainId) {
          team1Total += score.gross_strokes
          team1Holes++
        } else if (score.player_id === team2CaptainId) {
          team2Total += score.gross_strokes
          team2Holes++
        }
      }

      if (team1Holes === 0 || team2Holes === 0) continue

      // Map round teams to war teams
      const team1WarTeams = team1Players
        .map((pid) => playerTeamMap[pid])
        .filter(Boolean)
      const team2WarTeams = team2Players
        .map((pid) => playerTeamMap[pid])
        .filter(Boolean)

      const team1IsWarA =
        team1WarTeams.filter((t) => t === 'A').length >=
        team1WarTeams.filter((t) => t === 'B').length
      const team1WarTeam = team1IsWarA ? 'A' : 'B'

      const warATotal = team1WarTeam === 'A' ? team1Total : team2Total
      const warBTotal = team1WarTeam === 'A' ? team2Total : team1Total

      // Lower score wins in scramble
      if (warATotal < warBTotal) {
        totals.teamA.points += 1
        totals.teamA.wins++
        totals.teamB.losses++
      } else if (warBTotal < warATotal) {
        totals.teamB.points += 1
        totals.teamB.wins++
        totals.teamA.losses++
      } else {
        totals.teamA.points += 0.5
        totals.teamB.points += 0.5
        totals.teamA.ties++
        totals.teamB.ties++
      }

      totals.rounds.push({
        roundName: round.name,
        roundFormat: 'Scramble',
        teamAPoints: warATotal < warBTotal ? 1 : warATotal === warBTotal ? 0.5 : 0,
        teamBPoints: warBTotal < warATotal ? 1 : warATotal === warBTotal ? 0.5 : 0,
      })
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
