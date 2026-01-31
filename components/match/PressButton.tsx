'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { addPressAction } from '@/lib/supabase/match-actions'

interface PressOption {
  label: string
  endingHole: number
  short: string
}

interface PressButtonProps {
  matchId: string
  currentHole: number
  disabled?: boolean
  matchLead?: number // Current match lead (negative = team is down)
  holesRemaining?: number // Holes left to play
  onPressAdded?: () => void
  className?: string
}

/**
 * Press button with type selection:
 * - Holes 1-8: Two options — "Front 9 (→9)" and "Match (→18)"
 * - Holes 9-17: Single option — "Press (→18)" (fires directly, no popup)
 * - Hole 18: Don't render (match is ending)
 *
 * When the team is down, the button becomes more prominent.
 * If only one option, fires directly. If two, shows a dropdown above.
 */
export function PressButton({
  matchId,
  currentHole,
  disabled,
  matchLead,
  holesRemaining,
  onPressAdded,
  className,
}: PressButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showOptions) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowOptions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOptions])

  const pressOptions = useMemo((): PressOption[] => {
    // Holes 1-9 (front 9): two options — press front or press match
    if (currentHole <= 9) {
      return [
        { label: 'Front 9', endingHole: 9, short: '→9' },
        { label: 'Match', endingHole: 18, short: '→18' },
      ]
    }
    // Holes 10-18 (back 9): single option — press match (ends 18)
    return [{ label: 'Press', endingHole: 18, short: '→18' }]
  }, [currentHole])

  const firePress = useCallback(
    async (endingHole: number, label: string) => {
      if (isLoading || disabled) return

      setIsLoading(true)
      setShowOptions(false)

      try {
        const result = await addPressAction({
          matchId,
          startingHole: currentHole,
          endingHole,
        })

        if (result.success) {
          setToastMessage(
            `${label} press from hole ${currentHole}${endingHole < 18 ? ` →${endingHole}` : ''}`
          )
          setShowToast(true)
          setTimeout(() => setShowToast(false), 2000)
          onPressAdded?.()
        } else {
          setToastMessage(result.error || 'Failed to add press')
          setShowToast(true)
          setTimeout(() => setShowToast(false), 3000)
        }
      } catch {
        setToastMessage('Failed to add press')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      } finally {
        setIsLoading(false)
      }
    },
    [matchId, currentHole, isLoading, disabled, onPressAdded]
  )

  const handleButtonClick = useCallback(() => {
    if (isLoading || disabled) return

    if (pressOptions.length === 1) {
      // Single option: fire directly
      firePress(pressOptions[0].endingHole, pressOptions[0].label)
    } else if (pressOptions.length > 1) {
      // Multiple options: toggle dropdown
      setShowOptions((prev) => !prev)
    }
  }, [pressOptions, isLoading, disabled, firePress])

  // Don't render on hole 18 or if no options
  if (pressOptions.length === 0) return null

  const isDown = matchLead !== undefined && matchLead < 0
  const absLead = matchLead !== undefined ? Math.abs(matchLead) : 0

  return (
    <div className="relative flex flex-col items-center" ref={dropdownRef}>
      {/* Dropdown (appears ABOVE button) */}
      {showOptions && pressOptions.length > 1 && (
        <div
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'bg-bg-1 border border-stroke rounded-card-sm shadow-lg',
            'overflow-hidden z-50',
            'animate-in fade-in slide-in-from-bottom-2 duration-150'
          )}
        >
          {pressOptions.map((option) => (
            <button
              key={option.endingHole}
              onClick={() => firePress(option.endingHole, option.label)}
              disabled={isLoading}
              className={cn(
                'flex items-center justify-between gap-3 w-full',
                'px-4 py-3 min-h-[44px] min-w-[160px]',
                'text-sm font-medium text-text-1',
                'hover:bg-accent/10 active:bg-accent/20',
                'transition-colors duration-100',
                'border-b border-stroke/30 last:border-b-0',
                'disabled:opacity-50'
              )}
            >
              <span>{option.label}</span>
              <span className="text-accent font-bold text-xs">{option.short}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleButtonClick}
        disabled={isLoading || disabled}
        className={cn(
          'font-bold rounded-full',
          'bg-accent/20 text-accent border border-accent/40',
          'hover:bg-accent/30 active:scale-95',
          'transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isDown ? 'px-3 py-1.5 text-sm min-h-button' : 'px-2 py-1 text-xs',
          className
        )}
      >
        {isLoading ? '...' : isDown ? 'PRESS' : '+P'}
      </button>

      {/* Context line when down */}
      {isDown && holesRemaining !== undefined && (
        <span className="text-xs text-text-2 mt-0.5 whitespace-nowrap">
          {absLead} DN • {holesRemaining} to play
        </span>
      )}

      {/* Toast notification */}
      {showToast && (
        <div
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2',
            showOptions ? 'mb-24' : 'mb-2',
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
            'bg-bg-1 border border-stroke shadow-lg',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
            'z-50'
          )}
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}
