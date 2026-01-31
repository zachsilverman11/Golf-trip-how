'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { Button } from '@/components/ui/Button'
import { GroupScorer } from '@/components/scoring/GroupScorer'
import { MatchStrip } from '@/components/match'
import { FormatStrip } from '@/components/scoring/FormatStrip'
import { getRoundAction, updateRoundAction } from '@/lib/supabase/round-actions'
import { getTripAction } from '@/lib/supabase/trip-actions'
import { getRoundScoresMapAction, upsertScoreAction } from '@/lib/supabase/score-actions'
import { getMatchStateAction, syncMatchStateAction } from '@/lib/supabase/match-actions'
import { getFormatStateAction } from '@/lib/supabase/format-actions'
import { useRealtimeScores } from '@/hooks/useRealtimeScores'
import type { DbRoundWithGroups, DbHole } from '@/lib/supabase/types'
import type { MatchState } from '@/lib/supabase/match-types'
import type { FormatState } from '@/lib/format-types'
import { generateNarratives } from '@/lib/narrative-utils'
import { CompetitionBadge } from '@/components/scoring/CompetitionBadge'
import { ShareButton } from '@/components/ui/ShareButton'

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
  const [competitionName, setCompetitionName] = useState<string | null>(null)
  const [currentHole, setCurrentHole] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveToast, setLiveToast] = useState(false)
  const liveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Realtime data refresh ---
  const refreshData = useCallback(async () => {
    const [scoresResult, matchResult] = await Promise.all([
      getRoundScoresMapAction(roundId),
      getMatchStateAction(roundId),
    ])
    setScores(scoresResult.scores)
    if (matchResult.success && matchResult.state) {
      setMatchState(matchResult.state)
    }
    // Also refresh format state if applicable
    if (round?.format === 'points_hilo') {
      const formatResult = await getFormatStateAction(roundId)
      if (formatResult.formatState) {
        setFormatState(formatResult.formatState)
      }
    }
    // Show a subtle toast for remote updates
    setLiveToast(true)
    if (liveToastTimer.current) clearTimeout(liveToastTimer.current)
    liveToastTimer.current = setTimeout(() => setLiveToast(false), 2000)
  }, [roundId, round?.format])

  const { isConnected, markLocalSave } = useRealtimeScores({
    roundId,
    onScoreChange: refreshData,
    onMatchChange: refreshData,
    enabled: !loading && !!round,
  })

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

      // Check if this round counts toward team competition
      if (format === 'match_play' || format === 'points_hilo') {
        const tripResult = await getTripAction(tripId)
        if (tripResult.trip?.war_enabled) {
          setCompetitionName((tripResult.trip as any).competition_name || 'The Cup')
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

  // Generate narratives from match state
  const narratives = useMemo(() => {
    if (!matchState) return []
    const teamANames = [
      matchState.teamA.player1.name,
      matchState.teamA.player2?.name
    ].filter(Boolean) as string[]
    const teamBNames = [
      matchState.teamB.player1.name,
      matchState.teamB.player2?.name
    ].filter(Boolean) as string[]
    return generateNarratives(matchState.holeResults, matchState, teamANames, teamBNames)
  }, [matchState])

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

  // Auto-advance to first incomplete hole
  useEffect(() => {
    if (!round || !players.length || !Object.keys(scores).length) return
    const totalHoles = (round.tees?.holes || []).length || 18
    for (let h = 1; h <= totalHoles; h++) {
      const allScored = players.every(p => scores[p.id]?.[h] != null)
      if (!allScored) {
        setCurrentHole(h)
        break
      }
    }
  }, [round, players.length, Object.keys(scores).length]) // Only on initial load

  // Handle score change with optimistic update and save
  const handleScoreChange = useCallback(async (
    playerId: string,
    holeNumber: number,
    grossStrokes: number | null
  ) => {
    // Track current hole
    setCurrentHole(holeNumber)

    // Mark local save so realtime ignores the echo
    markLocalSave()

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
  }, [roundId, matchState, formatState, refreshMatchState, refreshFormatState, markLocalSave])

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
          <ShareButton
            title={round?.name || 'Round'}
            text={buildScoreShareText(round, players, scores, matchState, currentHole)}
          />
          <LiveIndicator isConnected={isConnected} />
        </div>
      </div>

      {/* Competition Badge */}
      {competitionName && (
        <CompetitionBadge competitionName={competitionName} className="mb-3" />
      )}

      {/* Live update toast */}
      {liveToast && (
        <div className="mb-2 text-center text-xs text-good/80 animate-pulse">
          Scores updated
        </div>
      )}

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
          narratives={narratives.map(n => ({ text: n.text, intensity: n.intensity }))}
          className="mb-4"
        />
      )}

      {/* No money game prompt (for Match Play without money game set up) */}
      {!matchState && !formatState && round?.format === 'match_play' && (
        <div className="mb-4 rounded-card border border-gold/30 bg-gold/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gold text-lg">💰</span>
              <span className="text-sm text-text-1">No money game yet</span>
            </div>
            <Link href={`/trip/${tripId}/round/${roundId}/match/setup`}>
              <Button variant="secondary" size="default">
                Set Up
              </Button>
            </Link>
          </div>
        </div>
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

function buildScoreShareText(
  round: DbRoundWithGroups | null,
  players: { id: string; name: string; playingHandicap: number | null }[],
  scores: { [playerId: string]: { [hole: number]: number | null } },
  matchState: MatchState | null,
  currentHole: number
): string {
  if (!round) return '⛳ Golf Round'

  // If match play, share match status
  if (matchState) {
    const teamAName = matchState.teamA.player1.name.split(' ')[0]
    const teamBName = matchState.teamB.player1.name.split(' ')[0]
    const lead = matchState.holeResults
      .filter(r => r.winner !== null)
      .slice(-1)[0]?.cumulativeLead || 0
    const holesPlayed = matchState.holeResults.filter(r => r.winner !== null).length

    if (lead === 0) {
      return `⛳ ${round.name}: ${teamAName} vs ${teamBName} — All Square thru ${holesPlayed}`
    }
    const leader = lead > 0 ? teamAName : teamBName
    return `⛳ ${round.name}: ${leader} ${Math.abs(lead)} UP thru ${holesPlayed} 🔥`
  }

  // Stroke play: share scores through current hole
  const lines = players.map(p => {
    let total = 0
    let thru = 0
    for (let h = 1; h <= 18; h++) {
      const s = scores[p.id]?.[h]
      if (s != null) { total += s; thru = h }
    }
    return thru > 0 ? `${p.name.split(' ')[0]}: ${total} thru ${thru}` : null
  }).filter(Boolean)

  if (lines.length === 0) return `⛳ ${round.name} — Scoring in progress`
  return `⛳ ${round.name}\n${lines.join('\n')}`
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
