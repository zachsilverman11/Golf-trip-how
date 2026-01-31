'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import type { WarTotals } from '@/lib/supabase/war-actions'

interface WarTotalsCardProps {
  totals: WarTotals
  className?: string
}

export function WarTotalsCard({ totals, className }: WarTotalsCardProps) {
  const [showRounds, setShowRounds] = useState(false)

  const teamALeading = totals.teamA.points > totals.teamB.points
  const teamBLeading = totals.teamB.points > totals.teamA.points
  const tied = totals.teamA.points === totals.teamB.points
  const diff = Math.abs(totals.teamA.points - totals.teamB.points)
  const isClose = diff <= 1 && !tied

  const formatPoints = (pts: number) =>
    pts % 1 === 0 ? pts.toString() : pts.toFixed(1)

  return (
    <Card
      className={cn(
        'p-5 border-2',
        tied ? 'border-gold' : isClose ? 'border-gold' : 'border-accent',
        className
      )}
    >
      {/* Competition Name Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-lg">🏆</span>
          <h2 className="font-display text-xl font-bold text-text-0">
            {totals.competitionName}
          </h2>
        </div>
      </div>

      {/* Hero Score */}
      <div className="flex items-center justify-center gap-6 mb-4">
        {/* Team A */}
        <div className="text-center flex-1">
          <div className={cn(
            'text-sm font-medium mb-1',
            teamALeading ? 'text-good' : 'text-text-2'
          )}>
            Team A
          </div>
          <div className={cn(
            'font-display text-4xl font-bold',
            teamALeading ? 'text-good' : 'text-text-0'
          )}>
            {formatPoints(totals.teamA.points)}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {totals.teamA.wins}W - {totals.teamA.losses}L
            {totals.teamA.ties > 0 && ` - ${totals.teamA.ties}T`}
          </div>
        </div>

        {/* Divider */}
        <div className="text-2xl text-text-2 font-light">—</div>

        {/* Team B */}
        <div className="text-center flex-1">
          <div className={cn(
            'text-sm font-medium mb-1',
            teamBLeading ? 'text-bad' : 'text-text-2'
          )}>
            Team B
          </div>
          <div className={cn(
            'font-display text-4xl font-bold',
            teamBLeading ? 'text-bad' : 'text-text-0'
          )}>
            {formatPoints(totals.teamB.points)}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {totals.teamB.wins}W - {totals.teamB.losses}L
            {totals.teamB.ties > 0 && ` - ${totals.teamB.ties}T`}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center mb-3">
        {tied && totals.teamA.points > 0 ? (
          <span className="text-sm font-display font-bold text-gold uppercase tracking-wide">
            All Square
          </span>
        ) : !tied ? (
          <span className="text-sm text-text-2">
            Team{' '}
            <span className={teamALeading ? 'text-good font-medium' : 'text-bad font-medium'}>
              {teamALeading ? 'A' : 'B'}
            </span>
            {' '}leads by{' '}
            <span className="text-text-0 font-medium">
              {formatPoints(diff)}
            </span>
          </span>
        ) : null}
      </div>

      {/* Per-Round Breakdown (expandable) */}
      {totals.rounds.length > 0 && (
        <div>
          <button
            onClick={() => setShowRounds(!showRounds)}
            className="w-full flex items-center justify-center gap-1 text-xs text-text-2 hover:text-text-1 transition-colors py-1"
          >
            {showRounds ? 'Hide' : 'Show'} round breakdown
            <ChevronIcon open={showRounds} />
          </button>

          {showRounds && (
            <div className="mt-2 space-y-1.5">
              {totals.rounds.map((round, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-bg-2 rounded-lg px-3 py-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-text-1 font-medium">{round.roundName}</span>
                    <span className="text-text-2 ml-1.5">({round.roundFormat})</span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={cn(
                      'font-bold',
                      round.teamAPoints > round.teamBPoints ? 'text-good' : 'text-text-1'
                    )}>
                      {formatPoints(round.teamAPoints)}
                    </span>
                    <span className="text-text-2">-</span>
                    <span className={cn(
                      'font-bold',
                      round.teamBPoints > round.teamAPoints ? 'text-bad' : 'text-text-1'
                    )}>
                      {formatPoints(round.teamBPoints)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}
