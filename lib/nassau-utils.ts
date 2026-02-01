/**
 * Nassau Bet Utilities
 *
 * Nassau is the most common golf bet format: three separate bets in one.
 * - Front 9 (holes 1-9): match play, low net wins
 * - Back 9 (holes 10-18): match play, low net wins
 * - Overall 18: match play, low net wins
 *
 * Each sub-match tracks a running lead. Settlement is 3 separate outcomes.
 * Auto-press option: when down by threshold in any sub-match, press triggers.
 */

import { getStrokesForHole } from './handicap'
import type { DbHole } from './supabase/types'

// ============================================================================
// TYPES
// ============================================================================

export interface NassauPlayerInfo {
  id: string
  name: string
  playingHandicap: number | null
}

export interface NassauTeams {
  teamA: NassauPlayerInfo[]
  teamB: NassauPlayerInfo[]
}

/** Which of the 3 sub-matches */
export type NassauSegment = 'front' | 'back' | 'overall'

export interface NassauHoleResult {
  holeNumber: number
  par: number
  teamANet: number | null
  teamBNet: number | null
  winner: 'team_a' | 'team_b' | 'halved' | null
  complete: boolean
}

export interface NassauSubMatchState {
  segment: NassauSegment
  label: string
  lead: number // positive = Team A up, negative = Team B up
  holesPlayed: number
  holesRemaining: number
  isClosed: boolean
  isHalved: boolean
  status: string // "2 UP", "A/S", "1 DN", "2&1"
}

export interface NassauState {
  roundId: string
  stakePerMan: number
  autoPress: boolean
  autoPressThreshold: number
  teams: NassauTeams

  front: NassauSubMatchState
  back: NassauSubMatchState
  overall: NassauSubMatchState

  holeResults: NassauHoleResult[]
  currentHole: number
  holesPlayed: number

  /** Presses triggered by auto-press (segment + starting hole) */
  autoPresses: NassauAutoPress[]
}

export interface NassauAutoPress {
  segment: NassauSegment
  startingHole: number
  lead: number
  holesPlayed: number
  holesRemaining: number
  status: string
}

export interface NassauSettlement {
  frontResult: number // positive = Team A wins, negative = Team B wins, 0 = halved
  backResult: number
  overallResult: number
  /** Per-player net result (positive = winnings, negative = losses) */
  playerResults: Record<string, number>
}

// ============================================================================
// SCORE MAP TYPE
// ============================================================================

interface ScoresMap {
  [playerId: string]: {
    [holeNumber: number]: number // gross strokes
  }
}

// ============================================================================
// COMPUTE NASSAU STATE
// ============================================================================

/**
 * Get the best ball net score for a team on a hole.
 * For 1v1 Nassau, returns the single player's net.
 * For 2v2 Nassau, returns the lower of the two nets.
 */
function getTeamNetScore(
  players: NassauPlayerInfo[],
  holeNumber: number,
  scores: ScoresMap,
  hole: DbHole
): number | null {
  const nets: number[] = []

  for (const player of players) {
    const gross = scores[player.id]?.[holeNumber]
    if (gross == null || player.playingHandicap == null) continue
    const strokes = getStrokesForHole(player.playingHandicap, hole.stroke_index)
    nets.push(gross - strokes)
  }

  if (nets.length === 0) return null
  return Math.min(...nets)
}

/**
 * Compute the full Nassau state from scores.
 */
