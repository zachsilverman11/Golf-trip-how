'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import type { DbPlayer, DbScore, DbRound, DbHole } from './types'

// ============================================================================
// Types
// ============================================================================

export interface PlayerProfileData {
  /** The primary player record (from the requested playerId) */
  player: DbPlayer
  /** All player records across trips that match by name */
  allPlayerRecords: Array<{
    playerId: string
    tripId: string
    tripName: string
    handicapIndex: number | null
    createdAt: string
  }>
  /** Aggregated stats */
  stats: PlayerStats
  /** Per-round history */
  roundHistory: RoundHistoryEntry[]
  /** Trip participation */
  tripHistory: TripHistoryEntry[]
  /** Handicap data points for chart */
  handicapHistory: HandicapDataPoint[]
  /** Match play record */
  matchRecord: MatchRecord
}

export interface PlayerStats {
  totalRounds: number
  grossAverage: number | null
  netAverage: number | null
  bestGrossRound: number | null
  birdies: number
  pars: number
  bogeys: number
  doubleBogeyPlus: number
  totalSkinsWon: number
}

export interface RoundHistoryEntry {
  roundId: string
  roundName: string
  tripId: string
  tripName: string
  date: string
  courseName: string | null
  format: string
  scoringBasis: string
  grossTotal: number
  netTotal: number | null
  holesPlayed: number
  par: number
}

export interface TripHistoryEntry {
  tripId: string
  tripName: string
  startDate: string | null
  endDate: string | null
  roundsPlayed: number
  handicapIndex: number | null
}

export interface HandicapDataPoint {
  date: string
  handicap: number
  tripName: string
}

export interface MatchRecord {
  wins: number
  losses: number
  ties: number
}

// ============================================================================
// Get Player Profile (aggregated across trips by name match)
// ============================================================================

