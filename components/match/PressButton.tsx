'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { addPressAction } from '@/lib/supabase/match-actions'

interface PressButtonProps {
  matchId: string
  currentHole: number
  disabled?: boolean
  onPressAdded?: () => void
  className?: string
}

/**
 * One-tap press button with toast confirmation
 * No modal - just a quick tap to add a press
 */
export function PressButton({
  matchId,
  currentHole,
  disabled,
  onPressAdded,
  className,
}: PressButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const handlePress = useCallback(async () => {
    if (isLoading || disabled) return

    setIsLoading(true)

    try {
      const result = await addPressAction({
        matchId,
        startingHole: currentHole,
      })

      if (result.success) {
        setToastMessage(`Press added from hole ${currentHole}`)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 2000)
        onPressAdded?.()
      } else {
        setToastMessage(result.error || 'Failed to add press')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
    } catch (error) {
      setToastMessage('Failed to add press')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsLoading(false)
    }
  }, [matchId, currentHole, isLoading, disabled, onPressAdded])

  return (
    <div className="relative">
      <button
        onClick={handlePress}
        disabled={isLoading || disabled}
        className={cn(
          'px-2 py-1 text-xs font-bold rounded-full',
          'bg-accent/20 text-accent border border-accent/40',
          'hover:bg-accent/30 active:scale-95',
          'transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        {isLoading ? '...' : '+P'}
      </button>

      {/* Toast notification */}
      {showToast && (
        <div
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
            'bg-bg-1 border border-stroke shadow-lg',
            'animate-in fade-in slide-in-from-bottom-2 duration-200'
          )}
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}
