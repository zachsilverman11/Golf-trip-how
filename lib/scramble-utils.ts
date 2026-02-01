/**
 * Scramble format utilities.
 *
 * Scramble: 2 teams, all players hit, pick best shot, repeat.
 * One score per team per hole. Stroke-based — lowest total team score wins.
 *
 * Score storage note: We reuse the existing `scores` table. The first player
 * on each team (the "captain") holds the team's score. The scramble format
 * knows to treat these as team scores, not individual scores.
 */

export interface ScrambleResult {
  winner: 'teamA' | 'teamB' | 'tied'
  teamATotal: number
  teamBTotal: number
  margin: number // strokes difference
  holesCompleted: number
}

/**
 * Compute the scramble result from two sets of team scores.
 * Returns null if no holes have been completed by both teams.
 */
export function computeScrambleResult(
  teamAScores: { [hole: number]: number | null },
  teamBScores: { [hole: number]: number | null },
  totalHoles: number
): ScrambleResult | null {
  let teamATotal = 0
  let teamBTotal = 0
  let holesCompleted = 0

  for (let h = 1; h <= totalHoles; h++) {
    const aScore = teamAScores[h]
    const bScore = teamBScores[h]

    // Only count holes where BOTH teams have scores
    if (aScore !== null && aScore !== undefined && bScore !== null && bScore !== undefined) {
      teamATotal += aScore
      teamBTotal += bScore
      holesCompleted++
    }
  }

  if (holesCompleted === 0) return null

  const margin = Math.abs(teamATotal - teamBTotal)

  let winner: 'teamA' | 'teamB' | 'tied'
  if (teamATotal < teamBTotal) {
    winner = 'teamA'
  } else if (teamBTotal < teamATotal) {
    winner = 'teamB'
  } else {
    winner = 'tied'
  }

  return {
    winner,
    teamATotal,
    teamBTotal,
    margin,
    holesCompleted,
  }
}

/**
 * Build team scores map from the raw scores map.
 * In scramble, the team captain's player ID holds the team score.
 */
export function extractTeamScores(
  scores: { [playerId: string]: { [hole: number]: number | null } },
  captainId: string
): { [hole: number]: number | null } {
  return scores[captainId] || {}
}
