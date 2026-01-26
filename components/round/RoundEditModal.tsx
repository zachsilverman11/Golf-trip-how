'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { RoundFormatSelector, type RoundFormat } from '@/components/round/RoundFormatSelector'
import { updateRoundAction } from '@/lib/supabase/round-actions'

interface RoundEditModalProps {
  roundId: string
  tripId: string
  round: {
    name: string
    date: string
    tee_time: string | null
    status: 'upcoming' | 'in_progress' | 'completed'
    format: string
    scoring_basis?: 'gross' | 'net'
  }
  hasScores: boolean
  onClose: () => void
  onSaved: () => void
}

export function RoundEditModal({
  roundId,
  tripId,
  round,
  hasScores,
  onClose,
  onSaved,
}: RoundEditModalProps) {
  const [name, setName] = useState(round.name)
  const [date, setDate] = useState(round.date)
  const [teeTime, setTeeTime] = useState(
    round.tee_time ? round.tee_time.split('T')[1]?.slice(0, 5) || '' : ''
  )
  const [format, setFormat] = useState<RoundFormat>(round.format as RoundFormat)
  const [scoringBasis, setScoringBasis] = useState<'gross' | 'net'>(
    round.scoring_basis || 'net'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine what can be edited based on round status and scores
  const canEditName = true
  const canEditDate = true
  const canEditTeeTime = round.status !== 'completed'
  // Stricter: format locked if ANY scores exist OR round not upcoming
  const canEditFormat = round.status === 'upcoming' && !hasScores

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    // Build tee_time as ISO timestamp if both date and time provided
    let teeTimeTimestamp: string | null = null
    if (teeTime) {
      teeTimeTimestamp = `${date}T${teeTime}:00`
    }

    const result = await updateRoundAction(roundId, tripId, {
      name: name.trim(),
      date,
      tee_time: teeTimeTimestamp,
      // Only include format/scoring_basis if editable
      ...(canEditFormat && {
        format,
        scoring_basis: scoringBasis,
      }),
    })

    if (result.success) {
      onSaved()
      onClose()
    } else {
      setError(result.error || 'Failed to update round')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 font-display text-xl font-bold text-text-0">
          Edit Round
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-1">
              Round Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditName}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!canEditDate}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-1">
              Tee Time
              {!canEditTeeTime && (
                <span className="ml-2 text-xs text-text-2">(locked for completed rounds)</span>
              )}
            </label>
            <input
              type="time"
              value={teeTime}
              onChange={(e) => setTeeTime(e.target.value)}
              disabled={!canEditTeeTime}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            />
          </div>

          {/* Format editing - only for upcoming rounds without scores */}
          {canEditFormat ? (
            <>
              <RoundFormatSelector value={format} onChange={setFormat} />

              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Scoring Basis
                </label>
                <select
                  value={scoringBasis}
                  onChange={(e) => setScoringBasis(e.target.value as 'gross' | 'net')}
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="net">Net (Handicap)</option>
                  <option value="gross">Gross</option>
                </select>
              </div>
            </>
          ) : (
            <div className="rounded-card-sm bg-bg-2 p-3 text-sm text-text-2">
              {hasScores
                ? 'Format cannot be changed because scores have been recorded.'
                : 'Format cannot be changed after the round has started.'}
            </div>
          )}

          {error && (
            <div className="rounded-card bg-bad/10 p-3 text-sm text-bad">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
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
            onClick={handleSave}
            loading={saving}
            disabled={saving || !name.trim()}
            className="flex-1"
          >
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  )
}
