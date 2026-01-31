'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MatchStatus, PressStatus } from './MatchStatus'
import { PressButton } from './PressButton'
import { formatMoney, calculateExposure } from '@/lib/match-utils'
import type { MatchState } from '@/lib/supabase/match-types'

interface Narrative {
  text: string
  intensity: string // 'high' | 'medium' | 'low'
}

interface MatchStripProps {
  matchState: MatchState
  currentHole: number
  tripId: string
  roundId: string
  narratives?: Narrative[]
  onPressAdded?: () => void
  className?: string
}

/**
 * Hero strip for scoring screen showing:
 * - "This hole: $X on the line" (hero element)
 * - Main match + press statuses with origin holes
 * - Expandable breakdown showing stake components
 * - Total exposure
 * - One-tap press button
 *
 * Tap the strip to expand/collapse the breakdown.
 * Navigation to match details via the "View Details" link.
 */
/**
 * Get first name from a full name string
 */
function firstName(name: string): string {
  return name.split(' ')[0]
}

/**
 * Format team display names (first names only)
 * e.g., "Zach & Dave" or just "Zach" for 1v1
 */
function formatTeamFirstNames(team: { player1: { name: string }; player2: { name: string } | null }): string {
  if (team.player2) {
    return `${firstName(team.player1.name)} & ${firstName(team.player2.name)}`
  }
  return firstName(team.player1.name)
}

export function MatchStrip({
  matchState,
  currentHole,
  tripId,
  roundId,
  narratives,
  onPressAdded,
  className,
}: MatchStripProps) {
  const [expanded, setExpanded] = useState(false)

  // Calculate what's at stake for this hole (per man)
  const { holeStakePerMan, breakdown } = useMemo(() => {
    if (matchState.isMatchClosed) {
      return { holeStakePerMan: 0, breakdown: [] }
    }

    const items: { label: string; amount: number }[] = []

    // Main match stake per man
    items.push({
      label: 'Main Match',
      amount: matchState.stakePerMan,
    })

    let total = matchState.stakePerMan

    // Add active press stakes (each press also has stake_per_man)
    for (const press of matchState.presses) {
      if (press.startingHole <= currentHole && press.status === 'in_progress') {
        items.push({
          label: `Press ${press.pressNumber} (from ${press.startingHole})`,
          amount: press.stakePerMan,
        })
        total += press.stakePerMan
      }
    }

    return { holeStakePerMan: total, breakdown: items }
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

  const handleToggle = (e: React.MouseEvent) => {
    // Don't toggle if clicking the press button or link
    if ((e.target as HTMLElement).closest('button, a')) {
      return
    }
    setExpanded(!expanded)
  }

  return (
    <div
      onClick={handleToggle}
      className={cn(
        'bg-bg-1 border border-stroke rounded-card p-4 cursor-pointer',
        'hover:border-accent/50 transition-colors',
        className
      )}
    >
      {/* Match context bar — teams, lead, dormie */}
      {!matchState.isMatchClosed && (
        <div className="mb-3 pb-3 border-b border-stroke/50">
          {/* Team names */}
          <div className="flex items-center justify-between text-xs text-text-2 mb-2">
            <span>{formatTeamFirstNames(matchState.teamA)}</span>
            <span>vs</span>
            <span>{formatTeamFirstNames(matchState.teamB)}</span>
          </div>

          {/* Lead status hero + holes remaining */}
          <div className="flex items-center justify-center gap-3">
            {matchState.currentLead === 0 ? (
              <span className="font-display text-xl font-bold text-text-1">A/S</span>
            ) : (
              <span
                className={cn(
                  'font-display text-xl font-bold',
                  matchState.currentLead > 0 ? 'text-good' : 'text-bad'
                )}
              >
                {Math.abs(matchState.currentLead)} {matchState.currentLead > 0 ? 'UP' : 'DN'}
              </span>
            )}
            <span className="text-text-2 text-sm">
              {matchState.holesRemaining} to play
            </span>
          </div>

          {/* Dormie badge */}
          {matchState.isDormie && (
            <div className="flex justify-center mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full border animate-pulse bg-gold/20 text-gold border-gold/40 text-xs font-bold uppercase tracking-wider">
                Dormie
              </span>
            </div>
          )}

          {/* Match closing context */}
          {matchState.currentLead !== 0 &&
            Math.abs(matchState.currentLead) === matchState.holesRemaining && (
              <div className="text-center mt-2">
                <span className="text-gold text-xs font-medium">
                  This hole could close it
                </span>
              </div>
            )}
        </div>
      )}

      {/* Hero: This hole value per man */}
      <div className="text-center mb-3">
        <div className="text-text-2 text-xs uppercase tracking-wider mb-1">
          This Hole
        </div>
        <div className="font-display text-2xl font-bold text-accent">
          {formatMoney(holeStakePerMan)} per man
        </div>
        {/* Expand hint */}
        {breakdown.length > 1 && (
          <div className="text-xs text-text-2 mt-1">
            {expanded ? 'tap to collapse' : 'tap for breakdown'}
          </div>
        )}
      </div>

      {/* Expandable breakdown */}
      {expanded && breakdown.length > 0 && (
        <div className="bg-bg-2 rounded-card-sm p-3 mb-3">
          <div className="space-y-1.5">
            {breakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-text-2">{item.label}</span>
                <span className="font-medium text-text-1">{formatMoney(item.amount)}</span>
              </div>
            ))}
            <div className="border-t border-stroke/50 pt-1.5 mt-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-text-0">Total per man</span>
              <span className="font-bold text-accent">{formatMoney(holeStakePerMan)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main match status */}
          <MatchStatus lead={matchState.currentLead} label="Main" dormie={matchState.isDormie} />

          {/* Press statuses with origin hole */}
          {activePresses.map((press) => (
            <PressStatus
              key={press.id}
              pressNumber={press.pressNumber}
              lead={press.currentLead}
              startingHole={press.startingHole}
            />
          ))}
        </div>

        {/* Press button */}
        {canAddPress && (
          <PressButton
            matchId={matchState.matchId}
            currentHole={currentHole}
            matchLead={matchState.currentLead}
            holesRemaining={matchState.holesRemaining}
            onPressAdded={onPressAdded}
          />
        )}
      </div>

      {/* Narrative slot */}
      {narratives && narratives.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {narratives.slice(0, 2).map((narrative, idx) => (
            <p
              key={idx}
              className={cn(
                'text-xs italic',
                narrative.intensity === 'high' && 'text-gold',
                narrative.intensity === 'medium' && 'text-text-1',
                (narrative.intensity === 'low' || (narrative.intensity !== 'high' && narrative.intensity !== 'medium')) && 'text-text-2'
              )}
            >
              {narrative.text}
            </p>
          ))}
        </div>
      )}

      {/* Total exposure (per man) */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-text-2">
          Exposure: <span className="font-medium text-text-1">{formatMoney(exposure.totalExposure)}/man</span>
          {exposure.currentPosition !== 0 && (
            <span className={cn(
              'ml-2',
              exposure.currentPosition > 0 ? 'text-good' : 'text-bad'
            )}>
              ({exposure.currentPosition > 0 ? '+' : ''}{formatMoney(exposure.currentPosition)})
            </span>
          )}
        </span>
        <Link
          href={`/trip/${tripId}/round/${roundId}/match`}
          className="text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View Details →
        </Link>
      </div>

      {/* Match closed indicator */}
      {matchState.isMatchClosed && (
        <div className="mt-2 text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gold/15 text-gold text-xs font-medium">
            Match Complete: {matchState.finalResult}
          </span>
        </div>
      )}
    </div>
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
