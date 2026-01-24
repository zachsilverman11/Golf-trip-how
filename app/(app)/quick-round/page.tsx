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

interface Player {
  id: string
  name: string
  handicap: number | null
}

export default function QuickRoundPage() {
  const router = useRouter()

  // Players state
  const [players, setPlayers] = useState<Player[]>([])

  // Course state
  const [selectedTeeId, setSelectedTeeId] = useState<string | null>(null)
  const [selectedCourseName, setSelectedCourseName] = useState<string>('')

  // Round settings
  const [format, setFormat] = useState<RoundFormat>('stroke_play')
  const [scoringBasis, setScoringBasis] = useState<'gross' | 'net'>('net')
  const [teeTime, setTeeTime] = useState('')

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startImmediately, setStartImmediately] = useState(true)

  const addPlayer = (name: string, handicap: number | null) => {
    setPlayers([
      ...players,
      { id: crypto.randomUUID(), name, handicap },
    ])
  }

  const removePlayer = (id: string) => {
    setPlayers(players.filter((p) => p.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (players.length === 0) {
      setError('Add at least one player')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await createQuickRoundAction({
      players: players.map((p) => ({ name: p.name, handicap: p.handicap })),
      teeId: selectedTeeId,
      courseName: selectedCourseName || null,
      format,
      scoringBasis,
      teeTime: teeTime || null,
    })

    if (result.success && result.tripId && result.roundId) {
      if (startImmediately) {
        router.push(`/trip/${result.tripId}/round/${result.roundId}/score`)
      } else {
        router.push(`/trip/${result.tripId}/round/${result.roundId}`)
      }
    } else {
      setError(result.error || 'Failed to create round')
      setSubmitting(false)
    }
  }

  const isValid = players.length > 0

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
            players={players}
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
            selectedTeeId={selectedTeeId}
            onTeeSelected={(teeId, courseName) => {
              setSelectedTeeId(teeId)
              setSelectedCourseName(courseName)
            }}
          />
        </Card>

        {/* Format & Settings */}
        <Card className="p-4 mb-4">
          <RoundFormatSelector
            value={format}
            onChange={setFormat}
          />

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-text-1">
              Scoring Basis
            </label>
            <select
              value={scoringBasis}
              onChange={(e) => setScoringBasis(e.target.value as typeof scoringBasis)}
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
              value={teeTime}
              onChange={(e) => setTeeTime(e.target.value)}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </Card>

        {/* Start immediately checkbox */}
        <Card className="p-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={startImmediately}
              onChange={(e) => setStartImmediately(e.target.checked)}
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
          {startImmediately ? 'Start Round' : 'Create Round'}
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
