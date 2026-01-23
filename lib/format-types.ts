/**
 * Types for Round Formats (Points Hi/Lo and Stableford)
 */

// ============================================================================
// FORMAT STATE (computed from scores)
// ============================================================================

export interface FormatState {
  format: 'points_hilo' | 'stableford'
  roundId: string

  // Team composition
  team1: TeamInfo
  team2: TeamInfo

  // Per-hole results
  holeResults: HoleFormatResult[]

  // Totals
  team1Total: number
  team2Total: number

  // Current hole being scored (for live display)
  currentHole: number
  holesPlayed: number
}

export interface TeamInfo {
  players: TeamPlayer[]
}

export interface TeamPlayer {
  id: string
  name: string
  playingHandicap: number | null
}

export interface HoleFormatResult {
  holeNumber: number
  par: number

  // Team scores for this hole
  team1Points: number
  team2Points: number

  // Player details (for display)
  team1PlayerScores: PlayerHoleScore[]
  team2PlayerScores: PlayerHoleScore[]

  // Whether hole is complete (all players have scores)
  complete: boolean
}

export interface PlayerHoleScore {
  playerId: string
  playerName: string
  grossScore: number | null
  netScore: number | null
  stablefordPoints?: number  // Only for stableford format
}

// ============================================================================
// TRIP FORMAT STANDINGS (aggregated across rounds)
// ============================================================================

export interface TripFormatStandings {
  // Points Hi/Lo standings (sorted by total, descending)
  pointsHiLo: PlayerFormatStanding[]
  pointsHiLoRoundCount: number

  // Stableford standings (sorted by total, descending)
  stableford: PlayerFormatStanding[]
  stablefordRoundCount: number
}

export interface PlayerFormatStanding {
  playerId: string
  playerName: string
  total: number
  roundResults: RoundFormatResult[]
}

export interface RoundFormatResult {
  roundId: string
  roundName: string
  roundDate: string
  format: 'points_hilo' | 'stableford'
  points: number
  teamNumber: 1 | 2
  teammate: string  // Name of teammate for that round
}

// ============================================================================
// INPUT TYPES (for round creation)
// ============================================================================

export interface TeamAssignments {
  [playerId: string]: 1 | 2
}

// ============================================================================
// STABLEFORD POINTS MAPPING
// ============================================================================

/**
 * Stableford points based on net score relative to par:
 * - Albatross or better (-3 or less): 8 points
 * - Eagle (-2): 5 points
 * - Birdie (-1): 3 points
 * - Par (0): 1 point
 * - Bogey (+1): 0 points
 * - Double bogey or worse (+2 or more): -1 point
 */
export const STABLEFORD_POINTS: Record<number, number> = {
  [-3]: 8,  // Albatross or better (will use <= -3 check)
  [-2]: 5,  // Eagle
  [-1]: 3,  // Birdie
  [0]: 1,   // Par
  [1]: 0,   // Bogey
  [2]: -1,  // Double bogey or worse (will use >= 2 check)
}

// ============================================================================
// POINTS HI/LO RULES
// ============================================================================

/**
 * Points Hi/Lo scoring per hole:
 * - 2 points available per hole total
 * - Low net vs Low net: 1 point (winner) / 0.5 each (tie)
 * - High net vs High net: 1 point (winner) / 0.5 each (tie)
 * - No carryovers
 */
export const POINTS_HILO_PER_HOLE = 2
export const POINTS_HILO_WIN = 1
export const POINTS_HILO_TIE = 0.5
