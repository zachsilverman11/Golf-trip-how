'use client'

import { cn } from '@/lib/utils'

interface ScoringKeypadProps {
  onNumber: (num: number) => void
  onClear: () => void
  onBackspace: () => void
  className?: string
}

export function ScoringKeypad({
  onNumber,
  onClear,
  onBackspace,
  className,
}: ScoringKeypadProps) {
  const keys = [
    { label: '1', action: () => onNumber(1) },
    { label: '2', action: () => onNumber(2) },
    { label: '3', action: () => onNumber(3) },
    { label: '4', action: () => onNumber(4) },
    { label: '5', action: () => onNumber(5) },
    { label: '6', action: () => onNumber(6) },
    { label: '7', action: () => onNumber(7) },
    { label: '8', action: () => onNumber(8) },
    { label: '9', action: () => onNumber(9) },
    { label: 'C', action: onClear, variant: 'action' as const },
    { label: '0', action: () => onNumber(0) },
    { label: '←', action: onBackspace, variant: 'action' as const },
  ]

  return (
    <div className={cn('grid grid-cols-3 gap-1.5', className)}>
      {keys.map((key) => (
        <button
          key={key.label}
          onClick={(e) => {
            const el = e.currentTarget
            el.style.transform = 'scale(0.92)'
            setTimeout(() => { el.style.transform = '' }, 100)
            key.action()
          }}
          className={cn(
            'flex h-[46px] items-center justify-center rounded-lg font-display text-xl font-bold',
            'transition-all duration-100 select-none',
            'active:scale-[0.92] active:brightness-90',
            key.variant === 'action'
              ? 'bg-bg-2 text-text-2 hover:bg-stroke hover:text-text-1'
              : 'bg-bg-1 border border-stroke/50 text-text-0 hover:bg-bg-2'
          )}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}
