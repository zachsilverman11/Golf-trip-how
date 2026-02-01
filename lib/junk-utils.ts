/**
 * Junk Bet Calculation and Settlement Utilities
 *
 * All logic for computing junk payouts, snake tracking, and settlements.
 */

import type {
  JunkType,
  JunkEvent,
  SnakeState,
  PlayerJunkSummary,
  RoundJunkSettlement,
  RoundJunkConfig,
  DbJunkBet,
  JUNK_TYPES,
} from './junk-types'

// ============================================================================
// SNAKE TRACKING
// ============================================================================

/**
 * Compute the snake state from junk bet records.
 * Snake transfers happen in hole order — whoever 3-putts last holds the snake.
 */
export function computeSnakeState(
  snakeBets: DbJunkBet[],
  playerNames: Record<string, string>,
  valuePerPlayer: number
): SnakeState {
  // Sort by hole number to replay in order
  const sorted = [...snakeBets].sort((a, b) => a.hole_number - b.hole_number)

  const transfers = sorted.map((bet) => ({
    playerId: bet.player_id,
    playerName: playerNames[bet.player_id] || 'Unknown',
    holeNumber: bet.hole_number,
  }))

  const lastTransfer = transfers.length > 0 ? transfers[transfers.length - 1] : null

  return {
    currentHolderId: lastTransfer?.playerId ?? null,
    currentHolderName: lastTransfer?.playerName ?? null,
    transfers,
    valuePerPlayer,
  }
}

// ============================================================================
// SETTLEMENT CALCULATIONS
// ============================================================================

/**
 * Calculate the full junk settlement for a round.
 *
 * Payout model (simple "pot" model):
 * - For each non-snake junk claim, the claiming player earns <value> from the pot
 * - The pot is split evenly among all other players as a cost
 * - Snake: the holder at the end pays each other player the snake value
 */
export function calculateJunkSettlement(
  roundId: string,
  roundName: string,
  junkBets: DbJunkBet[],
  playerIds: string[],
  playerNames: Record<string, string>,
  junkConfig: RoundJunkConfig
): RoundJunkSettlement {
  const playerCount = playerIds.length

  // Separate snake bets from regular junk
  const snakeBets = junkBets.filter((b) => b.junk_type === 'snake')
  const regularBets = junkBets.filter((b) => b.junk_type !== 'snake')

  // Build per-player summaries
  const summaries: Map<string, PlayerJunkSummary> = new Map()

  // Initialize all players
  for (const playerId of playerIds) {
    summaries.set(playerId, {
      playerId,
      playerName: playerNames[playerId] || 'Unknown',
      claims: [],
      totalEarnings: 0,
      snakePenalty: 0,
      netJunk: 0,
    })
  }

  // Count claims per player per junk type
  const claimCounts: Map<string, Map<JunkType, { count: number; totalValue: number }>> = new Map()

  for (const bet of regularBets) {
    if (!claimCounts.has(bet.player_id)) {
      claimCounts.set(bet.player_id, new Map())
    }
    const playerClaims = claimCounts.get(bet.player_id)!
    const existing = playerClaims.get(bet.junk_type) || { count: 0, totalValue: 0 }
    existing.count += 1
    existing.totalValue += bet.value
    playerClaims.set(bet.junk_type, existing)
  }

  // Apply claims to summaries
  for (const [playerId, claims] of claimCounts) {
    const summary = summaries.get(playerId)
    if (!summary) continue

    for (const [junkType, data] of claims) {
      summary.claims.push({
        junkType,
        count: data.count,
        totalValue: data.totalValue,
      })
      summary.totalEarnings += data.totalValue
    }
  }

  // Snake settlement
  let snakeState: SnakeState | null = null
  const snakeConfig = junkConfig.bets.find((b) => b.type === 'snake')

  if (snakeConfig?.enabled && snakeBets.length > 0) {
    snakeState = computeSnakeState(snakeBets, playerNames, snakeConfig.value)

    if (snakeState.currentHolderId) {
      const holderSummary = summaries.get(snakeState.currentHolderId)
      if (holderSummary) {
        // Snake holder pays each OTHER player
        const penaltyTotal = snakeConfig.value * (playerCount - 1)
        holderSummary.snakePenalty = -penaltyTotal
      }
    }
  }

  // Calculate net totals
  let totalPot = 0
  for (const summary of summaries.values()) {
    summary.netJunk = summary.totalEarnings + summary.snakePenalty
    totalPot += summary.totalEarnings
  }

  return {
    roundId,
    roundName,
    playerSummaries: Array.from(summaries.values()).sort(
      (a, b) => b.netJunk - a.netJunk
    ),
    snakeState,
    totalPot,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a junk type should be shown for the current hole.
 * Greenies are only relevant on par 3s.
 */
export function isJunkRelevantForHole(
  junkType: JunkType,
  par: number
): boolean {
  if (junkType === 'greenie') {
    return par === 3
  }
  // All other junk types can happen on any hole
  return true
}

/**
 * Check if a score qualifies for an auto-detected junk type.
 * Used for birdie/eagle detection.
 */
export function checkAutoJunk(
  grossScore: number,
  par: number
): JunkType | null {
  const diff = grossScore - par
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  return null
}

/**
 * Get enabled junk types for a round config, filtered by hole par
 */
export function getEnabledJunkTypes(
  config: RoundJunkConfig,
  par: number
): JunkType[] {
  if (!config.enabled) return []

  return config.bets
    .filter((bet) => bet.enabled && isJunkRelevantForHole(bet.type, par))
    .map((bet) => bet.type)
}

/**
 * Format junk value for display
 */
export function formatJunkValue(value: number): string {
  return `$${value}`
}
