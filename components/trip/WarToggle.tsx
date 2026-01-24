'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toggleWarModeAction } from '@/lib/supabase/war-actions'

interface WarToggleProps {
  tripId: string
  enabled: boolean
  className?: string
}

export function WarToggle({ tripId, enabled: initialEnabled, className }: WarToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    const newValue = !enabled

    const result = await toggleWarModeAction(tripId, newValue)

    if (result.success) {
      setEnabled(newValue)
    }
    setLoading(false)
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bad/10 text-bad">
          <SwordsIcon />
        </div>
        <div>
          <p className="font-medium text-text-0">War Mode</p>
          <p className="text-xs text-text-2">
            {enabled ? 'Team totals tracking enabled' : 'Track team vs team totals'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-0',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          enabled ? 'bg-bad' : 'bg-bg-2 border border-stroke'
        )}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform',
            'absolute top-1',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  )
}

function SwordsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5l-2.89 2.89a1.5 1.5 0 01-2.122 0l-1.268-1.268a1.5 1.5 0 00-2.122 0L10.132 17.39a1.5 1.5 0 01-2.122 0L5.12 14.5" />
    </svg>
  )
}
