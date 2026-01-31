'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { toggleWarModeAction, updateCompetitionNameAction } from '@/lib/supabase/war-actions'

interface TeamCompetitionToggleProps {
  tripId: string
  enabled: boolean
  competitionName: string
  className?: string
}

export function TeamCompetitionToggle({
  tripId,
  enabled: initialEnabled,
  competitionName: initialName,
  className,
}: TeamCompetitionToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(initialName || 'The Cup')
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleToggle = async () => {
    setLoading(true)
    const newValue = !enabled

    const result = await toggleWarModeAction(tripId, newValue)

    if (result.success) {
      setEnabled(newValue)
    }
    setLoading(false)
  }

  const handleNameBlur = async () => {
    const trimmedName = name.trim() || 'The Cup'
    if (trimmedName === initialName) return

    setSavingName(true)
    await updateCompetitionNameAction(tripId, trimmedName)
    setSavingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      nameInputRef.current?.blur()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
            <TrophyIcon />
          </div>
          <div>
            <p className="font-medium text-text-0">Team Competition</p>
            <p className="text-xs text-text-2">
              {enabled
                ? `${name} — Team totals tracking`
                : 'Track team vs team totals'}
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
            enabled ? 'bg-gold' : 'bg-bg-2 border border-stroke'
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

      {/* Competition name input (shown when enabled) */}
      {enabled && (
        <div className="ml-[52px]">
          <label className="text-xs text-text-2 mb-1 block">Competition Name</label>
          <div className="relative">
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              placeholder="The Cup"
              className={cn(
                'w-full rounded-lg border border-stroke bg-bg-1 px-3 py-2 text-sm text-text-0',
                'placeholder:text-text-2',
                'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold',
                savingName && 'opacity-70'
              )}
              maxLength={50}
            />
            {savingName && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-2">
                Saving...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TrophyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.98 6.98 0 01-4.27 1.522 6.98 6.98 0 01-4.27-1.522" />
    </svg>
  )
}
