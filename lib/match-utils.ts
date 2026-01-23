/**
 * Match Play Utilities
 *
 * Core logic for computing match play results from scores.
 * All hole results are derived on-the-fly from saved scores.
 */

import { getStrokesForHole } from './handicap'
import {
  DbMatch,
  DbPress,
  MatchType,
  ComputedHoleResult,
  MatchState,
  PressState,
  HoleMatchInfo,
  ExposureInfo,
  TeamInfo,
} from './supabase/match-types'
import { DbPlayer, DbHole, DbScore, DbGroupPlayer } from './supabase/types'

// ============================================================================
// MATCH STATUS FORMATTING
// ============================================================================

/**
 * Format match status for display
 *
 * @param lead - Current lead (positive = Team A up, negative = Team B up)
 * @param holesRemaining - Holes left to play
 * @param isComplete - Whether the match is over
 * @returns Formatted status string (e.g., "2 UP", "A/S", "3&2")
 */
export function formatMatchStatus(
  lead: number,
  holesRemaining: number,
  isComplete: boolean = false
): string {
  if (lead === 0) {
    return 'A/S' // All Square
  }

  const absLead = Math.abs(lead)

  // Match is closed (won by more than holes remaining)
  if (isComplete && absLead > holesRemaining) {
    return `${absLead}&${holesRemaining}`
  }

  // Match finished on 18th
  if (isComplete && holesRemaining === 0) {
    return `${absLead} UP`
  }

  // Match in progress
  return `${absLead} ${lead > 0 ? 'UP' : 'DN'}`
}

/**
 * Get lead status from Team A's perspective
 */
export function formatLeadStatus(lead: number): string {
  if (lead === 0) return 'A/S'
  if (lead > 0) return `${lead} UP`
  return `${Math.abs(lead)} DN`
}

/**
 * Get lead status from specified team's perspective
 */
export function formatLeadStatusForTeam(
  lead: number,
  team: 'team_a' | 'team_b'
): string {
  const adjustedLead = team === 'team_a' ? lead : -lead
  return formatLeadStatus(adjustedLead)
}

// ============================================================================
// NET SCORE CALCULATIONS
// ============================================================================

/**
 * Calculate a player's net score for a hole
 */
export function calculatePlayerNetScore(
  grossScore: number,
  playingHandicap: number,
  strokeIndex: number
): number {
  const strokes = getStrokesForHole(playingHandicap, strokeIndex)
  return grossScore - strokes
}

/**
 * Calculate best ball net score for a team (2v2)
 * Returns the lower of the two players' net scores
 */
export function calculateTeamBestBallNet(
  player1Gross: number | null,
  player1Handicap: number,
  player2Gross: number | null,
  player2Handicap: number | null,
  strokeIndex: number
): number | null {
  const player1Net =
    player1Gross !== null
      ? calculatePlayerNetScore(player1Gross, player1Handicap, strokeIndex)
      : null

  const player2Net =
    player2Gross !== null && player2Handicap !== null
      ? calculatePlayerNetScore(player2Gross, player2Handicap, strokeIndex)
      : null

  // Return the better (lower) of the two
  if (player1Net !== null && player2Net !== null) {
    return Math.min(player1Net, player2Net)
  }

  // If only one player has a score, use that
  return player1Net ?? player2Net
}

/**
 * Calculate team net score for a hole
 * For 1v1: single player's net score
 * For 2v2: best ball net score
 */
export function calculateTeamNetScore(
  matchType: MatchType,
  player1Gross: number | null,
  player1Handicap: number,
  player2Gross: number | null,
  player2Handicap: number | null,
  strokeIndex: number
): number | null {
  if (matchType === '1v1') {
    return player1Gross !== null
      ? calculatePlayerNetScore(player1Gross, player1Handicap, strokeIndex)
      : null
  }

  return calculateTeamBestBallNet(
    player1Gross,
    player1Handicap,
    player2Gross,
    player2Handicap,
    strokeIndex
  )
}

