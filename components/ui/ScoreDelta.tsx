import { cn } from '@/lib/utils'

interface ScoreDeltaProps {
  value: number
  size?: 'sm' | 'md'
  className?: string
}

export function ScoreDelta({ value, size = 'md', className }: ScoreDeltaProps) {
  const isPositive = value > 0
  const isNegative = value < 0
  const isEven = value === 0

  // Small size is more muted for secondary display in leaderboards
  const colorClass =
    size === 'sm'
      ? isPositive
        ? 'text-bad/70'
        : isNegative
          ? 'text-good/70'
          : 'text-text-2'
      : isPositive
        ? 'text-bad'
        : isNegative
          ? 'text-good'
          : 'text-text-1'

  const sizes = {
    sm: 'text-xs font-semibold',
    md: 'text-lg font-bold',
  }

  const displayValue = isEven ? 'E' : isPositive ? `+${value}` : value.toString()

  return (
    <span
      className={cn(
        'font-display tabular-nums',
        colorClass,
        sizes[size],
        className
      )}
    >
      {displayValue}
    </span>
  )
}
