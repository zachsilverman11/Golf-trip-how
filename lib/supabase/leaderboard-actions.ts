'use server'

import { createClient, createAdminClient } from './server'
import { getCurrentUser } from './auth-actions'
import { getStrokesForHole, calculateRoundNetTotal } from '@/lib/handicap'
import type { DbHole } from './types'

// ============================================================================
// Types
// ============================================================================

export interface LeaderboardEntry {
  playerId: string
  playerName: string
  handicapIndex: number | null
  playingHandicap: number | null
  grossTotal: number
  netTotal: number
  holesPlayed: number
  thru: number
  scoreToPar: number // Net score relative to par
  position: number
}

export interface TripLeaderboard {
  entries: LeaderboardEntry[]
  par: number
  holesTotal: number
}

// ============================================================================
// Get Trip Leaderboard
// ============================================================================

export async function getTripLeaderboardAction(
  tripId: string,
  roundId?: string
): Promise<{
  leaderboard: TripLeaderboard
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return {
      leaderboard: { entries: [], par: 72, holesTotal: 18 },
      error: 'Not authenticated',
    }
  }

  try {
    // Get trip with players
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(`
        *,
        players (*),
        rounds (
          *,
          tees (
            *,
            holes (*)
          ),
          groups (
            *,
            group_players (
              *,
              players (*)
            )
          )
        )
      `)
      .eq('id', tripId)
      .single()

    if (tripError) {
      return {
        leaderboard: { entries: [], par: 72, holesTotal: 18 },
        error: tripError.message,
      }
    }

    // Filter rounds if specific round requested
    const rounds = roundId
      ? trip.rounds?.filter((r: any) => r.id === roundId) || []
      : trip.rounds || []

    // Get all scores for the trip's rounds
    const roundIds = rounds.map((r: any) => r.id)
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .in('round_id', roundIds)

    if (scoresError) {
      return {
        leaderboard: { entries: [], par: 72, holesTotal: 18 },
        error: scoresError.message,
      }
    }

    // Build leaderboard entries
    const playerMap = new Map<string, LeaderboardEntry>()
    let totalPar = 0
    let totalHoles = 0

    for (const round of rounds) {
      const tee = round.tees
      const holes: DbHole[] = tee?.holes || []
      const roundPar = holes.reduce((sum: number, h: DbHole) => sum + h.par, 0) || 72
      totalPar += roundPar
      totalHoles += holes.length || 18

      // Get playing handicaps from groups
      const playingHandicaps = new Map<string, number>()
      for (const group of round.groups || []) {
        for (const gp of group.group_players || []) {
          const playerId = (gp as any).players?.id
          if (playerId && gp.playing_handicap !== null) {
            playingHandicaps.set(playerId, gp.playing_handicap)
          }
        }
      }

      // Process scores for this round
      const roundScores = scores?.filter((s) => s.round_id === round.id) || []

      // Group scores by player
      const playerRoundScores = new Map<string, { [hole: number]: number }>()
      for (const score of roundScores) {
        if (score.gross_strokes === null) continue

        if (!playerRoundScores.has(score.player_id)) {
          playerRoundScores.set(score.player_id, {})
        }
        playerRoundScores.get(score.player_id)![score.hole_number] = score.gross_strokes
      }

      // Calculate totals for each player
      for (const [playerId, holeScores] of playerRoundScores) {
        const player = trip.players?.find((p: any) => p.id === playerId)
        if (!player) continue

        const playingHandicap = playingHandicaps.get(playerId) ?? null
        const grossTotal = Object.values(holeScores).reduce((sum, s) => sum + (s || 0), 0)
        const holesPlayed = Object.keys(holeScores).length
        const thru = holesPlayed > 0 ? Math.max(...Object.keys(holeScores).map(Number)) : 0

        // Calculate net total
        let netTotal = grossTotal
        if (playingHandicap !== null && holes.length > 0) {
          const grossArray = Array.from({ length: 18 }, (_, i) =>
            holeScores[i + 1] ?? null
          )
          const strokeIndices = holes.map((h) => h.stroke_index)
          netTotal = calculateRoundNetTotal(grossArray, playingHandicap, strokeIndices)
        }

        // Aggregate across rounds
        const existing = playerMap.get(playerId)
        if (existing) {
          existing.grossTotal += grossTotal
          existing.netTotal += netTotal
          existing.holesPlayed += holesPlayed
          existing.thru = Math.max(existing.thru, thru)
        } else {
          playerMap.set(playerId, {
            playerId,
            playerName: player.name,
            handicapIndex: player.handicap_index,
            playingHandicap,
            grossTotal,
            netTotal,
            holesPlayed,
            thru,
            scoreToPar: 0, // Calculated below
            position: 0,
          })
        }
      }
    }

    // Calculate score to par and sort
    const entries = Array.from(playerMap.values())

    for (const entry of entries) {
      // Calculate par for holes played (simplified - assumes same holes)
      const avgPar = totalPar / Math.max(totalHoles, 1)
      const parForHoles = Math.round(avgPar * entry.holesPlayed)
      entry.scoreToPar = entry.netTotal - parForHoles
    }

    // Sort by net total (lower is better)
    entries.sort((a, b) => a.netTotal - b.netTotal)

    // Assign positions
    let currentPosition = 1
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].netTotal > entries[i - 1].netTotal) {
        currentPosition = i + 1
      }
      entries[i].position = currentPosition
    }

    return {
      leaderboard: {
        entries,
        par: totalPar || 72,
        holesTotal: totalHoles || 18,
      },
    }
  } catch (err) {
    console.error('Get trip leaderboard error:', err)
    return {
      leaderboard: { entries: [], par: 72, holesTotal: 18 },
      error: err instanceof Error ? err.message : 'Failed to load leaderboard',
    }
  }
}

