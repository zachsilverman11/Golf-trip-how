'use client'

import { cn } from '@/lib/utils'
import { ScoreDelta } from '@/components/ui/ScoreDelta'

interface PlayerScoreRowProps {
  name: string
  score: number | null
  par: number
  strokes: number // Handicap strokes this hole
  totalGross: number
  totalNet: number
  isSelected?: boolean
  onClick?: () => void
  className?: string
}

export function PlayerScoreRow({
  name,
  score,
  par,
  strokes,
  totalGross,
  totalNet,
  isSelected = false,
  onClick,
  className,
}: PlayerScoreRowProps) {
  // Calculate delta from par for this hole (if score exists)
  const holeDelta = score !== null ? score - par : null

  // Render stroke dots (handicap strokes on this hole)
  const strokeDots = Array.from({ length: Math.min(strokes, 3) }, (_, i) => (
    <span
      key={i}
      className="inline-block h-2 w-2 rounded-full bg-accent"
    />
  ))

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-card-sm border p-4 text-left transition-all duration-tap',
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-stroke bg-bg-1 hover:border-accent/50',
        className
      )}
    >
      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-text-0 truncate">{name}</span>
          {strokes > 0 && (
            <span className="flex items-center gap-0.5">
              {strokeDots}
              {strokes > 3 && (
                <span className="text-xs text-accent">+{strokes - 3}</span>
              )}
            </span>
          )}
        </div>
        <div className="text-xs text-text-2">
          Gross: {totalGross} | Net: {totalNet}
        </div>
      </div>

      {/* Score display */}
      <div className="flex items-center gap-3">
        {holeDelta !== null && (
          <ScoreDelta value={holeDelta} size="sm" />
        )}
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-card-sm font-display text-2xl font-bold',
            score !== null
              ? 'bg-bg-2 text-text-0'
              : 'border-2 border-dashed border-stroke text-text-2'
          )}
        >
          {score ?? '-'}
        </div>
      </div>
    </button>
  )
}
