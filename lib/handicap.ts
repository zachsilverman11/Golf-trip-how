/**
 * Golf Handicap Calculations
 *
 * These functions implement the USGA/WHS handicap formulas for calculating
 * course handicaps and net scores.
 */

/**
 * Calculate Course Handicap from Handicap Index
 *
 * Formula: Course Handicap = Index * (Slope / 113) + (Course Rating - Par)
 *
 * @param handicapIndex - Player's handicap index (e.g., 12.4)
 * @param slope - Course slope rating (55-155, typically ~113)
 * @param courseRating - Course rating (e.g., 72.3)
 * @param par - Course par (e.g., 72)
 * @returns Rounded course handicap
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  slope: number,
  courseRating: number,
  par: number
): number {
  const courseHandicap = handicapIndex * (slope / 113) + (courseRating - par)
  return Math.round(courseHandicap)
}

/**
 * Calculate the number of handicap strokes a player receives on a hole
 *
 * @param courseHandicap - Player's course handicap for the round
 * @param strokeIndex - The hole's stroke index (1-18, where 1 is hardest)
 * @returns Number of strokes the player receives on this hole (0, 1, 2, etc.)
 */
export function getStrokesForHole(
  courseHandicap: number,
  strokeIndex: number
): number {
  if (courseHandicap <= 0) {
    // Plus handicap: gives strokes back
    // A +2 would give 2 strokes back on holes with SI 17 and 18
    const absHandicap = Math.abs(courseHandicap)
    const givesBackOn = 19 - strokeIndex // SI 18 -> 1, SI 17 -> 2, etc.
    return givesBackOn <= absHandicap ? -1 : 0
  }

  // Standard handicap distribution
  // If CH = 18, player gets 1 stroke on every hole
  // If CH = 36, player gets 2 strokes on every hole
  // If CH = 20, player gets 2 strokes on SI 1-2, 1 stroke on SI 3-18

  const baseStrokes = Math.floor(courseHandicap / 18)
  const extraStrokesCount = courseHandicap % 18

  // Extra strokes go to the hardest holes (lowest stroke index)
  const getsExtraStroke = strokeIndex <= extraStrokesCount

  return baseStrokes + (getsExtraStroke ? 1 : 0)
}

/**
 * Calculate net score for a hole
 *
 * @param grossStrokes - Actual strokes taken
 * @param courseHandicap - Player's course handicap
 * @param strokeIndex - The hole's stroke index
 * @returns Net score for the hole
 */
export function calculateNetScore(
  grossStrokes: number,
  courseHandicap: number,
  strokeIndex: number
): number {
  const strokes = getStrokesForHole(courseHandicap, strokeIndex)
  return grossStrokes - strokes
}

/**
 * Calculate total net score for a round
 *
 * @param grossScores - Array of gross scores for each hole [hole1, hole2, ..., hole18]
 * @param courseHandicap - Player's course handicap
 * @param strokeIndices - Array of stroke indices for each hole
 * @returns Total net score
 */
export function calculateRoundNetTotal(
  grossScores: (number | null)[],
  courseHandicap: number,
  strokeIndices: number[]
): number {
  let netTotal = 0

  for (let i = 0; i < grossScores.length; i++) {
    const gross = grossScores[i]
    if (gross === null) continue

    const strokeIndex = strokeIndices[i] || i + 1
    const net = calculateNetScore(gross, courseHandicap, strokeIndex)
    netTotal += net
  }

  return netTotal
}

/**
 * Calculate score relative to par
 *
 * @param score - Total strokes (gross or net)
 * @param par - Course par
 * @returns Delta from par (positive = over par, negative = under par)
 */
export function calculateScoreDelta(score: number, par: number): number {
  return score - par
}

/**
 * Format score delta as string
 *
 * @param delta - Score relative to par
 * @returns Formatted string (e.g., "+5", "-2", "E")
 */
export function formatScoreDelta(delta: number): string {
  if (delta === 0) return 'E'
  if (delta > 0) return `+${delta}`
  return String(delta)
}

/**
 * Get score name for a hole
 *
 * @param grossStrokes - Strokes taken
 * @param par - Hole par
 * @returns Score name (e.g., "Birdie", "Par", "Bogey")
 */
export function getScoreName(grossStrokes: number, par: number): string {
  const delta = grossStrokes - par

  switch (delta) {
    case -3:
      return 'Albatross'
    case -2:
      return 'Eagle'
    case -1:
      return 'Birdie'
    case 0:
      return 'Par'
    case 1:
      return 'Bogey'
    case 2:
      return 'Double Bogey'
    case 3:
      return 'Triple Bogey'
    default:
      if (delta < -3) return `${Math.abs(delta)} under par`
      return `${delta} over par`
  }
}

/**
 * Calculate playing handicap for different formats
 *
 * @param courseHandicap - Player's course handicap
 * @param format - Game format
 * @param allowance - Handicap allowance percentage (default 100%)
 * @returns Playing handicap
 */
export function calculatePlayingHandicap(
  courseHandicap: number,
  format: 'stroke_play' | 'best_ball' | 'scramble' | 'match_play' = 'stroke_play',
  allowance: number = 100
): number {
  // Standard allowances by format (can be overridden)
  const formatAllowances: Record<string, number> = {
    stroke_play: 95, // 95% for individual stroke play
    best_ball: 85,   // 85% for four-ball best ball
    scramble: 35,    // 35% of low + 15% of high for scramble (simplified to 35%)
    match_play: 100, // 100% for match play
  }

  const effectiveAllowance = allowance !== 100
    ? allowance
    : formatAllowances[format] || 100

  return Math.round(courseHandicap * (effectiveAllowance / 100))
}
