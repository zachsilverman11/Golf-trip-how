/**
 * Wolf Bet Utilities
 *
 * Wolf is a rotating captain format for exactly 4 players.
 * - Tee order rotates each hole (1-2-3-4, then 2-3-4-1, etc.)
 * - The "Wolf" (first in order) watches each player tee off
 *   and can pick a partner BEFORE the next person tees off.
 * - If Wolf doesn't pick anyone → "Lone Wolf" (plays 1v3, double stakes)
 * - Hole winner: lowest combined net (team of 2) vs other 2, or Lone Wolf vs field
 * - Stakes: e.g., $2/hole normal, $4/hole Lone Wolf
 */

import { getStrokesForHole } from './handicap'
import type { DbHole } from './supabase/types'

// ============================================================================
// TYPES
// ============================================================================

export interface WolfPlayerInfo {
  id: string
  name: string
  playingHandicap: number | null
}

export interface WolfDecision {
  holeNumber: number
  wolfId: string
  partnerId: string | null // null = lone wolf
  isLoneWolf: boolean
}

export interface WolfHoleResult {
  holeNumber: number
  par: number
  wolfId: string
  wolfName: string
  partnerId: string | null
  partnerName: string | null
  isLoneWolf: boolean

  /** Net scores per player */
  playerNetScores: WolfPlayerHoleScore[]

  /** Team score (wolf + partner combined net, or wolf solo for lone wolf) */
  wolfTeamNet: number | null
  /** Field team score (other 2 or 3 players combined net) */
  fieldTeamNet: number | null

  /** Winner: 'wolf' | 'field' | 'halved' | null (incomplete) */
  winner: 'wolf' | 'field' | 'halved' | null

  /** Points won/lost by the wolf on this hole (per man) */
  wolfPointsPerMan: number

  complete: boolean
  decided: boolean // Has the wolf made their pick?
}

export interface WolfPlayerHoleScore {
  playerId: string
  playerName: string
  grossScore: number | null
  netScore: number | null
}

export interface WolfState {
  roundId: string
  stakePerHole: number
  loneWolfMultiplier: number
  teeOrder: string[] // 4 player IDs in base rotation order
  players: WolfPlayerInfo[]

  holeResults: WolfHoleResult[]
  decisions: WolfDecision[]

  /** Running totals per player (+ is winning, - is losing) */
  playerTotals: Record<string, number>

  /** Current wolf for the active hole */
  currentWolfId: string | null
  currentWolfName: string | null

  currentHole: number
  holesPlayed: number
}

