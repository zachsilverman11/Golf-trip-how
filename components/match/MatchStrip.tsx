'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MatchStatus, PressStatus } from './MatchStatus'
import { PressButton } from './PressButton'
import { formatMoney, calculateExposure } from '@/lib/match-utils'
import type { MatchState, HoleMatchInfo } from '@/lib/supabase/match-types'

interface MatchStripProps {
  matchState: MatchState
  currentHole: number
  tripId: string
  roundId: string
  onPressAdded?: () => void
  className?: string
}

/**
 * Hero strip for scoring screen showing:
 * - "This hole: $X on the line" (hero element)
 * - Main match + press statuses
 * - Total exposure
 * - One-tap press button
 */
export function MatchStrip({
  matchState,
  currentHole,
  tripId,
  roundId,
  onPressAdded,
  className,
}: MatchStripProps) {
  // Calculate what's at stake for this hole (per man)
  const holeStakePerMan = useMemo(() => {
    if (matchState.isMatchClosed) return 0

    // Main match stake per man
    let total = matchState.stakePerMan

    // Add active press stakes (each press also has stake_per_man)
    for (const press of matchState.presses) {
      if (press.startingHole <= currentHole && press.status === 'in_progress') {
        total += press.stakePerMan
      }
    }

    return total
  }, [matchState, currentHole])

  // Calculate total exposure
  const exposure = useMemo(() => {
    return calculateExposure(matchState)
  }, [matchState])

  // Active presses for this hole
  const activePresses = matchState.presses.filter(
    (p) => p.startingHole <= currentHole && p.status === 'in_progress'
  )

  // Can add press only if match is still in progress
  const canAddPress = matchState.status === 'in_progress' && !matchState.isMatchClosed

  return (
    <Link
      href={`/trip/${tripId}/round/${roundId}/match`}
      className={cn(
        'block bg-bg-1 border border-stroke rounded-card p-4',
        'hover:border-accent/50 transition-colors',
        className
      )}
    >
      {/* Hero: This hole value per man */}
      <div className="text-center mb-3">
        <div className="text-text-2 text-xs uppercase tracking-wider mb-1">
          This Hole
        </div>
        <div className="font-display text-2xl font-bold text-accent">
          {formatMoney(holeStakePerMan)} per man
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main match status */}
          <MatchStatus lead={matchState.currentLead} label="status" />

          {/* Press statuses */}
          {activePresses.map((press) => (
            <PressStatus
              key={press.id}
              pressNumber={press.pressNumber}
              lead={press.currentLead}
            />
          ))}
        </div>

        {/* Press button */}
        {canAddPress && (
          <PressButton
            matchId={matchState.matchId}
            currentHole={currentHole}
            onPressAdded={onPressAdded}
          />
        )}
      </div>

      {/* Total exposure (per man) */}
      <div className="mt-3 text-center text-xs text-text-2">
        Exposure: <span className="font-medium text-text-1">{formatMoney(exposure.totalExposure)}/man</span>
        {exposure.currentPosition !== 0 && (
          <span className={cn(
            'ml-2',
            exposure.currentPosition > 0 ? 'text-good' : 'text-bad'
          )}>
            ({exposure.currentPosition > 0 ? '+' : ''}{formatMoney(exposure.currentPosition)})
          </span>
        )}
      </div>

      {/* Match closed indicator */}
      {matchState.isMatchClosed && (
        <div className="mt-2 text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gold/15 text-gold text-xs font-medium">
            Match Complete: {matchState.finalResult}
          </span>
        </div>
      )}
    </Link>
  )
}

/**
 * Compact version for smaller spaces
 */
export function MatchStripCompact({
  matchState,
  currentHole,
  className,
}: Omit<MatchStripProps, 'tripId' | 'roundId' | 'onPressAdded'>) {
  const holeStakePerMan = useMemo(() => {
    if (matchState.isMatchClosed) return 0
    let total = matchState.stakePerMan
    for (const press of matchState.presses) {
      if (press.startingHole <= currentHole && press.status === 'in_progress') {
        total += press.stakePerMan
      }
    }
    return total
  }, [matchState, currentHole])

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span className="text-text-2">
        Hole {currentHole}: <span className="font-bold text-accent">{formatMoney(holeStakePerMan)}/man</span>
      </span>
      <MatchStatus lead={matchState.currentLead} />
    </div>
  )
}