export async function getPlayerProfileAction(playerId: string): Promise<{
  profile: PlayerProfileData | null
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { profile: null, error: 'Not authenticated' }
  }

  try {
    // 1. Get the primary player record
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()

    if (playerError || !player) {
      return { profile: null, error: 'Player not found' }
    }

    // 2. Find all player records with the same name (case-insensitive)
    const { data: allMatches, error: matchError } = await supabase
      .from('players')
      .select('id, trip_id, name, handicap_index, created_at')
      .ilike('name', player.name)

    if (matchError) {
      return { profile: null, error: matchError.message }
    }

    const allPlayerIds = (allMatches || []).map(p => p.id)
    const allTripIds = [...new Set((allMatches || []).map(p => p.trip_id))]

    // 3. Get all trip info
    const { data: trips } = await supabase
      .from('trips')
      .select('id, name, start_date, end_date')
      .in('id', allTripIds)

    const tripMap = new Map<string, { name: string; startDate: string | null; endDate: string | null }>()
    for (const t of trips || []) {
      tripMap.set(t.id, { name: t.name, startDate: t.start_date, endDate: t.end_date })
    }

    // 4. Get all rounds these players participated in (via scores)
    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .in('player_id', allPlayerIds)

    const scoresByRound = new Map<string, DbScore[]>()
    for (const s of scores || []) {
      if (!scoresByRound.has(s.round_id)) {
        scoresByRound.set(s.round_id, [])
      }
      scoresByRound.get(s.round_id)!.push(s)
    }

    const roundIds = [...scoresByRound.keys()]

    // 5. Get round details with tee/hole data
    interface RoundRow {
      id: string
      trip_id: string
      name: string
      date: string
      format: string
      scoring_basis: string
      status: string
      tees: { par: number; holes: DbHole[] } | null
    }

    let rounds: RoundRow[] = []

    if (roundIds.length > 0) {
      const { data: roundData } = await supabase
        .from('rounds')
        .select(`
          id, trip_id, name, date, format, scoring_basis, status,
          tees (
            par,
            holes (*)
          )
        `)
        .in('id', roundIds)
        .order('date', { ascending: false })

      // Supabase may return tees as array or object depending on relation;
      // normalise to single object or null.
      rounds = (roundData || []).map((r: Record<string, unknown>) => {
        const teesRaw = r.tees
        let tees: RoundRow['tees'] = null
        if (Array.isArray(teesRaw) && teesRaw.length > 0) {
          tees = teesRaw[0] as RoundRow['tees']
        } else if (teesRaw && typeof teesRaw === 'object' && !Array.isArray(teesRaw)) {
          tees = teesRaw as RoundRow['tees']
        }
        return {
          id: r.id as string,
          trip_id: r.trip_id as string,
          name: r.name as string,
          date: r.date as string,
          format: r.format as string,
          scoring_basis: r.scoring_basis as string,
          status: r.status as string,
          tees,
        }
      })
    }

    // 6. Get playing handicaps from group_players
    const { data: groupPlayers } = await supabase
      .from('group_players')
      .select('player_id, playing_handicap')
      .in('player_id', allPlayerIds)

    const playingHandicapMap = new Map<string, number>()
    for (const gp of groupPlayers || []) {
      if (gp.playing_handicap !== null) {
        playingHandicapMap.set(gp.player_id, gp.playing_handicap)
      }
    }

    // 7. Get match results
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'completed')

    const matchRecord: MatchRecord = { wins: 0, losses: 0, ties: 0 }
    for (const m of matches || []) {
      const isTeamA = allPlayerIds.includes(m.team_a_player1_id) ||
        (m.team_a_player2_id && allPlayerIds.includes(m.team_a_player2_id))
      const isTeamB = allPlayerIds.includes(m.team_b_player1_id) ||
        (m.team_b_player2_id && allPlayerIds.includes(m.team_b_player2_id))

      if (!isTeamA && !isTeamB) continue

      if (m.winner === 'halved') {
        matchRecord.ties++
      } else if (
        (isTeamA && m.winner === 'team_a') ||
        (isTeamB && m.winner === 'team_b')
      ) {
        matchRecord.wins++
      } else {
        matchRecord.losses++
      }
    }

    // 8. Build round history and compute stats
    let totalGross = 0
    let totalNet = 0
    let totalRoundsWithScores = 0
    let bestGrossRound: number | null = null
    let birdies = 0
    let pars = 0
    let bogeys = 0
    let doubleBogeyPlus = 0

    const roundHistory: RoundHistoryEntry[] = []

    for (const round of rounds) {
      const playerScoresForRound = (scores || []).filter(
        s => s.round_id === round.id && allPlayerIds.includes(s.player_id)
      )

      if (playerScoresForRound.length === 0) continue

      const holes = round.tees?.holes || []
      const holeParMap = new Map<number, number>()
      for (const h of holes) {
        holeParMap.set(h.hole_number, h.par)
      }

      // Use scores from the first matching player for this round
      // (there should only be one player record per round)
      const relevantPlayerId = playerScoresForRound[0].player_id
      const thisPlayerScores = playerScoresForRound.filter(s => s.player_id === relevantPlayerId)

      const holesPlayed = thisPlayerScores.filter(s => s.gross_strokes !== null).length
      if (holesPlayed === 0) continue

      const grossTotal = thisPlayerScores.reduce((sum, s) => sum + (s.gross_strokes || 0), 0)
      const roundPar = round.tees?.par || 72

      // Per-hole breakdown
      for (const s of thisPlayerScores) {
        if (s.gross_strokes === null) continue
        const holePar = holeParMap.get(s.hole_number) || 4
        const diff = s.gross_strokes - holePar
        if (diff <= -1) birdies++
        else if (diff === 0) pars++
        else if (diff === 1) bogeys++
        else doubleBogeyPlus++
      }

      // Track aggregates
      totalGross += grossTotal
      totalRoundsWithScores++

      if (bestGrossRound === null || grossTotal < bestGrossRound) {
        bestGrossRound = grossTotal
      }

      const tripInfo = tripMap.get(round.trip_id)

      // Simple net estimate — gross minus playing handicap
      const playingHcp = playingHandicapMap.get(relevantPlayerId)
      const netTotal = playingHcp != null ? grossTotal - playingHcp : null
      if (netTotal !== null) {
        totalNet += netTotal
      }

      roundHistory.push({
        roundId: round.id,
        roundName: round.name,
        tripId: round.trip_id,
        tripName: tripInfo?.name || 'Unknown Trip',
        date: round.date,
        courseName: null, // Could be enhanced later
        format: round.format,
        scoringBasis: round.scoring_basis,
        grossTotal,
        netTotal,
        holesPlayed,
        par: roundPar,
      })
    }

    // 9. Build trip history
    const tripHistory: TripHistoryEntry[] = []
    const tripRoundCounts = new Map<string, number>()

    for (const rh of roundHistory) {
      tripRoundCounts.set(rh.tripId, (tripRoundCounts.get(rh.tripId) || 0) + 1)
    }

    for (const pm of allMatches || []) {
      const tripInfo = tripMap.get(pm.trip_id)
      if (!tripInfo) continue

      // Avoid duplicates if multiple player records in same trip
      if (tripHistory.some(t => t.tripId === pm.trip_id)) continue

      tripHistory.push({
        tripId: pm.trip_id,
        tripName: tripInfo.name,
        startDate: tripInfo.startDate,
        endDate: tripInfo.endDate,
        roundsPlayed: tripRoundCounts.get(pm.trip_id) || 0,
        handicapIndex: pm.handicap_index,
      })
    }

    // Sort trip history by date descending
    tripHistory.sort((a, b) => {
      const dateA = a.startDate || '0000'
      const dateB = b.startDate || '0000'
      return dateB.localeCompare(dateA)
    })

    // 10. Build handicap history
    const handicapHistory: HandicapDataPoint[] = []
    for (const pm of allMatches || []) {
      if (pm.handicap_index === null) continue
      const tripInfo = tripMap.get(pm.trip_id)
      handicapHistory.push({
        date: pm.created_at,
        handicap: pm.handicap_index,
        tripName: tripInfo?.name || 'Unknown',
      })
    }
    handicapHistory.sort((a, b) => a.date.localeCompare(b.date))

    // 11. Build allPlayerRecords
    const allPlayerRecords = (allMatches || []).map(pm => ({
      playerId: pm.id,
      tripId: pm.trip_id,
      tripName: tripMap.get(pm.trip_id)?.name || 'Unknown',
      handicapIndex: pm.handicap_index,
      createdAt: pm.created_at,
    }))

    // 12. Assemble stats
    const stats: PlayerStats = {
      totalRounds: totalRoundsWithScores,
      grossAverage: totalRoundsWithScores > 0 ? Math.round((totalGross / totalRoundsWithScores) * 10) / 10 : null,
      netAverage: totalRoundsWithScores > 0 && totalNet > 0
        ? Math.round((totalNet / totalRoundsWithScores) * 10) / 10
        : null,
      bestGrossRound,
      birdies,
      pars,
      bogeys,
      doubleBogeyPlus,
      totalSkinsWon: 0, // Will be implemented when skins data exists
    }

    return {
      profile: {
        player,
        allPlayerRecords,
        stats,
        roundHistory,
        tripHistory,
        handicapHistory,
        matchRecord,
      },
    }
  } catch (err) {
    console.error('Get player profile error:', err)
    return {
      profile: null,
      error: err instanceof Error ? err.message : 'Failed to load player profile',
    }
  }
}