// ============================================================================
// HOLE RESULT COMPUTATION
// ============================================================================

interface PlayerScoreMap {
  [playerId: string]: {
    [holeNumber: number]: number | null
  }
}

interface PlayerHandicapMap {
  [playerId: string]: number
}

/**
 * Compute results for all holes based on scores
 * This is the core function that derives match state from saved scores
 */
export function computeHoleResults(
  match: DbMatch,
  scores: PlayerScoreMap,
  handicaps: PlayerHandicapMap,
  holes: DbHole[]
): ComputedHoleResult[] {
  const results: ComputedHoleResult[] = []
  let cumulativeLead = 0

  // Sort holes by number
  const sortedHoles = [...holes].sort((a, b) => a.hole_number - b.hole_number)

  for (const hole of sortedHoles) {
    const holeNumber = hole.hole_number
    const strokeIndex = hole.stroke_index || holeNumber

    // Get scores for each player
    const teamAPlayer1Score = scores[match.team_a_player1_id]?.[holeNumber] ?? null
    const teamAPlayer2Score = match.team_a_player2_id
      ? scores[match.team_a_player2_id]?.[holeNumber] ?? null
      : null

    const teamBPlayer1Score = scores[match.team_b_player1_id]?.[holeNumber] ?? null
    const teamBPlayer2Score = match.team_b_player2_id
      ? scores[match.team_b_player2_id]?.[holeNumber] ?? null
      : null

    // Get handicaps
    const teamAPlayer1Handicap = handicaps[match.team_a_player1_id] ?? 0
    const teamAPlayer2Handicap = match.team_a_player2_id
      ? handicaps[match.team_a_player2_id] ?? 0
      : null

    const teamBPlayer1Handicap = handicaps[match.team_b_player1_id] ?? 0
    const teamBPlayer2Handicap = match.team_b_player2_id
      ? handicaps[match.team_b_player2_id] ?? 0
      : null

    // Calculate team net scores
    const teamANet = calculateTeamNetScore(
      match.match_type,
      teamAPlayer1Score,
      teamAPlayer1Handicap,
      teamAPlayer2Score,
      teamAPlayer2Handicap,
      strokeIndex
    )

    const teamBNet = calculateTeamNetScore(
      match.match_type,
      teamBPlayer1Score,
      teamBPlayer1Handicap,
      teamBPlayer2Score,
      teamBPlayer2Handicap,
      strokeIndex
    )

    // Determine hole winner
    let winner: ComputedHoleResult['winner'] = null

    if (teamANet !== null && teamBNet !== null) {
      if (teamANet < teamBNet) {
        winner = 'team_a'
        cumulativeLead += 1
      } else if (teamBNet < teamANet) {
        winner = 'team_b'
        cumulativeLead -= 1
      } else {
        winner = 'halved'
      }
    }

    results.push({
      holeNumber,
      teamANetScore: teamANet,
      teamBNetScore: teamBNet,
      winner,
      cumulativeLead,
    })
  }

  return results
}

/**
 * Compute press-specific hole results (starting from a given hole)
 */
export function computePressHoleResults(
  holeResults: ComputedHoleResult[],
  startingHole: number
): ComputedHoleResult[] {
  const pressResults: ComputedHoleResult[] = []
  let pressLead = 0

  for (const result of holeResults) {
    if (result.holeNumber < startingHole) continue

    // Adjust lead for press (reset from starting hole)
    if (result.winner === 'team_a') {
      pressLead += 1
    } else if (result.winner === 'team_b') {
      pressLead -= 1
    }

    pressResults.push({
      ...result,
      cumulativeLead: pressLead,
    })
  }

  return pressResults
}

// ============================================================================
// MATCH STATE COMPUTATION
// ============================================================================

/**
 * Check if match is dormie (lead equals holes remaining)
 */
