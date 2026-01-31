'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import type { DbHole } from './types'

// ============================================================================
// Types
// ============================================================================

export interface ScrambleRoundResult {
  roundId: string
  roundName: string
  status: 'in_progress' | 'completed'
  team1Players: string[]
  team2Players: string[]
  team1Total: number
  team2Total: number
  team1ToPar?: number
  team2ToPar?: number
  winner: 'team1' | 'team2' | 'tied'
  margin: number
  holesCompleted: number
}

// ============================================================================
// Get Scramble Round Results for a Trip (used by leaderboard)
// ============================================================================

export async function getScrambleRoundResultsAction(tripId: string): Promise<{
  results: ScrambleRoundResult[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { results: [], error: 'Not authenticated' }
  }

  try {
    // Get all scramble rounds for this trip
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        id,
        name,
        status,
        tees (
          id,
          par,
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
      .eq('trip_id', tripId)
      .eq('format', 'scramble')
      .in('status', ['in_progress', 'completed'])
      .order('date', { ascending: false })

    if (roundsError) {
      return { results: [], error: roundsError.message }
    }

    const results: ScrambleRoundResult[] = []

    for (const round of rounds || []) {
      const holes = ((round.tees as any)?.holes as DbHole[]) || []
      const totalHoles = holes.length || 18
      const totalPar = holes.reduce((sum, h) => sum + h.par, 0) || totalHoles * 4

      // Build team rosters
      const team1Players: { id: string; name: string }[] = []
      const team2Players: { id: string; name: string }[] = []

      for (const group of round.groups || []) {
        for (const gp of group.group_players || []) {
          const player = (gp as any).players
          if (!player) continue
          if (gp.team_number === 1) team1Players.push({ id: player.id, name: player.name })
          if (gp.team_number === 2) team2Players.push({ id: player.id, name: player.name })
        }
      }

      if (team1Players.length === 0 || team2Players.length === 0) continue

      // Captain = first player on each team (scores stored under their ID)
      const team1CaptainId = team1Players[0].id
      const team2CaptainId = team2Players[0].id

      // Get scores for both captains
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('player_id, hole_number, gross_strokes')
        .eq('round_id', round.id)
        .in('player_id', [team1CaptainId, team2CaptainId])

      if (scoresError) continue

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

      const holesCompleted = Math.min(team1Holes, team2Holes)
      if (holesCompleted === 0) continue

      const margin = Math.abs(team1Total - team2Total)
      let winner: 'team1' | 'team2' | 'tied'
      if (team1Total < team2Total) winner = 'team1'
      else if (team2Total < team1Total) winner = 'team2'
      else winner = 'tied'

      // Calculate to-par only if we have hole data
      const team1ToPar = holes.length > 0
        ? team1Total - holes.filter((h) =>
            (scores || []).some(
              (s) => s.player_id === team1CaptainId && s.hole_number === h.hole_number && s.gross_strokes !== null
            )
          ).reduce((sum, h) => sum + h.par, 0)
        : undefined

      const team2ToPar = holes.length > 0
        ? team2Total - holes.filter((h) =>
            (scores || []).some(
              (s) => s.player_id === team2CaptainId && s.hole_number === h.hole_number && s.gross_strokes !== null
            )
          ).reduce((sum, h) => sum + h.par, 0)
        : undefined

      results.push({
        roundId: round.id,
        roundName: round.name,
        status: round.status as 'in_progress' | 'completed',
        team1Players: team1Players.map((p) => p.name),
        team2Players: team2Players.map((p) => p.name),
        team1Total,
        team2Total,
        team1ToPar,
        team2ToPar,
        winner,
        margin,
        holesCompleted,
      })
    }

    return { results }
  } catch (err) {
    console.error('Get scramble round results error:', err)
    return {
      results: [],
      error: err instanceof Error ? err.message : 'Failed to load scramble results',
    }
  }
}