// ============================================================================
// Get Player Mini Stats (for player list inline display)
// ============================================================================

export interface PlayerMiniStats {
  playerId: string
  roundsPlayed: number
  avgScore: number | null
}

export async function getPlayersMiniStatsAction(tripId: string): Promise<{
  stats: Map<string, PlayerMiniStats> | Record<string, PlayerMiniStats>
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { stats: {}, error: 'Not authenticated' }
  }

  try {
    // Get all players for this trip
    const { data: players } = await supabase
      .from('players')
      .select('id, name')
      .eq('trip_id', tripId)

    if (!players || players.length === 0) {
      return { stats: {} }
    }

    const playerIds = players.map(p => p.id)

    // Get all scores for these players
    const { data: scores } = await supabase
      .from('scores')
      .select('player_id, round_id, gross_strokes')
      .in('player_id', playerIds)
      .not('gross_strokes', 'is', null)

    const statsMap: Record<string, PlayerMiniStats> = {}

    for (const p of players) {
      const playerScores = (scores || []).filter(s => s.player_id === p.id)

      // Group by round to count rounds
      const roundSet = new Set(playerScores.map(s => s.round_id))
      const roundsPlayed = roundSet.size

      // Average gross score per round
      let avgScore: number | null = null
      if (roundsPlayed > 0) {
        const totalGross = playerScores.reduce((sum, s) => sum + (s.gross_strokes || 0), 0)
        avgScore = Math.round((totalGross / roundsPlayed) * 10) / 10
      }

      statsMap[p.id] = {
        playerId: p.id,
        roundsPlayed,
        avgScore,
      }
    }

    return { stats: statsMap }
  } catch (err) {
    console.error('Get player mini stats error:', err)
    return {
      stats: {},
      error: err instanceof Error ? err.message : 'Failed to load player stats',
    }
  }
}