export function isDormie(lead: number, holesRemaining: number): boolean {
  return Math.abs(lead) === holesRemaining && holesRemaining > 0
}

/**
 * Check if match is closed (mathematically over)
 */
export function isMatchClosed(lead: number, holesRemaining: number): boolean {
  return Math.abs(lead) > holesRemaining
}

/**
 * Compute full match state from scores
 */
export function computeMatchState(
  match: DbMatch,
  presses: DbPress[],
  holeResults: ComputedHoleResult[],
  teamAInfo: TeamInfo,
  teamBInfo: TeamInfo,
  totalHoles: number = 18
): MatchState {
  // Count completed holes
  const completedResults = holeResults.filter((r) => r.winner !== null)
  const holesPlayed = completedResults.length
  const holesRemaining = totalHoles - holesPlayed

  // Get current lead from last completed hole
  const currentLead = completedResults.length > 0
    ? completedResults[completedResults.length - 1].cumulativeLead
    : 0

  const matchClosed = isMatchClosed(currentLead, holesRemaining)
  const matchDormie = isDormie(currentLead, holesRemaining)

  // Determine match status and result
  let status = match.status
  let winner = match.winner
  let finalResult = match.final_result

  if (matchClosed && status !== 'completed') {
    status = 'completed'
    winner = currentLead > 0 ? 'team_a' : 'team_b'
    finalResult = formatMatchStatus(currentLead, holesRemaining, true)
  } else if (holesRemaining === 0 && status !== 'completed') {
    status = 'completed'
    if (currentLead === 0) {
      winner = 'halved'
      finalResult = 'A/S'
    } else {
      winner = currentLead > 0 ? 'team_a' : 'team_b'
      finalResult = formatMatchStatus(currentLead, holesRemaining, true)
    }
  }

  // Compute press states
  const pressStates: PressState[] = presses.map((press, index) => {
    const pressResults = computePressHoleResults(holeResults, press.starting_hole)
    const completedPressResults = pressResults.filter((r) => r.winner !== null)
    const pressHolesPlayed = completedPressResults.length
    const pressHolesRemaining = totalHoles - press.starting_hole + 1 - pressHolesPlayed

    const pressLead = completedPressResults.length > 0
      ? completedPressResults[completedPressResults.length - 1].cumulativeLead
      : 0

    const pressClosed = isMatchClosed(pressLead, pressHolesRemaining)

    let pressStatus = press.status
    let pressWinner = press.winner
    let pressFinalResult = press.final_result

    if (pressClosed && pressStatus !== 'completed') {
      pressStatus = 'completed'
      pressWinner = pressLead > 0 ? 'team_a' : 'team_b'
      pressFinalResult = formatMatchStatus(pressLead, pressHolesRemaining, true)
    } else if (pressHolesRemaining === 0 && pressStatus !== 'completed') {
      pressStatus = 'completed'
      if (pressLead === 0) {
        pressWinner = 'halved'
        pressFinalResult = 'A/S'
      } else {
        pressWinner = pressLead > 0 ? 'team_a' : 'team_b'
        pressFinalResult = formatMatchStatus(pressLead, pressHolesRemaining, true)
      }
    }

    return {
      id: press.id,
      pressNumber: index + 1,
      startingHole: press.starting_hole,
      stakePerHole: press.stake_per_hole,
      status: pressStatus,
      winner: pressWinner,
      finalResult: pressFinalResult,
      currentLead: pressLead,
      holesPlayed: pressHolesPlayed,
      holesRemaining: pressHolesRemaining,
    }
  })

  return {
    matchId: match.id,
    roundId: match.round_id,
    matchType: match.match_type,
    stakePerHole: match.stake_per_hole,
    status,
    winner,
    finalResult,
    teamA: teamAInfo,
    teamB: teamBInfo,
    currentLead,
    holesPlayed,
    holesRemaining,
    isDormie: matchDormie,
    isMatchClosed: matchClosed,
    holeResults,
    presses: pressStates,
  }
}

