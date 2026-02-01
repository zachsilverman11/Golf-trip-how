'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import {
  JUNK_TYPES,
  DEFAULT_JUNK_CONFIG,
  type JunkType,
  type RoundJunkConfig,
  type JunkBetConfig,
} from '@/lib/junk-types'

// ============================================================================
// Types
// ============================================================================

interface JunkConfigFormProps {
  config: RoundJunkConfig
  onChange: (config: RoundJunkConfig) => void
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function JunkConfigForm({
  config,
  onChange,
  className,
}: JunkConfigFormProps) {
  const handleToggleEnabled = () => {
    onChange({
      ...config,
      enabled: !config.enabled,
    })
  }

  const handleToggleBet = (type: JunkType) => {
    onChange({
      ...config,
      bets: config.bets.map((bet) =>
        bet.type === type ? { ...bet, enabled: !bet.enabled } : bet
      ),
    })
  }

  const handleValueChange = (type: JunkType, value: number) => {
    onChange({
      ...config,
      bets: config.bets.map((bet) =>
        bet.type === type ? { ...bet, value } : bet
      ),
    })
  }

  return (
    <Card className={cn('p-4', config.enabled ? 'border-gold/30 bg-gold/5' : '', className)}>
      {/* Master toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={handleToggleEnabled}
          className="h-5 w-5 rounded border-stroke bg-bg-2 text-gold focus:ring-gold focus:ring-offset-bg-0"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text-0">Side Bets (Junk)</p>
            <span className="text-xs text-text-2 bg-bg-2 rounded-full px-2 py-0.5">Optional</span>
          </div>
          <p className="text-sm text-text-2">
            Greenies, sandies, barkies, and more
          </p>
        </div>
      </label>

      {/* Bet type configuration */}
      {config.enabled && (
        <div className="mt-4 space-y-2">
          {config.bets.map((bet) => {
            const info = JUNK_TYPES[bet.type]
            return (
              <div
                key={bet.type}
                className={cn(
                  'flex items-center gap-3 rounded-lg p-2.5 transition-colors',
                  bet.enabled ? 'bg-bg-2' : 'bg-bg-2/50 opacity-60'
                )}
              >
                {/* Toggle */}
                <input
                  type="checkbox"
                  checked={bet.enabled}
                  onChange={() => handleToggleBet(bet.type)}
                  className="h-4 w-4 rounded border-stroke bg-bg-1 text-gold focus:ring-gold"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>{info.emoji}</span>
                    <span className="font-medium text-text-0 text-sm">
                      {info.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-2 truncate">
                    {info.description}
                  </p>
                </div>

                {/* Value input */}
                {bet.enabled && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-2">$</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={bet.value}
                      onChange={(e) =>
                        handleValueChange(bet.type, parseInt(e.target.value, 10) || 1)
                      }
                      className="w-12 rounded border border-stroke bg-bg-1 px-1.5 py-1 text-center text-sm text-text-0 focus:border-gold focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