export function computeNassauState(
  roundId: string,
  stakePerMan: number,
  autoPress: boolean,
  autoPressThreshold: number,
  teams: NassauTeams,
  scores: ScoresMap,
  holes: DbHole[]
): NassauState {
  const sortedHoles = [...holes].sort((a, b) => a.hole_number - b.hole_number)
  const holeResults: NassauHoleResult[] = []

  let frontLead = 0
  let backLead = 0
  let overallLead = 0
  let frontPlayed = 0
  let backPlayed = 0
  let overallPlayed = 0
  let totalPlayed = 0

  for (const hole of sortedHoles) {
    const holeNum = hole.hole_number
    const teamANet = getTeamNetScore(teams.teamA, holeNum, scores, hole)
    const teamBNet = getTeamNetScore(teams.teamB, holeNum, scores, hole)

    let winner: NassauHoleResult['winner'] = null
    const complete = teamANet !== null && teamBNet !== null

    if (complete) {
      if (teamANet! < teamBNet!) {
        winner = 'team_a'
      } else if (teamBNet! < teamANet!) {
        winner = 'team_b'
      } else {
        winner = 'halved'
      }

      totalPlayed++
      overallPlayed++

      // Update overall lead
      if (winner === 'team_a') overallLead++
      else if (winner === 'team_b') overallLead--

      // Update segment leads
      if (holeNum <= 9) {
        frontPlayed++
        if (winner === 'team_a') frontLead++
        else if (winner === 'team_b') frontLead--
      } else {
        backPlayed++
        if (winner === 'team_a') backLead++
        else if (winner === 'team_b') backLead--
      }
    }

    holeResults.push({
      holeNumber: holeNum,
      par: hole.par,
      teamANet,
      teamBNet,
      winner,
      complete,
    })
  }

  const frontHolesTotal = sortedHoles.filter(h => h.hole_number <= 9).length
  const backHolesTotal = sortedHoles.filter(h => h.hole_number > 9).length
  const totalHoles = sortedHoles.length

  const front = buildSubMatchState('front', 'Front 9', frontLead, frontPlayed, frontHolesTotal)
  const back = buildSubMatchState('back', 'Back 9', backLead, backPlayed, backHolesTotal)
  const overall = buildSubMatchState('overall', 'Overall', overallLead, overallPlayed, totalHoles)

  // Compute auto-presses
  const autoPresses: NassauAutoPress[] = []
  if (autoPress) {
    // Scan hole by hole for threshold crossings
    let runFront = 0
    let runBack = 0
    let runOverall = 0
    let frontPressActive = false
    let backPressActive = false
    let overallPressActive = false

    for (const hr of holeResults) {
      if (!hr.complete) continue

      const delta = hr.winner === 'team_a' ? 1 : hr.winner === 'team_b' ? -1 : 0

      if (hr.holeNumber <= 9) runFront += delta
      else runBack += delta
      runOverall += delta

      // Check front threshold (only for team_b being down)
      if (hr.holeNumber <= 9 && !frontPressActive) {
        if (Math.abs(runFront) >= autoPressThreshold) {
          frontPressActive = true
          autoPresses.push(buildAutoPress('front', hr.holeNumber + 1, runFront, frontPlayed, frontHolesTotal))
        }
      }

      // Check back threshold
      if (hr.holeNumber > 9 && !backPressActive) {
        if (Math.abs(runBack) >= autoPressThreshold) {
          backPressActive = true
          autoPresses.push(buildAutoPress('back', hr.holeNumber + 1, runBack, backPlayed, backHolesTotal))
        }
      }

      // Check overall threshold
      if (!overallPressActive) {
        if (Math.abs(runOverall) >= autoPressThreshold) {
          overallPressActive = true
          autoPresses.push(buildAutoPress('overall', hr.holeNumber + 1, runOverall, overallPlayed, totalHoles))
        }
      }
    }
  }

  // Find current hole
  const firstIncomplete = holeResults.find(h => !h.complete)
  const currentHole = firstIncomplete?.holeNumber ?? (sortedHoles.length > 0 ? sortedHoles[sortedHoles.length - 1].hole_number : 1)

  return {
    roundId,
    stakePerMan,
    autoPress,
    autoPressThreshold,
    teams,
    front,
    back,
    overall,
    holeResults,
    currentHole,
    holesPlayed: totalPlayed,
    autoPresses,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSubMatchState(
  segment: NassauSegment,
  label: string,
  lead: number,
  holesPlayed: number,
  totalHoles: number
): NassauSubMatchState {
  const holesRemaining = totalHoles - holesPlayed
  const absLead = Math.abs(lead)
  const isClosed = absLead > holesRemaining && holesRemaining >= 0
  const isHalved = holesRemaining === 0 && lead === 0

  let status: string
  if (isClosed && holesRemaining > 0) {
    status = `${absLead}&${holesRemaining}`
  } else if (holesRemaining === 0 && lead !== 0) {
    status = `${absLead} UP`
  } else if (lead === 0) {
    status = 'A/S'
  } else {
    status = `${absLead} ${lead > 0 ? 'UP' : 'DN'}`
  }

  return { segment, label, lead, holesPlayed, holesRemaining, isClosed, isHalved, status }
}

function buildAutoPress(
  segment: NassauSegment,
  startingHole: number,
  lead: number,
  segmentPlayed: number,
  segmentTotal: number
): NassauAutoPress {
  const holesRemaining = segmentTotal - segmentPlayed
  return {
    segment,
    startingHole,
    lead: 0, // Press starts fresh
    holesPlayed: 0,
    holesRemaining,
    status: 'A/S',
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format Nassau status for a sub-match from a specific team's perspective.
 */
export function formatNassauStatus(lead: number, team: 'team_a' | 'team_b'): string {
  const adjusted = team === 'team_a' ? lead : -lead
  if (adjusted === 0) return 'A/S'
  if (adjusted > 0) return `${adjusted} UP`
  return `${Math.abs(adjusted)} DN`
}

/**
 * Calculate Nassau settlement.
 * Each sub-match: winner gets stake_per_man from each loser. Halved = $0.
 */
export function calculateNassauSettlement(
  nassauState: NassauState
): NassauSettlement {
  const stake = nassauState.stakePerMan
  const { front, back, overall } = nassauState

  // Sub-match results: +1 = Team A wins, -1 = Team B wins, 0 = halved
  const frontResult = front.lead > 0 ? 1 : front.lead < 0 ? -1 : 0
  const backResult = back.lead > 0 ? 1 : back.lead < 0 ? -1 : 0
  const overallResult = overall.lead > 0 ? 1 : overall.lead < 0 ? -1 : 0

  // Per-player net (Team A players get positive for wins, negative for losses)
  const teamANet = (frontResult + backResult + overallResult) * stake
  const playerResults: Record<string, number> = {}

  for (const p of nassauState.teams.teamA) {
    playerResults[p.id] = teamANet
  }
  for (const p of nassauState.teams.teamB) {
    playerResults[p.id] = -teamANet
  }

  return {
    frontResult: frontResult * stake,
    backResult: backResult * stake,
    overallResult: overallResult * stake,
    playerResults,
  }
}

/**
 * Get total exposure per man for Nassau.
 * Base exposure = stake × 3 (front + back + overall).
 */
export function getNassauExposure(nassauState: NassauState): number {
  const base = nassauState.stakePerMan * 3
  const pressExposure = nassauState.autoPresses.length * nassauState.stakePerMan
  return base + pressExposure
}
