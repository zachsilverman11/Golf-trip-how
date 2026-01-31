'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTripAction } from '@/lib/supabase/trip-actions'
import { Button } from '@/components/ui/Button'

interface EditTripModalProps {
  tripId: string
  initialName: string
  initialDescription: string | null
  initialStartDate: string | null
  initialEndDate: string | null
  onClose: () => void
}

export function EditTripModal({
  tripId,
  initialName,
  initialDescription,
  initialStartDate,
  initialEndDate,
  onClose,
}: EditTripModalProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription || '')
  const [startDate, setStartDate] = useState(initialStartDate || '')
  const [endDate, setEndDate] = useState(initialEndDate || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) {
      setError('Trip name is required')
      return
    }

    setSaving(true)
    setError(null)

    const result = await updateTripAction(tripId, {
      name: name.trim(),
      description: description.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    })

    if (result.success) {
      router.refresh()
      onClose()
    } else {
      setError(result.error || 'Failed to update trip')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-card sm:rounded-card border border-stroke bg-bg-1 p-6 shadow-xl shadow-black/40 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-state">
        <h2 className="font-display text-xl font-bold text-text-0 mb-4">
          Edit Trip
        </h2>

        {error && (
          <div className="mb-4 rounded-card-sm bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-2">
              Trip Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-button border border-stroke bg-bg-2 px-3 py-2.5 text-text-0 placeholder:text-text-2/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              placeholder="e.g., Bandon 2025"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-button border border-stroke bg-bg-2 px-3 py-2.5 text-text-0 placeholder:text-text-2/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors resize-none"
              placeholder="Optional description..."
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-button border border-stroke bg-bg-2 px-3 py-2.5 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-button border border-stroke bg-bg-2 px-3 py-2.5 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            className="flex-1"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
