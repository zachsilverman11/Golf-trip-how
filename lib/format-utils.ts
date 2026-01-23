/**
 * Format calculation utilities for Points Hi/Lo and Stableford
 */

import { getStrokesForHole } from './handicap'
import type {
  FormatState,
  HoleFormatResult,
  PlayerHoleScore,
  TeamInfo,
  STABLEFORD_POINTS,
  POINTS_HILO_WIN,
  POINTS_HILO_TIE,
} from './format-types'
import type { DbHole } from './supabase/types'

// ============================================================================
// STABLEFORD CALCULATIONS
// ============================================================================

/**
 * Calculate Stableford points for a single player on a hole
 * Uses net scoring (gross - handicap strokes)
 *
 * Points mapping:
 * - Albatross or better: 8
 * - Eagle: 5
 * - Birdie: 3
 * - Par: 1
 * - Bogey: 0
 * - Double bogey or worse: -1
 */
export function calculateStablefordPoints(netScore: number, par: number): number {
  const diff = netScore - par

  if (diff <= -3) return 8   // Albatross or better
  if (diff === -2) return 5  // Eagle
  if (diff === -1) return 3  // Birdie
  if (diff === 0) return 1   // Par
  if (diff === 1) return 0   // Bogey
  return -1                  // Double bogey or worse
}

/**
 * Calculate team Stableford points for a hole (sum of both players)
 */
export function calculateTeamStableford(
  player1NetScore: number | null,
  player2NetScore: number | null,
  par: number
): number {
  let total = 0

  if (player1NetScore !== null) {
    total += calculateStablefordPoints(player1NetScore, par)
  }

  if (player2NetScore !== null) {
    total += calculateStablefordPoints(player2NetScore, par)
  }

  return total
}

// ============================================================================
// POINTS HI/LO CALCULATIONS
// ============================================================================

/**
 * Calculate Points Hi/Lo for a single hole
 *
 * Rules:
 * - 2 points available per hole
 * - Low net vs Low net: 1 point (winner takes all, ties split 0.5 each)
 * - High net vs High net: 1 point (winner takes all, ties split 0.5 each)
 * - No carryovers
 *
 * @returns Points for each team { team1: number, team2: number }
 */
export function calculatePointsHiLo(
  team1Nets: [number, number],  // [player1Net, player2Net]
  team2Nets: [number, number]
): { team1: number; team2: number } {
  // Sort to get low and high for each team
  const [t1Low, t1High] = [...team1Nets].sort((a, b) => a - b)
  const [t2Low, t2High] = [...team2Nets].sort((a, b) => a - b)

  let team1 = 0
  let team2 = 0

  // Low net vs Low net (1 point available)
  if (t1Low < t2Low) {
    team1 += 1  // Team 1 wins low
  } else if (t2Low < t1Low) {
    team2 += 1  // Team 2 wins low
  } else {
    // Tie: split 0.5 each
    team1 += 0.5
    team2 += 0.5
  }

  // High net vs High net (1 point available)
  if (t1High < t2High) {
    team1 += 1  // Team 1 wins high (lower is better)
  } else if (t2High < t1High) {
    team2 += 1  // Team 2 wins high
  } else {
    // Tie: split 0.5 each
    team1 += 0.5
    team2 += 0.5
  }

  return { team1, team2 }
}

/**
 * Calculate Points Hi/Lo for a hole when some scores may be missing
 * Returns null points if the hole is incomplete
 */
export function calculatePointsHiLoPartial(
  team1Nets: (number | null)[],
  team2Nets: (number | null)[]
): { team1: number; team2: number } | null {
  // Need exactly 2 scores per team
  const t1Valid = team1Nets.filter((n): n is number => n !== null)
  const t2Valid = team2Nets.filter((n): n is number => n !== null)

  if (t1Valid.length !== 2 || t2Valid.length !== 2) {
    return null  // Hole incomplete
  }

  return calculatePointsHiLo(
    [t1Valid[0], t1Valid[1]],
    [t2Valid[0], t2Valid[1]]
  )
}

// ============================================================================
// FORMAT STATE COMPUTATION
// ============================================================================

interface ScoresMap {
  [playerId: string]: {
    [holeNumber: number]: number  // gross strokes
  }
}

interface GroupPlayerInfo {
  playerId: string
  playerName: string
  playingHandicap: number | null
  teamNumber: 1 | 2 | null
}

/**
 * Compute the full format state for a round
 * Used for live scoring display
 */
