'use client'

import { cn } from '@/lib/utils'

interface CompetitionBadgeProps {
  competitionName: string
  className?: string
}

export function CompetitionBadge({ competitionName, className }: CompetitionBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg bg-gold/10 border border-gold/20 px-3 py-1.5',
        className
      )}
    >
      <span className="text-xs">🏆</span>
      <span className="text-xs text-gold font-medium">
        Counts toward {competitionName}
      </span>
    </div>
  )
}
