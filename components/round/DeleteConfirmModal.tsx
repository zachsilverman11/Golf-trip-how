'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { deleteRoundAction } from '@/lib/supabase/round-actions'

interface DeleteConfirmModalProps {
  roundId: string
  tripId: string
  roundName: string
  hasScores: boolean
  scoreCount: number
  onClose: () => void
}

export function DeleteConfirmModal({
  roundId,
  tripId,
  roundName,
  hasScores,
  scoreCount,
  onClose,
}: DeleteConfirmModalProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    const result = await deleteRoundAction(roundId, tripId)

    if (result.success) {
      router.push(`/trip/${tripId}`)
    } else {
      setError(result.error || 'Failed to delete round')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 font-display text-xl font-bold text-text-0">
          Delete Round
        </h2>

        <p className="mb-4 text-text-1">
          Are you sure you want to delete <span className="font-medium text-text-0">{roundName}</span>?
        </p>

        {hasScores && (
          <div className="mb-4 rounded-card-sm bg-bad/10 border border-bad/30 p-3">
            <p className="text-sm text-bad font-medium mb-1">
              Warning: This round has recorded scores
            </p>
            <p className="text-sm text-bad/80">
              {scoreCount} score{scoreCount !== 1 ? 's' : ''} will be permanently deleted.
              This action cannot be undone.
            </p>
          </div>
        )}

        {!hasScores && (
          <p className="mb-4 text-sm text-text-2">
            This action cannot be undone.
          </p>
        )}

        {error && (
          <div className="mb-4 rounded-card bg-bad/10 p-3 text-sm text-bad">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleting}
            className="flex-1"
          >
            Delete Round
          </Button>
        </div>
      </Card>
    </div>
  )
}