export interface WolfSettlement {
  /** Per-player net result */
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
// TEE ORDER
// ============================================================================

/**
 * Get the wolf player ID for a given hole number.
 * Rotation: hole 1 = teeOrder[0], hole 2 = teeOrder[1], etc.
 */
export function getWolfForHole(teeOrder: string[], holeNumber: number): string {
  return teeOrder[(holeNumber - 1) % teeOrder.length]
}

/**
 * Get the tee order for a specific hole (rotated from base order).
 * Wolf always hits first, then the rest follow in rotation order.
 */
export function getTeeOrderForHole(teeOrder: string[], holeNumber: number): string[] {
  const offset = (holeNumber - 1) % teeOrder.length
  return [...teeOrder.slice(offset), ...teeOrder.slice(0, offset)]
}

// ============================================================================
// COMPUTE WOLF STATE
// ============================================================================

/**
 * Compute the full Wolf state from scores and decisions.
 */
export function computeWolfState(
  roundId: string,
  stakePerHole: number,
  loneWolfMultiplier: number,
  teeOrder: string[],
  players: WolfPlayerInfo[],
  scores: ScoresMap,
  holes: DbHole[],
  decisions: WolfDecision[]
): WolfState {
  const sortedHoles = [...holes].sort((a, b) => a.hole_number - b.hole_number)
  const holeResults: WolfHoleResult[] = []
  const playerTotals: Record<string, number> = {}

  for (const p of players) {
    playerTotals[p.id] = 0
  }

  // Index decisions by hole
  const decisionsByHole: Record<number, WolfDecision> = {}
  for (const d of decisions) {
    decisionsByHole[d.holeNumber] = d
  }

  let holesPlayed = 0

  for (const hole of sortedHoles) {
    const holeNum = hole.hole_number
    const wolfId = getWolfForHole(teeOrder, holeNum)
    const wolfPlayer = players.find(p => p.id === wolfId)
    const decision = decisionsByHole[holeNum]
    const decided = !!decision
    const isLoneWolf = decision?.isLoneWolf ?? false
    const partnerId = decision?.partnerId ?? null
    const partnerPlayer = partnerId ? players.find(p => p.id === partnerId) : null

    // Calculate net scores
    const playerNetScores: WolfPlayerHoleScore[] = []
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

    const complete = allComplete && playerNetScores.length === 4

    let wolfTeamNet: number | null = null
    let fieldTeamNet: number | null = null
    let winner: WolfHoleResult['winner'] = null
    let wolfPointsPerMan = 0

    if (complete && decided) {
      holesPlayed++

      const getNet = (id: string) => playerNetScores.find(p => p.playerId === id)?.netScore ?? null

      if (isLoneWolf) {
        // Lone Wolf: wolf's net vs best ball of other 3
        const wolfNet = getNet(wolfId)
        const fieldPlayers = players.filter(p => p.id !== wolfId)
        const fieldNets = fieldPlayers
          .map(p => getNet(p.id))
          .filter((n): n is number => n !== null)

        wolfTeamNet = wolfNet
        fieldTeamNet = fieldNets.length > 0 ? Math.min(...fieldNets) : null

        if (wolfTeamNet !== null && fieldTeamNet !== null) {
          if (wolfTeamNet < fieldTeamNet) {
            winner = 'wolf'
            // Lone wolf wins: collects loneWolfMultiplier × stake from each of 3 opponents
            wolfPointsPerMan = stakePerHole * loneWolfMultiplier
            playerTotals[wolfId] += wolfPointsPerMan * 3
            for (const fp of fieldPlayers) {
              playerTotals[fp.id] -= wolfPointsPerMan
            }
          } else if (wolfTeamNet > fieldTeamNet) {
            winner = 'field'
            // Lone wolf loses: pays loneWolfMultiplier × stake to each of 3
            wolfPointsPerMan = stakePerHole * loneWolfMultiplier
            playerTotals[wolfId] -= wolfPointsPerMan * 3
            for (const fp of fieldPlayers) {
              playerTotals[fp.id] += wolfPointsPerMan
            }
          } else {
            winner = 'halved'
            wolfPointsPerMan = 0
          }
        }
      } else if (partnerId) {
        // Wolf + Partner vs 2 opponents
        const wolfTeamIds = [wolfId, partnerId]
        const fieldIds = players.filter(p => !wolfTeamIds.includes(p.id)).map(p => p.id)

        const wolfNets = wolfTeamIds.map(id => getNet(id)).filter((n): n is number => n !== null)
        const fieldNets = fieldIds.map(id => getNet(id)).filter((n): n is number => n !== null)

        // Best ball for each team
        wolfTeamNet = wolfNets.length > 0 ? Math.min(...wolfNets) : null
        fieldTeamNet = fieldNets.length > 0 ? Math.min(...fieldNets) : null

        if (wolfTeamNet !== null && fieldTeamNet !== null) {
          if (wolfTeamNet < fieldTeamNet) {
            winner = 'wolf'
            wolfPointsPerMan = stakePerHole
            // Wolf team wins: each wolf team member gains stake from each field member
            for (const wId of wolfTeamIds) {
              playerTotals[wId] += stakePerHole * fieldIds.length
            }
            for (const fId of fieldIds) {
              playerTotals[fId] -= stakePerHole * wolfTeamIds.length
            }
          } else if (wolfTeamNet > fieldTeamNet) {
            winner = 'field'
            wolfPointsPerMan = stakePerHole
            for (const wId of wolfTeamIds) {
              playerTotals[wId] -= stakePerHole * fieldIds.length
            }
            for (const fId of fieldIds) {
              playerTotals[fId] += stakePerHole * wolfTeamIds.length
            }
          } else {
            winner = 'halved'
            wolfPointsPerMan = 0
          }
        }
      }
    }

    holeResults.push({
      holeNumber: holeNum,
      par: hole.par,
      wolfId,
      wolfName: wolfPlayer?.name ?? 'Unknown',
      partnerId,
      partnerName: partnerPlayer?.name ?? null,
      isLoneWolf,
      playerNetScores,
      wolfTeamNet,
      fieldTeamNet,
      winner,
      wolfPointsPerMan,
      complete,
      decided,
    })
  }

  // Current hole info
  const firstIncomplete = holeResults.find(h => !h.complete || !h.decided)
  const currentHole = firstIncomplete?.holeNumber ??
    (sortedHoles.length > 0 ? sortedHoles[sortedHoles.length - 1].hole_number : 1)
  const currentWolfId = getWolfForHole(teeOrder, currentHole)
  const currentWolfPlayer = players.find(p => p.id === currentWolfId)

  return {
    roundId,
    stakePerHole,
    loneWolfMultiplier,
    teeOrder,
    players,
    holeResults,
    decisions,
    playerTotals,
    currentWolfId,
    currentWolfName: currentWolfPlayer?.name ?? null,
    currentHole,
    holesPlayed,
  }
}

// ============================================================================
// SETTLEMENT
// ============================================================================

/**
 * Calculate Wolf settlement. Returns the running totals.
 */
export function calculateWolfSettlement(wolfState: WolfState): WolfSettlement {
  return {
    playerResults: { ...wolfState.playerTotals },
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get ordinal suffix for the wolf rotation position.
 */
export function getWolfRotationLabel(holeNumber: number, teeOrder: string[]): string {
  const idx = (holeNumber - 1) % teeOrder.length
  const labels = ['1st', '2nd', '3rd', '4th']
  return labels[idx] || `${idx + 1}th`
}

/**
 * Format wolf points for display.
 */
export function formatWolfPoints(amount: number): string {
  if (amount === 0) return '$0'
  const sign = amount > 0 ? '+' : ''
  return `${sign}$${Math.abs(amount)}`
}

/**
 * Get player names who are available as partners (everyone except wolf).
 */
export function getAvailablePartners(
  players: WolfPlayerInfo[],
  wolfId: string
): WolfPlayerInfo[] {
  return players.filter(p => p.id !== wolfId)
}