// ============================================================================
// Get Spectator Leaderboard (Public Access)
// ============================================================================

export async function getSpectatorLeaderboardAction(
  token: string,
  roundId?: string
): Promise<{
  trip?: { id: string; name: string; description: string | null }
  leaderboard: TripLeaderboard
  error?: string
}> {
  // Use admin client to bypass RLS for spectator access
  const supabase = createAdminClient()

  try {
    // Look up trip by token
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(`
        id,
        name,
        description,
        players (*),
        rounds (
          *,
          tees (
            *,
            holes (*)
          ),
          groups (
            *,
            group_players (
              *,
              players (*)
            )
          )
        )
      `)
      .eq('spectator_token', token)
      .single()

    if (tripError || !trip) {
      return {
        leaderboard: { entries: [], par: 72, holesTotal: 18 },
        error: 'Invalid spectator link',
      }
    }

    // Filter rounds if specific round requested
    const rounds = roundId
      ? trip.rounds?.filter((r: any) => r.id === roundId) || []
      : trip.rounds || []

    // Get all scores for the trip's rounds
    const roundIds = rounds.map((r: any) => r.id)

    if (roundIds.length === 0) {
      return {
        trip: { id: trip.id, name: trip.name, description: trip.description },
        leaderboard: { entries: [], par: 72, holesTotal: 18 },
      }
    }

    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .in('round_id', roundIds)

    if (scoresError) {
      return {
        trip: { id: trip.id, name: trip.name, description: trip.description },
        leaderboard: { entries: [], par: 72, holesTotal: 18 },
        error: scoresError.message,
      }
    }

    // Build leaderboard (same logic as authenticated version)
    const playerMap = new Map<string, LeaderboardEntry>()
    let totalPar = 0
    let totalHoles = 0

    for (const round of rounds) {
      const tee = round.tees
      const holes: DbHole[] = tee?.holes || []
      const roundPar = holes.reduce((sum: number, h: DbHole) => sum + h.par, 0) || 72
      totalPar += roundPar
      totalHoles += holes.length || 18

      const playingHandicaps = new Map<string, number>()
      for (const group of round.groups || []) {
        for (const gp of group.group_players || []) {
          const playerId = (gp as any).players?.id
          if (playerId && gp.playing_handicap !== null) {
            playingHandicaps.set(playerId, gp.playing_handicap)
          }
        }
      }

      const roundScores = scores?.filter((s) => s.round_id === round.id) || []
      const playerRoundScores = new Map<string, { [hole: number]: number }>()

      for (const score of roundScores) {
        if (score.gross_strokes === null) continue
        if (!playerRoundScores.has(score.player_id)) {
          playerRoundScores.set(score.player_id, {})
        }
        playerRoundScores.get(score.player_id)![score.hole_number] = score.gross_strokes
      }

      for (const [playerId, holeScores] of playerRoundScores) {
        const player = trip.players?.find((p: any) => p.id === playerId)
        if (!player) continue

        const playingHandicap = playingHandicaps.get(playerId) ?? null
        const grossTotal = Object.values(holeScores).reduce((sum, s) => sum + (s || 0), 0)
        const holesPlayed = Object.keys(holeScores).length
        const thru = holesPlayed > 0 ? Math.max(...Object.keys(holeScores).map(Number)) : 0

        let netTotal = grossTotal
        if (playingHandicap !== null && holes.length > 0) {
          const grossArray = Array.from({ length: 18 }, (_, i) =>
            holeScores[i + 1] ?? null
          )
          const strokeIndices = holes.map((h) => h.stroke_index)
          netTotal = calculateRoundNetTotal(grossArray, playingHandicap, strokeIndices)
        }

        const existing = playerMap.get(playerId)
        if (existing) {
          existing.grossTotal += grossTotal
          existing.netTotal += netTotal
          existing.holesPlayed += holesPlayed
          existing.thru = Math.max(existing.thru, thru)
        } else {
          playerMap.set(playerId, {
            playerId,
            playerName: player.name,
            handicapIndex: player.handicap_index,
            playingHandicap,
            grossTotal,
            netTotal,
            holesPlayed,
            thru,
            scoreToPar: 0,
            position: 0,
          })
        }
      }
    }

    const entries = Array.from(playerMap.values())

    for (const entry of entries) {
      const avgPar = totalPar / Math.max(totalHoles, 1)
      const parForHoles = Math.round(avgPar * entry.holesPlayed)
      entry.scoreToPar = entry.netTotal - parForHoles
    }

    entries.sort((a, b) => a.netTotal - b.netTotal)

    let currentPosition = 1
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].netTotal > entries[i - 1].netTotal) {
        currentPosition = i + 1
      }
      entries[i].position = currentPosition
    }

    return {
      trip: { id: trip.id, name: trip.name, description: trip.description },
      leaderboard: {
        entries,
        par: totalPar || 72,
        holesTotal: totalHoles || 18,
      },
    }
  } catch (err) {
    console.error('Get spectator leaderboard error:', err)
    return {
      leaderboard: { entries: [], par: 72, holesTotal: 18 },
      error: err instanceof Error ? err.message : 'Failed to load leaderboard',
    }
  }
}
