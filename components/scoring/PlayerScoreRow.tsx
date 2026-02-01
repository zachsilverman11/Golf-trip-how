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

  // Score color based on relation to par
  const getScoreBg = () => {
    if (score === null) return 'border-2 border-dashed border-stroke'
    if (holeDelta !== null) {
      if (holeDelta <= -2) return 'bg-good ring-2 ring-good/30 text-white' // Eagle or better
      if (holeDelta === -1) return 'bg-good/20 text-good' // Birdie
      if (holeDelta === 0) return 'bg-bg-2 text-text-0' // Par
      if (holeDelta === 1) return 'bg-bad/15 text-bad' // Bogey
      return 'bg-bad/25 text-bad' // Double+
    }
    return 'bg-bg-2 text-text-0'
  }

  // Render stroke dots (handicap strokes on this hole)
  const strokeDots = Array.from({ length: Math.min(strokes, 3) }, (_, i) => (
    <span
      key={i}
      className="inline-block h-[6px] w-[6px] rounded-full bg-accent"
    />
  ))

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 min-h-[60px]',
        isSelected
          ? 'border-accent bg-accent/10 shadow-sm shadow-accent/10'
          : 'border-stroke/60 bg-bg-1 active:bg-bg-2',
        className
      )}
    >
      {/* Player avatar initial */}
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        isSelected ? 'bg-accent text-bg-0' : 'bg-bg-2 text-text-2'
      )}>
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn(
            'font-medium truncate',
            isSelected ? 'text-text-0' : 'text-text-0'
          )}>
            {name}
          </span>
          {strokes > 0 && (
            <span className="flex items-center gap-[3px] shrink-0">
              {strokeDots}
              {strokes > 3 && (
                <span className="text-[10px] text-accent font-medium">+{strokes - 3}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-2">
          <span className="tabular-nums">G: {totalGross}</span>
          <span className="text-text-2/40">|</span>
          <span className="tabular-nums">N: {totalNet}</span>
        </div>
      </div>

      {/* Score display */}
      <div className="flex items-center gap-2.5 shrink-0">
        {holeDelta !== null && (
          <ScoreDelta value={holeDelta} size="sm" />
        )}
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl font-display text-2xl font-bold transition-all',
            getScoreBg()
          )}
        >
          {score ?? '–'}
        </div>
      </div>
    </button>
  )
}
