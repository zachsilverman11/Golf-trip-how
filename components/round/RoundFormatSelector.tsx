'use client'

import { cn } from '@/lib/utils'

export type RoundFormat = 'stroke_play' | 'match_play' | 'points_hilo' | 'stableford' | 'scramble'

interface FormatOption {
  value: RoundFormat
  label: string
  description: string
}

const formatOptions: FormatOption[] = [
  {
    value: 'stroke_play',
    label: 'Stroke Play',
    description: 'Individual scoring, gross or net to par',
  },
  {
    value: 'match_play',
    label: 'Match Play',
    description: 'Head-to-head by hole, 1v1 or 2v2',
  },
  {
    value: 'points_hilo',
    label: 'Points (Hi/Lo)',
    description: '2 pts/hole: low vs low + high vs high (ties split)',
  },
  {
    value: 'stableford',
    label: 'Stableford',
    description: 'Team points: par=1, birdie=3, eagle=5',
  },
  {
    value: 'scramble',
    label: 'Scramble',
    description: 'Teams pick best shot each time. One score per team.',
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

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-start gap-3 rounded-card-sm border p-3 text-left transition-all',
                isSelected
                  ? 'border-accent bg-accent/5'
                  : 'border-stroke bg-bg-2 hover:border-accent/50'
              )}
            >
              {/* Radio indicator */}
              <div
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                  isSelected
                    ? 'border-accent bg-accent'
                    : 'border-stroke'
                )}
              >
                {isSelected && (
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
                      isSelected ? 'text-text-0' : 'text-text-1'
                    )}
                  >
                    {option.label}
                  </span>
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

/**
 * Check if format requires team assignments
 * Points Hi/Lo requires teams for v1
 * Scramble requires teams (2 teams, one score per team per hole)
 * Stableford works individually (team mode is optional/future)
 */
export function formatRequiresTeams(format: RoundFormat): boolean {
  return format === 'points_hilo' || format === 'scramble'
}