export function computeFormatState(
  format: 'points_hilo' | 'stableford',
  roundId: string,
  players: GroupPlayerInfo[],
  scores: ScoresMap,
  holes: DbHole[]
): FormatState | null {
  // Split players by team
  const team1Players = players.filter(p => p.teamNumber === 1)
  const team2Players = players.filter(p => p.teamNumber === 2)

  // Must have exactly 2 players per team
  if (team1Players.length !== 2 || team2Players.length !== 2) {
    return null
  }

  const team1: TeamInfo = {
    players: team1Players.map(p => ({
      id: p.playerId,
      name: p.playerName,
      playingHandicap: p.playingHandicap,
    })),
  }

  const team2: TeamInfo = {
    players: team2Players.map(p => ({
      id: p.playerId,
      name: p.playerName,
      playingHandicap: p.playingHandicap,
    })),
  }

  // Sort holes by number
  const sortedHoles = [...holes].sort((a, b) => a.hole_number - b.hole_number)

  // Compute results per hole
  const holeResults: HoleFormatResult[] = []
  let team1Total = 0
  let team2Total = 0
  let holesPlayed = 0
  let currentHole = 1

  for (const hole of sortedHoles) {
    const holeNum = hole.hole_number
    const par = hole.par
    const strokeIndex = hole.stroke_index

    // Get net scores for each player
    const getPlayerHoleScore = (player: GroupPlayerInfo): PlayerHoleScore => {
      const gross = scores[player.playerId]?.[holeNum] ?? null
      let net: number | null = null
      let stablefordPoints: number | undefined

      if (gross !== null && player.playingHandicap !== null) {
        const strokes = getStrokesForHole(player.playingHandicap, strokeIndex)
        net = gross - strokes

        if (format === 'stableford') {
          stablefordPoints = calculateStablefordPoints(net, par)
        }
      }

      return {
        playerId: player.playerId,
        playerName: player.playerName,
        grossScore: gross,
        netScore: net,
        stablefordPoints,
      }
    }

    const team1PlayerScores = team1Players.map(getPlayerHoleScore)
    const team2PlayerScores = team2Players.map(getPlayerHoleScore)

    // Check if hole is complete (all 4 players have scores)
    const allScores = [...team1PlayerScores, ...team2PlayerScores]
    const complete = allScores.every(s => s.grossScore !== null)

    let team1Points = 0
    let team2Points = 0

    if (complete) {
      holesPlayed++

      if (format === 'points_hilo') {
        const team1Nets = team1PlayerScores.map(s => s.netScore as number)
        const team2Nets = team2PlayerScores.map(s => s.netScore as number)

        const result = calculatePointsHiLo(
          [team1Nets[0], team1Nets[1]],
          [team2Nets[0], team2Nets[1]]
        )
        team1Points = result.team1
        team2Points = result.team2
      } else {
        // Stableford: sum player points per team
        team1Points = team1PlayerScores.reduce((sum, s) => sum + (s.stablefordPoints ?? 0), 0)
        team2Points = team2PlayerScores.reduce((sum, s) => sum + (s.stablefordPoints ?? 0), 0)
      }

      team1Total += team1Points
      team2Total += team2Points
    } else {
      // Track current hole (first incomplete)
      if (currentHole === holeNum - 1 || holeNum === 1) {
        currentHole = holeNum
      }
    }

    holeResults.push({
      holeNumber: holeNum,
      par,
      team1Points,
      team2Points,
      team1PlayerScores,
      team2PlayerScores,
      complete,
    })
  }

  // Find current hole (first incomplete, or last if all complete)
  const firstIncomplete = holeResults.find(h => !h.complete)
  currentHole = firstIncomplete?.holeNumber ?? sortedHoles.length

  return {
    format,
    roundId,
    team1,
    team2,
    holeResults,
    team1Total,
    team2Total,
    currentHole,
    holesPlayed,
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format Points Hi/Lo result for display
 * e.g., "Low: 1pt Team 1 / High: Split"
 */
export function formatPointsHiLoHoleResult(
  team1Nets: [number, number],
  team2Nets: [number, number]
): { lowResult: string; highResult: string } {
  const [t1Low, t1High] = [...team1Nets].sort((a, b) => a - b)
  const [t2Low, t2High] = [...team2Nets].sort((a, b) => a - b)

  let lowResult: string
  if (t1Low < t2Low) {
    lowResult = 'Team 1'
  } else if (t2Low < t1Low) {
    lowResult = 'Team 2'
  } else {
    lowResult = 'Split'
  }

  let highResult: string
  if (t1High < t2High) {
    highResult = 'Team 1'
  } else if (t2High < t1High) {
    highResult = 'Team 2'
  } else {
    highResult = 'Split'
  }

  return { lowResult, highResult }
}

/**
 * Get display text for Stableford points
 */
export function formatStablefordPoints(points: number): string {
  if (points > 0) return `+${points}`
  return String(points)
}

/**
 * Get relative score description for Stableford
 */
export function getStablefordDescription(netScore: number, par: number): string {
  const diff = netScore - par

  if (diff <= -3) return 'Albatross+'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double'
  return 'Triple+'
}
