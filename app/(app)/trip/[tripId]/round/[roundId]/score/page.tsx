'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GroupScorer } from '@/components/scoring/GroupScorer'
import { MatchStrip } from '@/components/match'
import { FormatStrip } from '@/components/scoring/FormatStrip'
import { getRoundAction, updateRoundAction } from '@/lib/supabase/round-actions'
import { getRoundScoresMapAction, upsertScoreAction } from '@/lib/supabase/score-actions'
import { getMatchStateAction, syncMatchStateAction } from '@/lib/supabase/match-actions'
import { getFormatStateAction } from '@/lib/supabase/format-actions'
import type { DbRoundWithGroups, DbHole } from '@/lib/supabase/types'
import type { MatchState } from '@/lib/supabase/match-types'
import type { FormatState } from '@/lib/format-types'

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
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [formatState, setFormatState] = useState<FormatState | null>(null)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [currentHole, setCurrentHole] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load round, scores, and match
  useEffect(() => {
    const loadData = async () => {
      const [roundResult, scoresResult, matchResult] = await Promise.all([
        getRoundAction(roundId),
        getRoundScoresMapAction(roundId),
        getMatchStateAction(roundId),
      ])

      if (roundResult.error || !roundResult.round) {
        setError(roundResult.error || 'Round not found')
        setLoading(false)
        return
      }

      // Check if round has proper tee data
      const hasTeeData = !!roundResult.round.tees &&
        Array.isArray((roundResult.round.tees as any).holes) &&
        (roundResult.round.tees as any).holes.length > 0

      if (!hasTeeData) {
        // Redirect to setup page if no tee data
        router.replace(`/trip/${tripId}/round/${roundId}/setup`)
        return
      }

      setRound(roundResult.round)
      setScores(scoresResult.scores)

      // Set match state if exists (match play with money game)
      if (matchResult.success && matchResult.state) {
        setMatchState(matchResult.state)
      }

      // Load format state for Points Hi/Lo (requires teams)
      // Stableford is individual-first for v1, no FormatStrip needed
      const format = roundResult.round.format
      if (format === 'points_hilo') {
        const formatResult = await getFormatStateAction(roundId)
        if (formatResult.formatState) {
          setFormatState(formatResult.formatState)
        } else if (formatResult.error) {
          // Teams not configured - will show setup prompt
          setFormatError(formatResult.error)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [roundId])

  // Refresh match state
  const refreshMatchState = useCallback(async () => {
    if (!matchState) return

    // First sync the match state with current scores
    await syncMatchStateAction(matchState.matchId)

    // Then get the updated state
    const result = await getMatchStateAction(roundId)
    if (result.success && result.state) {
      setMatchState(result.state)
    }
  }, [roundId, matchState])

  // Refresh format state (only for Points Hi/Lo)
  const refreshFormatState = useCallback(async () => {
    if (!round) return
    if (round.format !== 'points_hilo') return

    const result = await getFormatStateAction(roundId)
    if (result.formatState) {
      setFormatState(result.formatState)
      setFormatError(null)
    } else if (result.error) {
      setFormatError(result.error)
    }
  }, [roundId, round])

  // Extract players from all groups
  const players: Player[] = round?.groups?.flatMap((group) =>
    group.group_players?.map((gp) => ({
      id: (gp as any).players?.id,
      name: (gp as any).players?.name,
      playingHandicap: gp.playing_handicap,
    })).filter((p) => p.id) || []
  ) || []

  // Extract hole info from tee (guaranteed to exist due to redirect guard above)
  const holes: HoleInfo[] = (round?.tees?.holes || [])
    .sort((a: DbHole, b: DbHole) => a.hole_number - b.hole_number)
    .map((h: DbHole) => ({
      number: h.hole_number,
      par: h.par,
      strokeIndex: h.stroke_index,
      yards: h.yards,
    }))

  // Handle score change with optimistic update and save
  const handleScoreChange = useCallback(async (
    playerId: string,
    holeNumber: number,
    grossStrokes: number | null
  ) => {
    // Track current hole
    setCurrentHole(holeNumber)

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

    // Refresh match state if there's an active match
    if (matchState) {
      await refreshMatchState()
    }

    // Refresh format state if it's a team format
    if (formatState) {
      await refreshFormatState()
    }

    setSaving(false)
  }, [roundId, matchState, formatState, refreshMatchState, refreshFormatState])

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

      {/* Format Strip (for Points Hi/Lo with teams configured) */}
      {formatState && (
        <FormatStrip
          formatState={formatState}
          currentHole={currentHole}
          tripId={tripId}
          roundId={roundId}
          className="mb-4"
        />
      )}

      {/* Teams Not Set (for Points Hi/Lo without team assignments) */}
      {formatError && round?.format === 'points_hilo' && (
        <div className="mb-4 rounded-card border border-gold/50 bg-gold/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-0">Teams not set yet</p>
              <p className="text-sm text-text-2">
                Points Hi/Lo requires team assignments to track scoring
              </p>
            </div>
            <Link href={`/trip/${tripId}/round/${roundId}`}>
              <Button variant="secondary" size="default">
                Assign Teams
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Match Strip (for Match Play with money game) */}
      {matchState && !formatState && (
        <MatchStrip
          matchState={matchState}
          currentHole={currentHole}
          tripId={tripId}
          roundId={roundId}
          onPressAdded={refreshMatchState}
          className="mb-4"
        />
      )}

      {/* Scorer */}
      {players.length > 0 ? (
        <GroupScorer
          roundId={roundId}
          players={players}
          holes={holes}
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
