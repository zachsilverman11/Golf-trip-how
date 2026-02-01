/**
 * Skins Bet Utilities
 *
 * Skins is an individual hole-by-hole format.
 * - Each hole has a fixed prize (skin value)
 * - Lowest NET score on a hole wins the skin
 * - If two+ players tie for lowest, the skin carries over
 * - Carryovers compound: a 4-hole carryover = 5× the skin value
 * - Settlement: total skins won × value, minus buy-in
 */

import { getStrokesForHole } from './handicap'
import type { DbHole } from './supabase/types'

// ============================================================================
// TYPES
// ============================================================================

export interface SkinsPlayerInfo {
  id: string
  name: string
  playingHandicap: number | null
}

export interface SkinsHoleResult {
  holeNumber: number
  par: number
  playerNetScores: SkinsPlayerHoleScore[]
  winnerId: string | null // null = carry
  winnerName: string | null
  carried: boolean // true if this hole's skin carried over
  potValue: number // total value of this skin (including carryovers)
  complete: boolean
}

export interface SkinsPlayerHoleScore {
  playerId: string
  playerName: string
  grossScore: number | null
  netScore: number | null
}

export interface SkinsState {
  roundId: string
  skinValue: number
  carryover: boolean
  players: SkinsPlayerInfo[]

  holeResults: SkinsHoleResult[]

  /** Current carryover pot (number of skins carried) */
  currentCarryCount: number
  /** Current carryover value in dollars */
  currentCarryValue: number

  /** Skins won per player */
  skinCounts: Record<string, number>
  /** Dollar values per player */
  skinValues: Record<string, number>

  /** Total skins awarded so far */
  totalSkinsAwarded: number
  /** Total skins still in play (carried) */
  totalSkinsCarried: number

  currentHole: number
  holesPlayed: number
}

export interface SkinsSettlement {
  /** Per-player net result (winnings minus buy-in) */
  playerResults: Record<string, number>
  /** Total pot */
  totalPot: number
  /** Buy-in per player */
  buyIn: number
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
// COMPUTE SKINS STATE
// ============================================================================

/**
 * Compute the full Skins state from scores.
 */
export function computeSkinsState(
  roundId: string,
  skinValue: number,
  carryover: boolean,
  players: SkinsPlayerInfo[],
  scores: ScoresMap,
  holes: DbHole[]
): SkinsState {
  const sortedHoles = [...holes].sort((a, b) => a.hole_number - b.hole_number)
  const holeResults: SkinsHoleResult[] = []

  const skinCounts: Record<string, number> = {}
  const skinValues: Record<string, number> = {}
  for (const p of players) {
    skinCounts[p.id] = 0
    skinValues[p.id] = 0
  }

  let currentCarryCount = 0
  let totalSkinsAwarded = 0
  let totalSkinsCarried = 0
  let holesPlayed = 0

  for (const hole of sortedHoles) {
    const holeNum = hole.hole_number
    const playerNetScores: SkinsPlayerHoleScore[] = []
    let allComplete = true

    for (const player of players) {
      const gross = scores[player.id]?.[holeNum] ?? null
      let net: number | null = null

      if (gross !== null && player.playingHandicap !== null) {
        const strokes = getStrokesForHole(player.playingHandicap, hole.stroke_index)
        net = gross - strokes
      } else if (gross === null) {
        allComplete = false
      }

      playerNetScores.push({
        playerId: player.id,
        playerName: player.name,
        grossScore: gross,
        netScore: net,
      })
    }

    const complete = allComplete && playerNetScores.length > 0

    let winnerId: string | null = null
    let winnerName: string | null = null
    let carried = false
    // Pot includes current carry + this hole's skin
    const potValue = (currentCarryCount + 1) * skinValue

    if (complete) {
      holesPlayed++

      // Find lowest net score
      const validScores = playerNetScores.filter(p => p.netScore !== null)
      if (validScores.length > 0) {
        const minNet = Math.min(...validScores.map(p => p.netScore!))
        const winners = validScores.filter(p => p.netScore === minNet)

        if (winners.length === 1) {
          // Single winner — takes the pot
          winnerId = winners[0].playerId
          winnerName = winners[0].playerName

          const skinsWon = currentCarryCount + 1
          skinCounts[winnerId] += skinsWon
          skinValues[winnerId] += potValue
          totalSkinsAwarded += skinsWon
          currentCarryCount = 0
        } else {
          // Tie — carry over
          if (carryover) {
            carried = true
            currentCarryCount++
            totalSkinsCarried++
          } else {
            // No carryover: skin is lost / split (common variant: just lost)
            currentCarryCount = 0
          }
        }
      }
    }

    holeResults.push({
      holeNumber: holeNum,
      par: hole.par,
      playerNetScores,
      winnerId,
      winnerName,
      carried,
      potValue,
      complete,
    })
  }

  // Find current hole
  const firstIncomplete = holeResults.find(h => !h.complete)
  const currentHole = firstIncomplete?.holeNumber ??
    (sortedHoles.length > 0 ? sortedHoles[sortedHoles.length - 1].hole_number : 1)

  return {
    roundId,
    skinValue,
    carryover,
    players,
    holeResults,
    currentCarryCount,
    currentCarryValue: currentCarryCount * skinValue,
    skinCounts,
    skinValues,
    totalSkinsAwarded,
    totalSkinsCarried,
    currentHole,
    holesPlayed,
  }
}

// ============================================================================
// SETTLEMENT
// ============================================================================

/**
 * Calculate Skins settlement.
 * Buy-in = skinValue × totalHoles (each player puts up for every hole).
 * Net result = winnings - buy-in.
 */
export function calculateSkinsSettlement(
  skinsState: SkinsState,
  totalHoles: number = 18
): SkinsSettlement {
  const buyIn = skinsState.skinValue * totalHoles
  const totalPot = buyIn * skinsState.players.length

  const playerResults: Record<string, number> = {}
  for (const p of skinsState.players) {
    const winnings = skinsState.skinValues[p.id] || 0
    playerResults[p.id] = winnings - buyIn
  }

  return { playerResults, totalPot, buyIn }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format carryover alert text.
 */
export function formatCarryoverAlert(carryCount: number, skinValue: number): string {
  if (carryCount === 0) return ''
  const totalValue = (carryCount + 1) * skinValue
  return `${carryCount} skin${carryCount > 1 ? 's' : ''} carried! Next hole worth $${totalValue}`
}

/**
 * Get the skin status emoji for a hole result.
 */
export function getSkinStatusIcon(result: SkinsHoleResult): string {
  if (!result.complete) return '⬜'
  if (result.winnerId) return '🏆'
  if (result.carried) return '🔄'
  return '➖'
}

/**
 * Format skin count display.
 */
export function formatSkinCount(count: number): string {
  return `${count} skin${count !== 1 ? 's' : ''}`
}
