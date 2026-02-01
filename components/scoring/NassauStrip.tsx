'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { NassauState, NassauSubMatchState } from '@/lib/nassau-utils'
import { getNassauExposure } from '@/lib/nassau-utils'

interface NassauStripProps {
  nassauState: NassauState
  currentHole: number
  tripId: string
  roundId: string
  className?: string
}

/**
 * Live status strip for Nassau format on the scoring screen.
 * Shows all 3 sub-match statuses: Front, Back, Overall.
 */
export function NassauStrip({
  nassauState,
  currentHole,
  tripId,
  roundId,
  className,
}: NassauStripProps) {
  const { front, back, overall, stakePerMan, teams, autoPresses } = nassauState

  const exposure = useMemo(() => getNassauExposure(nassauState), [nassauState])

  const teamANames = teams.teamA.map(p => p.name.split(' ')[0]).join(' & ')
  const teamBNames = teams.teamB.map(p => p.name.split(' ')[0]).join(' & ')

  return (
    <Link
      href={`/trip/${tripId}/round/${roundId}`}
      className={cn(
        'block bg-bg-1 border border-stroke rounded-card p-4',
        'hover:border-accent/50 transition-colors',
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-3">
        <div className="text-text-2 text-xs uppercase tracking-wider mb-1">
          Nassau · ${stakePerMan}/man per bet
        </div>
        <div className="font-display text-sm font-medium text-text-1">
          {teamANames} <span className="text-text-2">vs</span> {teamBNames}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Three sub-match statuses */}
      <div className="grid grid-cols-3 gap-3">
        <SubMatchPill match={front} />
        <SubMatchPill match={back} />
        <SubMatchPill match={overall} />
      </div>

      {/* Auto-press indicators */}
      {autoPresses.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
          {autoPresses.map((press, idx) => (
            <Badge key={idx} variant="press">
              Press: {press.segment} from #{press.startingHole}
            </Badge>
          ))}
        </div>
      )}

      {/* Exposure + progress */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-2">
        <span>
          Exposure: <span className="font-medium text-text-1">${exposure}/man</span>
        </span>
        <span>{nassauState.holesPlayed} of 18 holes</span>
      </div>
    </Link>
  )
}

function SubMatchPill({ match }: { match: NassauSubMatchState }) {
  const isActive = match.holesRemaining > 0 && !match.isClosed
  const leadColor = match.lead > 0
    ? 'text-good'
    : match.lead < 0
      ? 'text-bad'
      : 'text-text-1'

  return (
    <div className={cn(
      'text-center rounded-card-sm border p-2',
      isActive ? 'border-stroke bg-bg-2' : 'border-stroke/50 bg-bg-2/50'
    )}>
      <div className="text-[10px] uppercase tracking-wider text-text-2 mb-1">
        {match.label}
      </div>
      <div className={cn('font-display text-lg font-bold', leadColor)}>
        {match.status}
      </div>
      {match.isClosed && (
        <div className="text-[10px] text-gold font-medium mt-0.5">Closed</div>
      )}
      {match.isHalved && (
        <div className="text-[10px] text-text-2 mt-0.5">Halved</div>
      )}
    </div>
  )
}

/**
 * Compact version for smaller spaces.
 */
export function NassauStripCompact({
  nassauState,
  className,
}: { nassauState: NassauState; className?: string }) {
  const { front, back, overall } = nassauState

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span className="text-text-2">
        Nassau: <span className="font-medium text-accent">${nassauState.stakePerMan}/bet</span>
      </span>
      <div className="flex items-center gap-3 text-xs">
        <SubMatchBadge label="F" status={front.status} lead={front.lead} />
        <SubMatchBadge label="B" status={back.status} lead={back.lead} />
        <SubMatchBadge label="O" status={overall.status} lead={overall.lead} />
      </div>
    </div>
  )
}

function SubMatchBadge({
  label,
  status,
  lead,
}: {
  label: string
  status: string
  lead: number
}) {
  return (
    <span className={cn(
      'font-bold',
      lead > 0 ? 'text-good' : lead < 0 ? 'text-bad' : 'text-text-1'
    )}>
      {label}: {status}
    </span>
  )
}
