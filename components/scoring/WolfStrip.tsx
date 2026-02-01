'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { WolfState, WolfPlayerInfo } from '@/lib/wolf-utils'
import { getAvailablePartners, formatWolfPoints, getTeeOrderForHole } from '@/lib/wolf-utils'

interface WolfStripProps {
  wolfState: WolfState
  currentHole: number
  tripId: string
  roundId: string
  /** Called when the wolf picks a partner or goes lone */
  onWolfDecision?: (holeNumber: number, partnerId: string | null, isLoneWolf: boolean) => void
  className?: string
}

/**
 * Live status strip for Wolf format on the scoring screen.
 * Shows current wolf, partner selection UI, standings, and lone wolf toggle.
 */
export function WolfStrip({
  wolfState,
  currentHole,
  tripId,
  roundId,
  onWolfDecision,
  className,
}: WolfStripProps) {
  const {
    stakePerHole,
    loneWolfMultiplier,
    players,
    playerTotals,
    currentWolfId,
    currentWolfName,
    holeResults,
    decisions,
  } = wolfState

  // Check if current hole has a decision already
  const currentHoleResult = holeResults.find(h => h.holeNumber === currentHole)
  const hasDecision = currentHoleResult?.decided ?? false

  // Available partners for current wolf
  const availablePartners = useMemo(() => {
    if (!currentWolfId) return []
    return getAvailablePartners(players, currentWolfId)
  }, [players, currentWolfId])

  // Tee order for current hole
  const currentTeeOrder = useMemo(() => {
    return getTeeOrderForHole(wolfState.teeOrder, currentHole)
  }, [wolfState.teeOrder, currentHole])

  // Sort players by standing
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => (playerTotals[b.id] || 0) - (playerTotals[a.id] || 0))
  }, [players, playerTotals])

  const handlePickPartner = useCallback((partnerId: string) => {
    onWolfDecision?.(currentHole, partnerId, false)
  }, [currentHole, onWolfDecision])

  const handleLoneWolf = useCallback(() => {
    onWolfDecision?.(currentHole, null, true)
  }, [currentHole, onWolfDecision])

  return (
    <div
      className={cn(
        'bg-bg-1 border border-stroke rounded-card p-4',
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-3">
        <div className="text-text-2 text-xs uppercase tracking-wider mb-1">
          Wolf · ${stakePerHole}/hole
          {loneWolfMultiplier > 1 && (
            <span className="text-gold"> · Lone Wolf {loneWolfMultiplier}×</span>
          )}
        </div>

        {/* Current wolf callout */}
        <div className="font-display text-lg font-bold text-accent">
          🐺 {currentWolfName || 'Unknown'} is the Wolf
          <span className="block text-xs font-normal text-text-2 mt-0.5">
            Hole {currentHole}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Tee order display */}
      <div className="mb-3">
        <div className="text-xs text-text-2 mb-1.5 text-center">Tee Order</div>
        <div className="flex items-center justify-center gap-1.5">
          {currentTeeOrder.map((playerId, idx) => {
            const player = players.find(p => p.id === playerId)
            const isWolf = playerId === currentWolfId
            return (
              <span
                key={playerId}
                className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  isWolf
                    ? 'bg-accent/20 text-accent font-bold border border-accent/40'
                    : 'bg-bg-2 text-text-1'
                )}
              >
                {idx + 1}. {player?.name.split(' ')[0] ?? '?'}
                {isWolf && ' 🐺'}
              </span>
            )
          })}
        </div>
      </div>

      {/* Partner selection (only if no decision yet and callback provided) */}
      {!hasDecision && onWolfDecision && (
        <>
          <div className="border-t border-stroke/50 my-3" />
          <div className="space-y-2">
            <div className="text-xs text-text-2 text-center mb-2">
              Wolf picks a partner:
            </div>
            <div className="grid grid-cols-3 gap-2">
              {availablePartners.map(partner => (
                <Button
                  key={partner.id}
                  type="button"
                  variant="secondary"
                  size="default"
                  onClick={() => handlePickPartner(partner.id)}
                  className="text-xs"
                >
                  {partner.name.split(' ')[0]}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="primary"
              size="default"
              onClick={handleLoneWolf}
              className="w-full mt-2 bg-gold/20 border-gold/40 text-gold hover:bg-gold/30"
            >
              🐺 Lone Wolf ({loneWolfMultiplier}× stakes)
            </Button>
          </div>
        </>
      )}

      {/* Current hole decision display */}
      {hasDecision && currentHoleResult && (
        <>
          <div className="border-t border-stroke/50 my-3" />
          <div className="text-center text-sm">
            {currentHoleResult.isLoneWolf ? (
              <Badge variant="gold">
                🐺 Lone Wolf · ${stakePerHole * loneWolfMultiplier}/man
              </Badge>
            ) : currentHoleResult.partnerName ? (
              <span className="text-text-1">
                Wolf picked <span className="font-bold text-accent">{currentHoleResult.partnerName.split(' ')[0]}</span>
                {' · '}
                <span className="text-text-2">${stakePerHole}/man</span>
              </span>
            ) : null}
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Player standings */}
      <div className="space-y-1.5">
        <div className="text-xs text-text-2 text-center mb-1">Standings</div>
        {sortedPlayers.map((player, idx) => {
          const total = playerTotals[player.id] || 0
          const isLeader = idx === 0 && total > 0

          return (
            <div
              key={player.id}
              className={cn(
                'flex items-center justify-between px-2 py-1.5 rounded-card-sm',
                isLeader && 'bg-good/10 border border-good/20'
              )}
            >
              <span className={cn(
                'text-sm',
                isLeader ? 'font-bold text-good' : 'text-text-1'
              )}>
                {player.name.split(' ')[0]}
              </span>
              <span className={cn(
                'text-sm font-bold',
                total > 0 ? 'text-good' : total < 0 ? 'text-bad' : 'text-text-2'
              )}>
                {formatWolfPoints(total)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-2">
        <Link
          href={`/trip/${tripId}/round/${roundId}`}
          className="text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View Details →
        </Link>
        <span>{wolfState.holesPlayed} of 18 holes</span>
      </div>
    </div>
  )
}

/**
 * Compact version for smaller spaces.
 */
export function WolfStripCompact({
  wolfState,
  className,
}: { wolfState: WolfState; className?: string }) {
  const { currentWolfName, stakePerHole, holesPlayed } = wolfState

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span className="text-text-2">
        Wolf: <span className="font-bold text-accent">🐺 {currentWolfName?.split(' ')[0]}</span>
        {' · '}
        <span className="text-text-1">${stakePerHole}/hole</span>
      </span>
      <span className="text-text-2">{holesPlayed} holes</span>
    </div>
  )
}