// ============================================================================
// HOLE MATCH INFO (What's at stake)
// ============================================================================

/**
 * Calculate what's at stake for a specific hole
 * This is the "hero" element: "This hole: $X on the line"
 */
export function getHoleMatchInfo(
  matchState: MatchState,
  currentHole: number
): HoleMatchInfo {
  // Main match stake for this hole
  const mainMatchStake = matchState.isMatchClosed ? 0 : matchState.stakePerHole

  // Active press stakes for this hole
  const pressBreakdown = matchState.presses
    .filter(
      (p) =>
        p.startingHole <= currentHole &&
        p.status === 'in_progress'
    )
    .map((p) => ({
      pressNumber: p.pressNumber,
      amount: p.stakePerHole,
    }))

  const totalAtStake =
    mainMatchStake +
    pressBreakdown.reduce((sum, p) => sum + p.amount, 0)

  return {
    holeNumber: currentHole,
    totalAtStake,
    breakdown: {
      mainMatch: mainMatchStake,
      presses: pressBreakdown,
    },
    matchState: {
      lead: matchState.currentLead,
      status: formatLeadStatus(matchState.currentLead),
      isDormie: matchState.isDormie,
      isMatchClosed: matchState.isMatchClosed,
    },
    pressStates: matchState.presses
      .filter((p) => p.startingHole <= currentHole)
      .map((p) => ({
        pressNumber: p.pressNumber,
        lead: p.currentLead,
        status: formatLeadStatus(p.currentLead),
      })),
  }
}

// ============================================================================
// EXPOSURE CALCULATIONS
// ============================================================================

/**
 * Calculate total exposure (maximum potential loss)
 */
export function calculateExposure(matchState: MatchState): ExposureInfo {
  // Main match exposure: stake × holes remaining (if not closed)
  const mainMatchExposure = matchState.isMatchClosed
    ? Math.abs(matchState.currentLead) * matchState.stakePerHole
    : matchState.holesRemaining * matchState.stakePerHole

  // Press exposures
  const pressExposures = matchState.presses.map((press) => ({
    pressNumber: press.pressNumber,
    exposure:
      press.status === 'completed'
        ? Math.abs(press.currentLead) * press.stakePerHole
        : press.holesRemaining * press.stakePerHole,
  }))

  const totalExposure =
    mainMatchExposure +
    pressExposures.reduce((sum, p) => sum + p.exposure, 0)

  // Current position: positive if winning, negative if losing
  const mainPosition = matchState.currentLead * matchState.stakePerHole
  const pressPositions = matchState.presses.reduce(
    (sum, p) => sum + p.currentLead * p.stakePerHole,
    0
  )
  const currentPosition = mainPosition + pressPositions

  return {
    totalExposure,
    mainMatchExposure,
    pressExposures,
    currentPosition,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build player score map from array of scores
 */
export function buildScoreMap(scores: DbScore[]): PlayerScoreMap {
  const map: PlayerScoreMap = {}

  for (const score of scores) {
    if (!map[score.player_id]) {
      map[score.player_id] = {}
    }
    map[score.player_id][score.hole_number] = score.gross_strokes
  }

  return map
}

/**
 * Build player handicap map from group players
 */
export function buildHandicapMap(groupPlayers: DbGroupPlayer[]): PlayerHandicapMap {
  const map: PlayerHandicapMap = {}

  for (const gp of groupPlayers) {
    map[gp.player_id] = gp.playing_handicap ?? 0
  }

  return map
}

/**
 * Format money amount for display
 */
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(0)}`
}

/**
 * Get team player names for display
 */
export function formatTeamNames(team: TeamInfo): string {
  if (team.player2) {
    return `${team.player1.name}/${team.player2.name}`
  }
  return team.player1.name
}
