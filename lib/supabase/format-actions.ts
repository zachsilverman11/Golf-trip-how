'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { computeFormatState } from '../format-utils'
import type { FormatState, TripFormatStandings, PlayerFormatStanding } from '../format-types'
import type { DbHole } from './types'

// ============================================================================
// Get Format State for a Round (for live scoring)
// ============================================================================

export async function getFormatStateAction(roundId: string): Promise<{
  formatState?: FormatState
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    // Get round with format, groups, players, and tee data
    const { data: round, error: roundError } = await supabase
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
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      return { error: roundError?.message || 'Round not found' }
    }

    // Only compute for format rounds
    if (round.format !== 'points_hilo' && round.format !== 'stableford') {
      return { error: 'Round is not a format round' }
    }

    // Get holes from tee
    const holes = (round.tees as any)?.holes as DbHole[] | undefined
    if (!holes?.length) {
      return { error: 'No hole data available' }
    }

    // Flatten players from all groups
    const players: Array<{
      playerId: string
      playerName: string
      playingHandicap: number | null
      teamNumber: 1 | 2 | null
    }> = []

    for (const group of round.groups || []) {
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

    // Get scores for this round
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('player_id, hole_number, gross_strokes')
      .eq('round_id', roundId)

    if (scoresError) {
      return { error: scoresError.message }
    }

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
      round.format as 'points_hilo' | 'stableford',
      roundId,
      players,
      scoresMap,
      holes
    )

    if (!formatState) {
      return { error: 'Could not compute format state (check team assignments)' }
    }

    return { formatState }
  } catch (err) {
    console.error('Get format state error:', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to get format state',
    }
  }
}

// ============================================================================
// Get Trip Format Standings (aggregated across rounds)
// ============================================================================

export async function getTripFormatStandingsAction(tripId: string): Promise<{
  standings?: TripFormatStandings
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    // Get all Points Hi/Lo rounds for this trip
    // Stableford is individual-first for v1, tracked via standard Net/Gross leaderboard
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        id,
        name,
        date,
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
      .eq('trip_id', tripId)
      .eq('format', 'points_hilo')
      .order('date', { ascending: true })

    if (roundsError) {
      return { error: roundsError.message }
    }

    if (!rounds?.length) {
      return {
        standings: {
          pointsHiLo: [],
          pointsHiLoRoundCount: 0,
          stableford: [],
          stablefordRoundCount: 0,
        },
      }
    }

    // Get all scores for these rounds
    const roundIds = rounds.map(r => r.id)
    const { data: allScores, error: scoresError } = await supabase
      .from('scores')
      .select('round_id, player_id, hole_number, gross_strokes')
      .in('round_id', roundIds)

    if (scoresError) {
      return { error: scoresError.message }
    }

    // Build scores map per round
    const scoresByRound: Record<string, Record<string, Record<number, number>>> = {}
    for (const score of allScores || []) {
      if (!scoresByRound[score.round_id]) {
        scoresByRound[score.round_id] = {}
      }
      if (!scoresByRound[score.round_id][score.player_id]) {
        scoresByRound[score.round_id][score.player_id] = {}
      }
      if (score.gross_strokes !== null) {
        scoresByRound[score.round_id][score.player_id][score.hole_number] = score.gross_strokes
      }
    }

    // Aggregate standings by player
    const pointsHiLoByPlayer: Record<string, PlayerFormatStanding> = {}
    const stablefordByPlayer: Record<string, PlayerFormatStanding> = {}
    let pointsHiLoRoundCount = 0
    let stablefordRoundCount = 0

    for (const round of rounds) {
      const holes = (round.tees as any)?.holes as DbHole[] | undefined
      if (!holes?.length) continue

      // Get players for this round
      const players: Array<{
        playerId: string
        playerName: string
        playingHandicap: number | null
        teamNumber: 1 | 2 | null
      }> = []

      for (const group of round.groups || []) {
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

      const scoresMap = scoresByRound[round.id] || {}

      // Compute format state for this round
      const formatState = computeFormatState(
        round.format as 'points_hilo' | 'stableford',
        round.id,
        players,
        scoresMap,
        holes
      )

      if (!formatState) continue

      // Only count if at least some holes played
      if (formatState.holesPlayed === 0) continue

      if (round.format === 'points_hilo') {
        pointsHiLoRoundCount++
      } else {
        stablefordRoundCount++
      }

      // Add to player standings
      const targetMap = round.format === 'points_hilo' ? pointsHiLoByPlayer : stablefordByPlayer

      // Team 1 players
      for (const player of formatState.team1.players) {
        const teammate = formatState.team1.players.find(p => p.id !== player.id)
        if (!targetMap[player.id]) {
          targetMap[player.id] = {
            playerId: player.id,
            playerName: player.name,
            total: 0,
            roundResults: [],
          }
        }
        targetMap[player.id].total += formatState.team1Total
        targetMap[player.id].roundResults.push({
          roundId: round.id,
          roundName: round.name,
          roundDate: round.date,
          format: round.format as 'points_hilo' | 'stableford',
          points: formatState.team1Total,
          teamNumber: 1,
          teammate: teammate?.name || '',
        })
      }

      // Team 2 players
      for (const player of formatState.team2.players) {
        const teammate = formatState.team2.players.find(p => p.id !== player.id)
        if (!targetMap[player.id]) {
          targetMap[player.id] = {
            playerId: player.id,
            playerName: player.name,
            total: 0,
            roundResults: [],
          }
        }
        targetMap[player.id].total += formatState.team2Total
        targetMap[player.id].roundResults.push({
          roundId: round.id,
          roundName: round.name,
          roundDate: round.date,
          format: round.format as 'points_hilo' | 'stableford',
          points: formatState.team2Total,
          teamNumber: 2,
          teammate: teammate?.name || '',
        })
      }
    }

    // Sort by total (descending for both - higher is better)
    const pointsHiLo = Object.values(pointsHiLoByPlayer).sort((a, b) => b.total - a.total)
    const stableford = Object.values(stablefordByPlayer).sort((a, b) => b.total - a.total)

    return {
      standings: {
        pointsHiLo,
        pointsHiLoRoundCount,
        stableford,
        stablefordRoundCount,
      },
    }
  } catch (err) {
    console.error('Get trip format standings error:', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to get format standings',
    }
  }
}
