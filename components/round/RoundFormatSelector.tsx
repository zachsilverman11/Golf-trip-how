'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

export type RoundFormat = 'match_play' | 'points' | 'stableford'

interface FormatOption {
  value: RoundFormat
  label: string
  description: string
  status: 'available' | 'next' | 'soon'
}

const formatOptions: FormatOption[] = [
  {
    value: 'match_play',
    label: 'Match Play',
    description: 'Head-to-head by hole, perfect for money games',
    status: 'available',
  },
  {
    value: 'points',
    label: 'Points',
    description: 'Points per hole based on net score',
    status: 'next',
  },
  {
    value: 'stableford',
    label: 'Stableford',
    description: 'Classic points system: bogey=1, par=2, birdie=3',
    status: 'soon',
  },
]

interface RoundFormatSelectorProps {
  value: RoundFormat
  onChange: (value: RoundFormat) => void
  className?: string
}

export function RoundFormatSelector({
  value,
  onChange,
  className,
}: RoundFormatSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-text-1">
        Round Format
      </label>
      <div className="grid gap-2">
        {formatOptions.map((option) => {
          const isSelected = value === option.value
          const isDisabled = option.status !== 'available'

          return (
            <button
              key={option.value}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-start gap-3 rounded-card-sm border p-3 text-left transition-all',
                isSelected && !isDisabled
                  ? 'border-accent bg-accent/5'
                  : 'border-stroke bg-bg-2',
                isDisabled
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:border-accent/50'
              )}
            >
              {/* Radio indicator */}
              <div
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                  isSelected && !isDisabled
                    ? 'border-accent bg-accent'
                    : 'border-stroke'
                )}
              >
                {isSelected && !isDisabled && (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium',
                      isSelected && !isDisabled ? 'text-text-0' : 'text-text-1'
                    )}
                  >
                    {option.label}
                  </span>
                  {option.status === 'next' && (
                    <Badge variant="default" className="text-xs">
                      Next
                    </Badge>
                  )}
                  {option.status === 'soon' && (
                    <Badge variant="default" className="text-xs">
                      Soon
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-2">
                  {option.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
