import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'default' | 'live' | 'press' | 'positive' | 'negative' | 'gold'
  children: React.ReactNode
  className?: string
}

export function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps) {
  // High-priority badges (LIVE, PRESS) get more prominent styling
  const variants = {
    default: 'bg-bg-2 text-text-2 font-medium',
    live: 'bg-bad text-bg-0 font-bold animate-pulse',
    press: 'bg-accent text-bg-0 font-bold',
    positive: 'bg-good/15 text-good/80 font-medium',
    negative: 'bg-bad/15 text-bad/80 font-medium',
    gold: 'bg-gold/15 text-gold/80 font-medium',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
