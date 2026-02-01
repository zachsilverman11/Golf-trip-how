'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { JUNK_TYPES, type JunkType, type RoundJunkConfig, type DbJunkBet } from '@/lib/junk-types'
import { getEnabledJunkTypes } from '@/lib/junk-utils'
import { toggleJunkBetAction, getJunkBetsForHoleAction } from '@/lib/supabase/junk-actions'

// ============================================================================
// Types
// ============================================================================

interface Player {
  id: string
  name: string
}

interface JunkBetButtonsProps {
  roundId: string
  players: Player[]
  selectedPlayerId: string | null
  currentHole: number
  par: number
  junkConfig: RoundJunkConfig
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function JunkBetButtons({
  roundId,
  players,
  selectedPlayerId,
  currentHole,
  par,
  junkConfig,
  className,
}: JunkBetButtonsProps) {
  const [holeBets, setHoleBets] = useState<DbJunkBet[]>([])
  const [saving, setSaving] = useState(false)

  // Get enabled junk types for this hole
  const enabledTypes = getEnabledJunkTypes(junkConfig, par)

  // Load bets for current hole
  useEffect(() => {
    let cancelled = false

    const loadBets = async () => {
      const result = await getJunkBetsForHoleAction(roundId, currentHole)
      if (!cancelled && result.bets) {
        setHoleBets(result.bets)
      }
    }

    loadBets()
    return () => { cancelled = true }
  }, [roundId, currentHole])

  // Check if a player has claimed a specific junk type on this hole
  const hasClaim = useCallback(
    (playerId: string, junkType: JunkType): boolean => {
      return holeBets.some(
        (b) => b.player_id === playerId && b.junk_type === junkType
      )
    },
    [holeBets]
  )

  // Get all claims for a junk type on this hole
  const getClaimsForType = useCallback(
    (junkType: JunkType): DbJunkBet[] => {
      return holeBets.filter((b) => b.junk_type === junkType)
    },
    [holeBets]
  )

  // Toggle a junk claim
  const handleToggle = useCallback(
    async (junkType: JunkType) => {
      if (!selectedPlayerId || saving) return

      const betConfig = junkConfig.bets.find((b) => b.type === junkType)
      if (!betConfig) return

      setSaving(true)

      // Optimistic update
      const existing = holeBets.find(
        (b) => b.player_id === selectedPlayerId && b.junk_type === junkType
      )

      if (existing) {
        // Remove
        setHoleBets((prev) =>
          prev.filter(
            (b) => !(b.player_id === selectedPlayerId && b.junk_type === junkType)
          )
        )
      } else {
        // Add
        const optimisticBet: DbJunkBet = {
          id: `temp-${Date.now()}`,
          round_id: roundId,
          player_id: selectedPlayerId,
          hole_number: currentHole,
          junk_type: junkType,
          value: betConfig.value,
          created_at: new Date().toISOString(),
        }
        setHoleBets((prev) => [...prev, optimisticBet])
      }

      const result = await toggleJunkBetAction({
        roundId,
        playerId: selectedPlayerId,
        holeNumber: currentHole,
        junkType,
        value: betConfig.value,
      })

      if (!result.success) {
        // Revert on failure — reload from server
        const reloadResult = await getJunkBetsForHoleAction(roundId, currentHole)
        if (reloadResult.bets) {
          setHoleBets(reloadResult.bets)
        }
      }

      setSaving(false)
    },
    [selectedPlayerId, roundId, currentHole, junkConfig, holeBets, saving]
  )

  if (enabledTypes.length === 0 || !junkConfig.enabled) {
    return null
  }

  const selectedPlayerName = players.find((p) => p.id === selectedPlayerId)?.name

  return (
    <div className={cn('', className)}>
      {/* Label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-text-2 uppercase tracking-wide">
          Side Bets
        </span>
        {selectedPlayerName && (
          <span className="text-xs text-text-2">
            for {selectedPlayerName.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Pill buttons — horizontal scrolling row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {enabledTypes.map((junkType) => {
          const info = JUNK_TYPES[junkType]
          const betConfig = junkConfig.bets.find((b) => b.type === junkType)
          const isActive = selectedPlayerId
            ? hasClaim(selectedPlayerId, junkType)
            : false
          const claims = getClaimsForType(junkType)
          const claimCount = claims.length

          return (
            <button
              key={junkType}
              type="button"
              onClick={() => handleToggle(junkType)}
              disabled={!selectedPlayerId || saving}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
                'border',
                isActive
                  ? 'bg-gold/20 border-gold/50 text-gold shadow-sm shadow-gold/10'
                  : 'bg-bg-2 border-stroke text-text-2 hover:border-text-2/50',
                !selectedPlayerId && 'opacity-50 cursor-not-allowed',
                saving && 'opacity-70'
              )}
            >
              <span>{info.emoji}</span>
              <span>{info.label}</span>
              {betConfig && (
                <span className={cn(
                  'text-[10px]',
                  isActive ? 'text-gold/70' : 'text-text-2/60'
                )}>
                  ${betConfig.value}
                </span>
              )}
              {claimCount > 0 && !isActive && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">
                  {claimCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active claims summary for this hole */}
      {holeBets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {holeBets.map((bet) => {
            const info = JUNK_TYPES[bet.junk_type]
            const player = players.find((p) => p.id === bet.player_id)
            return (
              <span
                key={bet.id}
                className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold/80"
              >
                {info.emoji} {player?.name.split(' ')[0]} — {info.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
