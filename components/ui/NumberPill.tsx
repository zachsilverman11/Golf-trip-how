import { cn } from '@/lib/utils'

interface NumberPillProps {
  value: number | string
  variant?: 'neutral' | 'positive' | 'negative'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function NumberPill({
  value,
  variant = 'neutral',
  size = 'md',
  className,
}: NumberPillProps) {
  const variants = {
    neutral: 'bg-bg-2 text-text-0',
    positive: 'bg-good/20 text-good',
    negative: 'bg-bad/20 text-bad',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-3 py-1 text-score',
    lg: 'px-4 py-2 text-score-lg',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-display font-bold tabular-nums',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {value}
    </span>
  )
}
