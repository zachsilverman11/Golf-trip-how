'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import type { WarTotals } from '@/lib/supabase/war-actions'

interface WarTotalsCardProps {
  totals: WarTotals
  className?: string
}

export function WarTotalsCard({ totals, className }: WarTotalsCardProps) {
  const teamALeading = totals.teamA.points > totals.teamB.points
  const teamBLeading = totals.teamB.points > totals.teamA.points
  const tied = totals.teamA.points === totals.teamB.points

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bad/10 text-bad">
          <SwordsIcon />
        </div>
        <h2 className="font-display text-lg font-bold text-text-0">
          War Totals
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div
          className={cn(
            'rounded-lg p-4 text-center',
            teamALeading ? 'bg-good/10 border border-good/30' : 'bg-bg-2'
          )}
        >
          <div className="text-sm font-medium text-good mb-1">Team A</div>
          <div className={cn(
            'text-3xl font-display font-bold',
            teamALeading ? 'text-good' : 'text-text-0'
          )}>
            {totals.teamA.points}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {totals.teamA.wins}W - {totals.teamA.losses}L
            {totals.teamA.ties > 0 && ` - ${totals.teamA.ties}T`}
          </div>
        </div>

        {/* Team B */}
        <div
          className={cn(
            'rounded-lg p-4 text-center',
            teamBLeading ? 'bg-bad/10 border border-bad/30' : 'bg-bg-2'
          )}
        >
          <div className="text-sm font-medium text-bad mb-1">Team B</div>
          <div className={cn(
            'text-3xl font-display font-bold',
            teamBLeading ? 'text-bad' : 'text-text-0'
          )}>
            {totals.teamB.points}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {totals.teamB.wins}W - {totals.teamB.losses}L
            {totals.teamB.ties > 0 && ` - ${totals.teamB.ties}T`}
          </div>
        </div>
      </div>

      {tied && totals.teamA.points > 0 && (
        <div className="mt-3 text-center text-sm text-text-2">
          All square
        </div>
      )}

      {!tied && (
        <div className="mt-3 text-center text-sm">
          <span className={teamALeading ? 'text-good' : 'text-bad'}>
            Team {teamALeading ? 'A' : 'B'}
          </span>
          <span className="text-text-2"> leads by </span>
          <span className="text-text-0 font-medium">
            {Math.abs(totals.teamA.points - totals.teamB.points)}
          </span>
        </div>
      )}
    </Card>
  )
}

function SwordsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5l-2.89 2.89a1.5 1.5 0 01-2.122 0l-1.268-1.268a1.5 1.5 0 00-2.122 0L10.132 17.39a1.5 1.5 0 01-2.122 0L5.12 14.5" />
    </svg>
  )
}
