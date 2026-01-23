'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, Button } from '@/components/ui'

interface PasteHelperProps {
  onApply: (pars: number[], strokeIndexes: number[]) => void
  onClose: () => void
}

export function PasteHelper({ onApply, onClose }: PasteHelperProps) {
  const [parsInput, setParsInput] = useState('')
  const [strokeIndexInput, setStrokeIndexInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Parse input string into array of 18 numbers
  const parseInput = useCallback((input: string): number[] | null => {
    if (!input.trim()) return null

    // Split by comma, space, tab, or newline
    const parts = input
      .trim()
      .split(/[,\s\t\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10))

    // Check for NaN values
    if (parts.some((n) => isNaN(n))) {
      return null
    }

    return parts
  }, [])

  const handleApply = useCallback(() => {
    setError(null)

    const pars = parseInput(parsInput)
    const strokeIndexes = parseInput(strokeIndexInput)

    // Validate pars if provided
    if (pars) {
      if (pars.length !== 18) {
        setError(`Par values: expected 18, got ${pars.length}`)
        return
      }
      if (!pars.every((p) => p >= 3 && p <= 5)) {
        setError('Par values must be 3, 4, or 5')
        return
      }
    }

    // Validate stroke indexes if provided
    if (strokeIndexes) {
      if (strokeIndexes.length !== 18) {
        setError(`Stroke index values: expected 18, got ${strokeIndexes.length}`)
        return
      }
      if (!strokeIndexes.every((si) => si >= 1 && si <= 18)) {
        setError('Stroke index values must be 1-18')
        return
      }
      // Check for duplicates
      const unique = new Set(strokeIndexes)
      if (unique.size !== 18) {
        setError('Stroke index values must be unique (each 1-18 used once)')
        return
      }
    }

    // At least one must be provided
    if (!pars && !strokeIndexes) {
      setError('Enter at least one set of values')
      return
    }

    onApply(
      pars || Array(18).fill(0), // 0 means "keep existing"
      strokeIndexes || Array(18).fill(0)
    )
  }, [parsInput, strokeIndexInput, parseInput, onApply])

  return (
    <div className="fixed inset-0 bg-bg-0/90 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-text-0">
            Paste Scorecard
          </h3>
          <button
            onClick={onClose}
            className="text-text-2 hover:text-text-0 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-sm text-text-2 mb-4">
          Paste 18 values separated by commas, spaces, or newlines.
        </p>

        {/* Par Input */}
        <div className="mb-4">
          <label className="text-sm text-text-1 mb-1 block">
            Pars (holes 1-18)
          </label>
          <textarea
            value={parsInput}
            onChange={(e) => setParsInput(e.target.value)}
            placeholder="4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5"
            rows={2}
            className={cn(
              'w-full bg-bg-2 border border-stroke rounded-card-sm px-3 py-2',
              'text-sm text-text-0 placeholder:text-text-2',
              'focus:outline-none focus:border-accent',
              'resize-none'
            )}
          />
          <p className="text-xs text-text-2 mt-1">
            Leave empty to keep existing values
          </p>
        </div>

        {/* Stroke Index Input */}
        <div className="mb-4">
          <label className="text-sm text-text-1 mb-1 block">
            Stroke Indexes (holes 1-18)
          </label>
          <textarea
            value={strokeIndexInput}
            onChange={(e) => setStrokeIndexInput(e.target.value)}
            placeholder="7, 15, 3, 11, 1, 17, 9, 5, 13, 8, 16, 4, 12, 2, 18, 10, 6, 14"
            rows={2}
            className={cn(
              'w-full bg-bg-2 border border-stroke rounded-card-sm px-3 py-2',
              'text-sm text-text-0 placeholder:text-text-2',
              'focus:outline-none focus:border-accent',
              'resize-none'
            )}
          />
          <p className="text-xs text-text-2 mt-1">
            Each value 1-18, no duplicates. Leave empty to keep existing.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-card-sm bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply} className="flex-1">
            Apply
          </Button>
        </div>
      </Card>
    </div>
  )
}
