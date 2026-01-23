'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface PlayerFormProps {
  initialName?: string
  initialHandicap?: number | null
  onSubmit: (name: string, handicap: number | null) => Promise<void>
  onCancel: () => void
  submitLabel?: string
  loading?: boolean
}

export function PlayerForm({
  initialName = '',
  initialHandicap = null,
  onSubmit,
  onCancel,
  submitLabel = 'Add Player',
  loading = false,
}: PlayerFormProps) {
  const [name, setName] = useState(initialName)
  const [handicap, setHandicap] = useState<string>(
    initialHandicap !== null ? String(initialHandicap) : ''
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const handicapValue = handicap.trim() ? parseFloat(handicap) : null
    await onSubmit(name.trim(), handicapValue)
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-text-1">
            Name <span className="text-bad">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            required
            autoFocus
            className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-text-1">
            Handicap Index
          </label>
          <input
            type="number"
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            placeholder="e.g., 12.4"
            step="0.1"
            min="-10"
            max="54"
            className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-2">
            Leave blank if unknown
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={!name.trim()}
            className="flex-1"
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  )
}

// Modal wrapper for PlayerForm
interface PlayerFormModalProps extends Omit<PlayerFormProps, 'onCancel'> {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export function PlayerFormModal({
  isOpen,
  onClose,
  title = 'Add Player',
  ...formProps
}: PlayerFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-text-0">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-text-2 hover:bg-bg-2 hover:text-text-1"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <PlayerForm {...formProps} onCancel={onClose} />
      </div>
    </div>
  )
}
