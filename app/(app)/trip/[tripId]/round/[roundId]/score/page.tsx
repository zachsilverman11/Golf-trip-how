'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GroupScorer } from '@/components/scoring/GroupScorer'
import { getRoundAction, updateRoundAction } from '@/lib/supabase/round-actions'
import { getRoundScoresMapAction, upsertScoreAction } from '@/lib/supabase/score-actions'
import type { DbRoundWithGroups, DbHole } from '@/lib/supabase/types'

interface Player {
  id: string
  name: string
  playingHandicap: number | null
}

interface HoleInfo {
  number: number
  par: number
  strokeIndex: number
  yards: number | null
}

export default function ScorePage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const roundId = params.roundId as string

  const [round, setRound] = useState<DbRoundWithGroups | null>(null)
  const [scores, setScores] = useState<{ [playerId: string]: { [hole: number]: number | null } }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load round and scores
  useEffect(() => {
    const loadData = async () => {
      const [roundResult, scoresResult] = await Promise.all([
        getRoundAction(roundId),
        getRoundScoresMapAction(roundId),
      ])

      if (roundResult.error || !roundResult.round) {
        setError(roundResult.error || 'Round not found')
        setLoading(false)
        return
      }

      setRound(roundResult.round)
      setScores(scoresResult.scores)
      setLoading(false)
    }

    loadData()
  }, [roundId])

  // Extract players from all groups
  const players: Player[] = round?.groups?.flatMap((group) =>
    group.group_players?.map((gp) => ({
      id: (gp as any).players?.id,
      name: (gp as any).players?.name,
      playingHandicap: gp.playing_handicap,
    })).filter((p) => p.id) || []
  ) || []

  // Extract hole info from tee
  const holes: HoleInfo[] = (round?.tees?.holes || [])
    .sort((a: DbHole, b: DbHole) => a.hole_number - b.hole_number)
    .map((h: DbHole) => ({
      number: h.hole_number,
      par: h.par,
      strokeIndex: h.stroke_index,
      yards: h.yards,
    }))

  // Default holes if no tee selected
  const effectiveHoles: HoleInfo[] = holes.length > 0
    ? holes
    : Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 4,
        strokeIndex: i + 1,
        yards: null,
      }))

  // Handle score change with optimistic update and save
  const handleScoreChange = useCallback(async (
    playerId: string,
    holeNumber: number,
    grossStrokes: number | null
  ) => {
    // Optimistic update
    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [holeNumber]: grossStrokes,
      },
    }))

    // Save to database
    setSaving(true)
    const result = await upsertScoreAction({
      round_id: roundId,
      player_id: playerId,
      hole_number: holeNumber,
      gross_strokes: grossStrokes,
    })

    if (!result.success) {
      console.error('Failed to save score:', result.error)
      // Could revert optimistic update here if needed
    }
    setSaving(false)
  }, [roundId])

  // Handle round completion
  const handleComplete = async () => {
    const result = await updateRoundAction(roundId, tripId, {
      status: 'completed',
    })

    if (result.success) {
      router.push(`/trip/${tripId}/leaderboard`)
    } else {
      setError(result.error || 'Failed to complete round')
    }
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading round...</div>
      </LayoutContainer>
    )
  }

  if (error || !round) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center">
          <p className="mb-4 text-bad">{error || 'Round not found'}</p>
          <Link href={`/trip/${tripId}`}>
            <Button variant="secondary">Back to Trip</Button>
          </Link>
        </div>
      </LayoutContainer>
    )
  }

  const course = (round.tees as any)?.courses

  return (
    <LayoutContainer className="py-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/trip/${tripId}/round/${roundId}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            {round.name}
          </Link>
          {course && (
            <p className="text-sm text-text-1 truncate">{course.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-text-2">Saving...</span>
          )}
          <Badge variant="live">Live</Badge>
        </div>
      </div>

      {/* Scorer */}
      {players.length > 0 ? (
        <GroupScorer
          roundId={roundId}
          players={players}
          holes={effectiveHoles}
          scores={scores}
          onScoreChange={handleScoreChange}
          onComplete={handleComplete}
        />
      ) : (
        <div className="text-center py-8">
          <p className="text-text-2 mb-4">No players in this round</p>
          <Link href={`/trip/${tripId}/round/${roundId}`}>
            <Button variant="secondary">Back to Round</Button>
          </Link>
        </div>
      )}
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
