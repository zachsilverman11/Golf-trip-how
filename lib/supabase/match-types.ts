/**
 * Match Play Types for Money Games v1
 *
 * Supports 1v1 and 2v2 (Best Ball Net) match play with presses.
 */

import { DbPlayer, DbHole } from './types'

// ============================================================================
// DATABASE TYPES
// ============================================================================

export type MatchType = '1v1' | '2v2'
export type MatchStatus = 'in_progress' | 'completed' | 'canceled'
export type MatchWinner = 'team_a' | 'team_b' | 'halved' | null

export interface DbMatch {
  id: string
  round_id: string
  match_type: MatchType
  stake_per_hole: number

  // Team A
  team_a_player1_id: string
  team_a_player2_id: string | null // null for 1v1

  // Team B
  team_b_player1_id: string
  team_b_player2_id: string | null // null for 1v1

  // Match state
  status: MatchStatus
  winner: MatchWinner
  final_result: string | null // e.g., "3&2", "1 UP", "A/S"
  current_lead: number // positive = Team A up, negative = Team B up
  holes_played: number

  created_at: string
  updated_at: string
}

export interface DbPress {
  id: string
  match_id: string
  starting_hole: number
  stake_per_hole: number // Frozen at creation

  // Press state
  status: MatchStatus
  winner: MatchWinner
  final_result: string | null
  current_lead: number
  holes_played: number

  created_at: string
  updated_at: string
}

// Insert types
export type DbMatchInsert = Omit<DbMatch, 'id' | 'created_at' | 'updated_at' | 'status' | 'winner' | 'final_result' | 'current_lead' | 'holes_played'>
export type DbPressInsert = Omit<DbPress, 'id' | 'created_at' | 'updated_at' | 'status' | 'winner' | 'final_result' | 'current_lead' | 'holes_played'>

// Join types
export interface DbMatchWithPresses extends DbMatch {
  presses: DbPress[]
}

// ============================================================================
// COMPUTED TYPES (Derived from scores at runtime)
// ============================================================================

/**
 * Result for a single hole - derived from scores, not persisted
 */
export interface ComputedHoleResult {
  holeNumber: number
  teamANetScore: number | null // Best ball net for 2v2, player net for 1v1
  teamBNetScore: number | null
  winner: 'team_a' | 'team_b' | 'halved' | null // null if incomplete
  cumulativeLead: number // Running lead after this hole
}

/**
 * Team info for UI display
 */
export interface TeamInfo {
  player1: DbPlayer
  player2: DbPlayer | null // null for 1v1
  player1Handicap: number
  player2Handicap: number | null
}

/**
 * Press with computed state
 */
export interface PressState {
  id: string
  pressNumber: number // 1, 2, 3, etc.
  startingHole: number
  stakePerHole: number
  status: MatchStatus
  winner: MatchWinner
  finalResult: string | null
  currentLead: number
  holesPlayed: number
  holesRemaining: number
}

/**
 * Full computed match state for UI
 * Includes derived hole results and press states
 */
export interface MatchState {
  // Match info
  matchId: string
  roundId: string
  matchType: MatchType
  stakePerHole: number
  status: MatchStatus
  winner: MatchWinner
  finalResult: string | null

  // Teams with full player info
  teamA: TeamInfo
  teamB: TeamInfo

  // Current state
  currentLead: number // positive = Team A up
  holesPlayed: number
  holesRemaining: number
  isDormie: boolean
  isMatchClosed: boolean

  // Derived hole-by-hole results
  holeResults: ComputedHoleResult[]

  // Active presses
  presses: PressState[]
}

/**
 * Information about what's at stake for the current hole
 * This is the "hero" element in the UI
 */
export interface HoleMatchInfo {
  holeNumber: number
  totalAtStake: number // Main match + all active presses
  breakdown: {
    mainMatch: number
    presses: { pressNumber: number; amount: number }[]
  }
  matchState: {
    lead: number
    status: string // "2 UP", "A/S", "1 DN"
    isDormie: boolean
    isMatchClosed: boolean
  }
  pressStates: {
    pressNumber: number
    lead: number
    status: string
  }[]
}

/**
 * Total exposure calculation - what could be won/lost
 */
export interface ExposureInfo {
  totalExposure: number // Maximum possible loss
  mainMatchExposure: number
  pressExposures: { pressNumber: number; exposure: number }[]
  currentPosition: number // Current net position (+ winning, - losing)
}

// ============================================================================
// ACTION INPUT TYPES
// ============================================================================

export interface CreateMatchInput {
  roundId: string
  matchType: MatchType
  stakePerHole: number
  teamAPlayer1Id: string
  teamAPlayer2Id?: string // Required for 2v2
  teamBPlayer1Id: string
  teamBPlayer2Id?: string // Required for 2v2
}

export interface AddPressInput {
  matchId: string
  startingHole: number
}

export interface UpdateMatchStakesInput {
  matchId: string
  stakePerHole: number
}

// ============================================================================
// ACTION RESULT TYPES
// ============================================================================

export interface MatchActionResult {
  success: boolean
  error?: string
  match?: DbMatch
}

export interface PressActionResult {
  success: boolean
  error?: string
  press?: DbPress
}

export interface MatchStateResult {
  success: boolean
  error?: string
  state?: MatchState
}

export interface HoleMatchInfoResult {
  success: boolean
  error?: string
  info?: HoleMatchInfo
}
