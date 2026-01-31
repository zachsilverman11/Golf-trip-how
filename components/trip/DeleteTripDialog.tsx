'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTripAction } from '@/lib/supabase/trip-actions'
import { Button } from '@/components/ui/Button'

interface DeleteTripDialogProps {
  tripId: string
  tripName: string
  onClose: () => void
}

export function DeleteTripDialog({ tripId, tripName, onClose }: DeleteTripDialogProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    const result = await deleteTripAction(tripId)

    if (result.success) {
      router.refresh()
      onClose()
    } else {
      setError(result.error || 'Failed to delete trip')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-t-card sm:rounded-card border border-stroke bg-bg-1 p-6 shadow-xl shadow-black/40">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bad/15">
          <svg className="h-6 w-6 text-bad" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h2 className="font-display text-xl font-bold text-text-0 mb-2">
          Delete Trip?
        </h2>
        <p className="text-sm text-text-2 mb-1">
          Are you sure you want to delete <span className="font-medium text-text-1">{tripName}</span>?
        </p>
        <p className="text-sm text-text-2 mb-6">
          This will remove all rounds, scores, and data. This cannot be undone.
        </p>

        {error && (
          <div className="mb-4 rounded-card-sm bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={deleting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={deleting}
            className="flex-1"
          >
            Delete Trip
          </Button>
        </div>
      </div>
    </div>
  )
}
