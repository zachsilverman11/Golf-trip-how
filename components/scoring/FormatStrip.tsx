'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { FormatState } from '@/lib/format-types'

interface FormatStripProps {
  formatState: FormatState
  currentHole: number
  tripId: string
  roundId: string
  className?: string
}

/**
 * Live status strip for Points Hi/Lo and Stableford formats
 * Follows hole-centric UX: shows what this hole is worth + running totals
 */
export function FormatStrip({
  formatState,
  currentHole,
  tripId,
  roundId,
  className,
}: FormatStripProps) {
  const currentHoleResult = useMemo(() => {
    return formatState.holeResults.find(h => h.holeNumber === currentHole)
  }, [formatState.holeResults, currentHole])

  const isPointsHiLo = formatState.format === 'points_hilo'

  // Get player scores for current hole (Stableford only)
  const currentHolePlayerPoints = useMemo(() => {
    if (!currentHoleResult || formatState.format !== 'stableford') return null

    const team1Points = currentHoleResult.team1PlayerScores.map(p => ({
      name: p.playerName.split(' ')[0], // First name only
      points: p.stablefordPoints ?? null,
    }))

    const team2Points = currentHoleResult.team2PlayerScores.map(p => ({
      name: p.playerName.split(' ')[0],
      points: p.stablefordPoints ?? null,
    }))

    return { team1Points, team2Points }
  }, [currentHoleResult, formatState.format])

  return (
    <Link
      href={`/trip/${tripId}/round/${roundId}`}
      className={cn(
        'block bg-bg-1 border border-stroke rounded-card p-4',
        'hover:border-accent/50 transition-colors',
        className
      )}
    >
      {/* Hero: What this hole is worth */}
      <div className="text-center mb-3">
        <div className="text-text-2 text-xs uppercase tracking-wider mb-1">
          Hole {currentHole} {currentHoleResult?.par ? `(Par ${currentHoleResult.par})` : ''}
        </div>

        {isPointsHiLo ? (
          <div className="font-display text-lg font-bold text-accent">
            2 pts: Low 1 / High 1
            <span className="block text-xs font-normal text-text-2 mt-0.5">
              Ties split 0.5 each
            </span>
          </div>
        ) : (
          <div className="font-display text-lg font-bold text-accent">
            Team Stableford
            <span className="block text-xs font-normal text-text-2 mt-0.5">
              Par=1 / Birdie=3 / Eagle=5
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Team totals */}
      <div className="flex items-center justify-center gap-6">
        <TeamScore
          label="Team 1"
          players={formatState.team1.players.map(p => p.name.split(' ')[0]).join(' & ')}
          total={formatState.team1Total}
          variant="team1"
        />

        <div className="text-text-2 font-medium">vs</div>

        <TeamScore
          label="Team 2"
          players={formatState.team2.players.map(p => p.name.split(' ')[0]).join(' & ')}
          total={formatState.team2Total}
          variant="team2"
        />
      </div>

      {/* Current hole player points (Stableford only) */}
      {currentHolePlayerPoints && currentHoleResult?.complete && (
        <>
          <div className="border-t border-stroke/50 my-3" />
          <div className="text-center text-xs text-text-2">
            <span className="text-text-1">This hole: </span>
            {currentHolePlayerPoints.team1Points.map((p, i) => (
              <span key={p.name}>
                {i > 0 && ', '}
                {p.name} {formatStablefordPoints(p.points)}
              </span>
            ))}
            <span className="mx-2">|</span>
            {currentHolePlayerPoints.team2Points.map((p, i) => (
              <span key={p.name}>
                {i > 0 && ', '}
                {p.name} {formatStablefordPoints(p.points)}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Progress indicator */}
      <div className="mt-3 text-center text-xs text-text-2">
        {formatState.holesPlayed} of 18 holes complete
      </div>
    </Link>
  )
}

function TeamScore({
  label,
  players,
  total,
  variant,
}: {
  label: string
  players: string
  total: number
  variant: 'team1' | 'team2'
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-text-2 mb-0.5">{players}</div>
      <div
        className={cn(
          'font-display text-2xl font-bold',
          variant === 'team1' ? 'text-good' : 'text-gold'
        )}
      >
        {total % 1 === 0 ? total : total.toFixed(1)}
      </div>
      <div className="text-xs text-text-2">pts</div>
    </div>
  )
}

function formatStablefordPoints(points: number | null): string {
  if (points === null) return '—'
  if (points > 0) return `+${points}`
  return String(points)
}

/**
 * Compact version for smaller spaces (e.g., above keypad)
 */
export function FormatStripCompact({
  formatState,
  currentHole,
  className,
}: Omit<FormatStripProps, 'tripId' | 'roundId'>) {
  const isPointsHiLo = formatState.format === 'points_hilo'

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span className="text-text-2">
        Hole {currentHole}:{' '}
        <span className="font-medium text-accent">
          {isPointsHiLo ? '2 pts available' : 'Stableford'}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <span className="text-good font-bold">{formatState.team1Total}</span>
        <span className="text-text-2">-</span>
        <span className="text-gold font-bold">{formatState.team2Total}</span>
      </div>
    </div>
  )
}
