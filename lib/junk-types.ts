/**
 * Types for the Junk / Side Bets system
 *
 * Junk bets are an overlay that runs alongside any main round format.
 * Players claim junk events during scoring (greenie, sandy, etc.)
 * and they settle independently from the main money game.
 */

// ============================================================================
// JUNK BET TYPE DEFINITIONS
// ============================================================================

/** All supported junk bet types */
export type JunkType =
  | 'greenie'
  | 'sandy'
  | 'barkie'
  | 'polie'
  | 'snake'
  | 'birdie'
  | 'eagle'

/** Display metadata for each junk type */
export interface JunkTypeInfo {
  type: JunkType
  label: string
  emoji: string
  description: string
  /** Whether this junk type is self-reported (honor system) */
  selfReported: boolean
  /** Whether this type can be auto-detected from scores */
  autoDetectable: boolean
  /** Default value in dollars (can be overridden per round) */
  defaultValue: number
}

/** Full registry of junk bet types */
export const JUNK_TYPES: Record<JunkType, JunkTypeInfo> = {
  greenie: {
    type: 'greenie',
    label: 'Greenie',
    emoji: '🟢',
    description: 'Closest to pin on par 3 (must be on green)',
    selfReported: false,
    autoDetectable: false,
    defaultValue: 5,
  },
  sandy: {
    type: 'sandy',
    label: 'Sandy',
    emoji: '🏖️',
    description: 'Par or better from a bunker',
    selfReported: true,
    autoDetectable: false,
    defaultValue: 5,
  },
  barkie: {
    type: 'barkie',
    label: 'Barkie',
    emoji: '🌲',
    description: 'Par or better after hitting a tree',
    selfReported: true,
    autoDetectable: false,
    defaultValue: 5,
  },
  polie: {
    type: 'polie',
    label: 'Polie',
    emoji: '🎯',
    description: 'Sinking a long putt (20ft+)',
    selfReported: true,
    autoDetectable: false,
    defaultValue: 5,
  },
  snake: {
    type: 'snake',
    label: 'Snake',
    emoji: '🐍',
    description: '3-putt penalty — passes to last player who 3-putts',
    selfReported: true,
    autoDetectable: false,
    defaultValue: 5,
  },
  birdie: {
    type: 'birdie',
    label: 'Birdie',
    emoji: '🐦',
    description: 'Score one under par',
    selfReported: false,
    autoDetectable: true,
    defaultValue: 5,
  },
  eagle: {
    type: 'eagle',
    label: 'Eagle',
    emoji: '🦅',
    description: 'Score two or more under par',
    selfReported: false,
    autoDetectable: true,
    defaultValue: 10,
  },
} as const

// ============================================================================
// ROUND JUNK CONFIG
// ============================================================================

/** Per-junk-type configuration for a round */
export interface JunkBetConfig {
  type: JunkType
  enabled: boolean
  value: number
}

/** Full junk configuration for a round */
export interface RoundJunkConfig {
  enabled: boolean
  bets: JunkBetConfig[]
}

/** Default junk config (all common types enabled at $5) */
export const DEFAULT_JUNK_CONFIG: RoundJunkConfig = {
  enabled: false,
  bets: [
    { type: 'greenie', enabled: true, value: 5 },
    { type: 'sandy', enabled: true, value: 5 },
    { type: 'barkie', enabled: true, value: 5 },
    { type: 'polie', enabled: true, value: 5 },
    { type: 'snake', enabled: true, value: 5 },
    { type: 'birdie', enabled: true, value: 5 },
    { type: 'eagle', enabled: true, value: 10 },
  ],
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

/** Row in the junk_bets table */
export interface DbJunkBet {
  id: string
  round_id: string
  player_id: string
  hole_number: number
  junk_type: JunkType
  value: number
  created_at: string
}

export type DbJunkBetInsert = Omit<DbJunkBet, 'id' | 'created_at'>

// ============================================================================
// COMPUTED / DISPLAY TYPES
// ============================================================================

/** A single junk event for display */
export interface JunkEvent {
  id: string
  playerId: string
  playerName: string
  holeNumber: number
  junkType: JunkType
  value: number
}

/** Snake state tracking */
export interface SnakeState {
  /** Player currently holding the snake (null if nobody has 3-putted yet) */
  currentHolderId: string | null
  currentHolderName: string | null
  /** History of snake transfers */
  transfers: {
    playerId: string
    playerName: string
    holeNumber: number
  }[]
  /** Value the snake holder pays each other player */
  valuePerPlayer: number
}

/** Per-player junk settlement summary */
export interface PlayerJunkSummary {
  playerId: string
  playerName: string
  /** Junk events this player claimed (earnings) */
  claims: {
    junkType: JunkType
    count: number
    totalValue: number
  }[]
  /** Total earned from junk claims */
  totalEarnings: number
  /** Snake penalty (if holding the snake at end) — negative value */
  snakePenalty: number
  /** Net junk position */
  netJunk: number
}

/** Full junk settlement for a round */
export interface RoundJunkSettlement {
  roundId: string
  roundName: string
  playerSummaries: PlayerJunkSummary[]
  snakeState: SnakeState | null
  totalPot: number
}
