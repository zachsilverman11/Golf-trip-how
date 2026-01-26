'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlayerEntry } from '@/components/quick-round/PlayerEntry'
import { CourseSelector } from '@/components/round/CourseSelector'
import { RoundFormatSelector, type RoundFormat } from '@/components/round/RoundFormatSelector'
import { createQuickRoundAction } from '@/lib/supabase/quick-round-actions'
import { useQuickRoundDraft, type QuickRoundPlayer } from '@/hooks/useQuickRoundDraft'

export default function QuickRoundPage() {
  const router = useRouter()
  const { draft, isHydrated, updateDraft, clearDraft } = useQuickRoundDraft()

  // UI state (not persisted)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addPlayer = (name: string, handicap: number | null) => {
    const newPlayer: QuickRoundPlayer = {
      id: crypto.randomUUID(),
      name,
      handicap,
    }
    updateDraft({ players: [...draft.players, newPlayer] })
  }

  const removePlayer = (id: string) => {
    updateDraft({ players: draft.players.filter((p) => p.id !== id) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (draft.players.length === 0) {
      setError('Add at least one player')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await createQuickRoundAction({
      players: draft.players.map((p) => ({ name: p.name, handicap: p.handicap })),
      teeId: draft.teeId,
      courseName: draft.courseDisplayName || null,
      format: draft.format,
      scoringBasis: draft.scoringBasis,
      teeTime: draft.teeTime || null,
    })

    if (result.success && result.tripId && result.roundId) {
      // Clear draft only after successful creation
      clearDraft()
      if (draft.startImmediately) {
        router.push(`/trip/${result.tripId}/round/${result.roundId}/score`)
      } else {
        router.push(`/trip/${result.tripId}/round/${result.roundId}`)
      }
    } else {
      setError(result.error || 'Failed to create round')
      setSubmitting(false)
    }
  }

  const isValid = draft.players.length > 0

  // Show skeleton while hydrating from localStorage
  if (!isHydrated) {
    return (
      <LayoutContainer className="py-6">
        <div className="mb-6">
          <Link
            href="/trips"
            className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            Back to trips
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">
            Quick Round
          </h1>
          <p className="text-sm text-text-2">
            Start a round in seconds
          </p>
        </div>
        <Card className="p-4 mb-4">
          <div className="h-32 animate-pulse bg-bg-2 rounded-card-sm" />
        </Card>
        <Card className="p-4 mb-4">
          <div className="h-24 animate-pulse bg-bg-2 rounded-card-sm" />
        </Card>
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/trips"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trips
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">
          Quick Round
        </h1>
        <p className="text-sm text-text-2">
          Start a round in seconds
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Players */}
        <Card className="p-4 mb-4">
          <PlayerEntry
            players={draft.players}
            onAddPlayer={addPlayer}
            onRemovePlayer={removePlayer}
          />
        </Card>

        {/* Course (Optional) */}
        <Card className="p-4 mb-4">
          <h2 className="mb-4 font-display text-lg font-bold text-text-0">
            Course <span className="text-text-2 font-normal text-sm">(optional)</span>
          </h2>
          <CourseSelector
            selectedTeeId={draft.teeId}
            initialCourseInfo={
              draft.courseDisplayName && draft.teeName
                ? { name: draft.courseDisplayName, teeName: draft.teeName }
                : null
            }
            onTeeSelected={(teeId, courseName, teeName) => {
              // Atomic update - all course fields in one call
              updateDraft({
                teeId,
                courseDisplayName: courseName,
                teeName,
              })
            }}
          />
        </Card>

        {/* Format & Settings */}
        <Card className="p-4 mb-4">
          <RoundFormatSelector
            value={draft.format}
            onChange={(format) => updateDraft({ format })}
          />

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-text-1">
              Scoring Basis
            </label>
            <select
              value={draft.scoringBasis}
              onChange={(e) => updateDraft({ scoringBasis: e.target.value as 'gross' | 'net' })}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="net">Net (Handicap)</option>
              <option value="gross">Gross</option>
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-text-1">
              Tee Time <span className="text-text-2 font-normal">(optional)</span>
            </label>
            <input
              type="time"
              value={draft.teeTime || ''}
              onChange={(e) => updateDraft({ teeTime: e.target.value || null })}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </Card>

        {/* Start immediately checkbox */}
        <Card className="p-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.startImmediately}
              onChange={(e) => updateDraft({ startImmediately: e.target.checked })}
              className="h-5 w-5 rounded border-stroke bg-bg-2 text-accent focus:ring-accent focus:ring-offset-bg-0"
            />
            <div>
              <p className="font-medium text-text-0">Start scoring immediately</p>
              <p className="text-sm text-text-2">Jump straight to the scorecard after creating</p>
            </div>
          </label>
        </Card>

        {error && (
          <div className="mb-4 rounded-card bg-bad/10 p-4 text-bad">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          size="large"
          loading={submitting}
          disabled={submitting || !isValid}
          className="w-full"
        >
          {draft.startImmediately ? 'Start Round' : 'Create Round'}
        </Button>
      </form>
    </LayoutContainer>
  )
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
