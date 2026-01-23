import { cn } from '@/lib/utils'
import { Badge } from './Badge'
import { ScoreDelta } from './ScoreDelta'

interface LeaderboardRowProps {
  rank: number
  name: string
  score: number
  delta?: number
  thru?: number | string
  isCurrentUser?: boolean
  badges?: Array<{
    text: string
    variant: 'default' | 'live' | 'press' | 'positive' | 'negative' | 'gold'
  }>
  className?: string
}

export function LeaderboardRow({
  rank,
  name,
  score,
  delta,
  thru,
  isCurrentUser = false,
  badges = [],
  className,
}: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        'flex min-h-row items-center gap-3 border-b border-stroke/60 px-4 py-2.5 transition-colors duration-state',
        isCurrentUser && 'bg-accent/10',
        className
      )}
    >
      {/* Rank */}
      <span className="w-8 font-display text-lg font-bold tabular-nums text-text-2">
        {rank}
      </span>

      {/* Name and badges */}
      <div className="flex flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'text-body font-medium',
            isCurrentUser ? 'text-accent' : 'text-text-0'
          )}
        >
          {name}
        </span>
        {badges.length > 0 && (
          <div className="flex gap-1.5">
            {badges.map((badge, idx) => (
              <Badge key={idx} variant={badge.variant}>
                {badge.text}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Thru */}
      {thru !== undefined && (
        <span className="text-xs text-text-2/70">
          {typeof thru === 'number' ? `Thru ${thru}` : thru}
        </span>
      )}

      {/* Delta */}
      {delta !== undefined && <ScoreDelta value={delta} size="sm" />}

      {/* Score */}
      <span className="min-w-[3.5rem] text-right font-display text-[2.25rem] font-bold tabular-nums text-text-0">
        {score}
      </span>
    </div>
  )
}
