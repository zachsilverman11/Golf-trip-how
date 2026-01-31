'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CompetitionHeroCardProps {
  tripId: string
  competitionName: string
  teamAPoints: number
  teamBPoints: number
  totalRounds: number
  className?: string
}

export function CompetitionHeroCard({
  tripId,
  competitionName,
  teamAPoints,
  teamBPoints,
  totalRounds,
  className,
}: CompetitionHeroCardProps) {
  const teamALeading = teamAPoints > teamBPoints
  const teamBLeading = teamBPoints > teamAPoints
  const tied = teamAPoints === teamBPoints
  const diff = Math.abs(teamAPoints - teamBPoints)
  const isClose = diff <= 1 && !tied

  return (
    <div
      className={cn(
        'rounded-card border-2 p-5 bg-bg-1',
        tied ? 'border-gold' : isClose ? 'border-gold' : 'border-accent',
        className
      )}
    >
      {/* Competition Name */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-lg">🏆</span>
          <h2 className="font-display text-xl font-bold text-text-0">
            {competitionName}
          </h2>
        </div>
        <p className="text-xs text-text-2">
          {totalRounds} round{totalRounds !== 1 ? 's' : ''} played
        </p>
      </div>

      {/* Score Display */}
      <div className="flex items-center justify-center gap-6 mb-3">
        {/* Team A */}
        <div className="text-center flex-1">
          <p className={cn(
            'text-sm font-medium mb-1',
            teamALeading ? 'text-good' : 'text-text-2'
          )}>
            Team A
          </p>
          <p className={cn(
            'font-display text-4xl font-bold',
            teamALeading ? 'text-good' : 'text-text-0'
          )}>
            {teamAPoints % 1 === 0 ? teamAPoints : teamAPoints.toFixed(1)}
          </p>
        </div>

        {/* Divider */}
        <div className="text-2xl text-text-2 font-light">—</div>

        {/* Team B */}
        <div className="text-center flex-1">
          <p className={cn(
            'text-sm font-medium mb-1',
            teamBLeading ? 'text-bad' : 'text-text-2'
          )}>
            Team B
          </p>
          <p className={cn(
            'font-display text-4xl font-bold',
            teamBLeading ? 'text-bad' : 'text-text-0'
          )}>
            {teamBPoints % 1 === 0 ? teamBPoints : teamBPoints.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        {tied && teamAPoints > 0 ? (
          <span className="text-sm font-display font-bold text-gold uppercase tracking-wide">
            All Square
          </span>
        ) : tied && teamAPoints === 0 ? (
          <span className="text-xs text-text-2">
            No results yet
          </span>
        ) : (
          <span className="text-sm text-text-2">
            Team{' '}
            <span className={teamALeading ? 'text-good font-medium' : 'text-bad font-medium'}>
              {teamALeading ? 'A' : 'B'}
            </span>
            {' '}leads by{' '}
            <span className="text-text-0 font-medium">
              {diff % 1 === 0 ? diff : diff.toFixed(1)}
            </span>
          </span>
        )}
      </div>

      {/* View details link */}
      <div className="mt-3 text-center">
        <Link
          href={`/trip/${tripId}/settle`}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          View details →
        </Link>
      </div>
    </div>
  )
}
