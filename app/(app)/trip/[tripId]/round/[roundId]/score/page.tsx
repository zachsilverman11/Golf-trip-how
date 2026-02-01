'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { Button } from '@/components/ui/Button'
import { GroupScorer } from '@/components/scoring/GroupScorer'
import { ScrambleScorer } from '@/components/scoring/ScrambleScorer'
import { MatchStrip } from '@/components/match'
import { FormatStrip } from '@/components/scoring/FormatStrip'
import { getRoundAction, updateRoundAction } from '@/lib/supabase/round-actions'
import { getTripAction } from '@/lib/supabase/trip-actions'
import { getRoundScoresMapAction, upsertScoreAction } from '@/lib/supabase/score-actions'
import { getMatchStateAction, syncMatchStateAction } from '@/lib/supabase/match-actions'
import { getFormatStateAction } from '@/lib/supabase/format-actions'
import { getNassauStateAction } from '@/lib/supabase/nassau-actions'
import { getSkinsStateAction } from '@/lib/supabase/skins-actions'
import { getWolfStateAction, makeWolfDecisionAction } from '@/lib/supabase/wolf-actions'
import { generateScoreEvents } from '@/lib/supabase/feed-actions'
import { useRealtimeScores } from '@/hooks/useRealtimeScores'
import { NassauStrip } from '@/components/scoring/NassauStrip'
import { SkinsStrip } from '@/components/scoring/SkinsStrip'
import { WolfStrip } from '@/components/scoring/WolfStrip'
import type { DbRoundWithGroups, DbHole } from '@/lib/supabase/types'
import type { MatchState } from '@/lib/supabase/match-types'
import type { FormatState } from '@/lib/format-types'
import type { NassauState } from '@/lib/nassau-utils'
import type { SkinsState } from '@/lib/skins-utils'
import type { WolfState } from '@/lib/wolf-utils'
import { generateNarratives } from '@/lib/narrative-utils'
import { CompetitionBadge } from '@/components/scoring/CompetitionBadge'
import { JunkBetButtons } from '@/components/scoring/JunkBetButtons'
import { JunkBetSummary } from '@/components/scoring/JunkBetSummary'
import { ShareButton } from '@/components/ui/ShareButton'
import { getJunkConfigAction } from '@/lib/supabase/junk-actions'
import type { RoundJunkConfig } from '@/lib/junk-types'

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
  const [nassauState, setNassauState] = useState<NassauState | null>(null)
  const [skinsState, setSkinsState] = useState<SkinsState | null>(null)
  const [wolfState, setWolfState] = useState<WolfState | null>(null)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [junkConfig, setJunkConfig] = useState<RoundJunkConfig | null>(null)
  const [competitionName, setCompetitionName] = useState<string | null>(null)
  const [currentHole, setCurrentHole] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveToast, setLiveToast] = useState(false)
  const liveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scorerState, setScorerState] = useState<{ currentHole: number; selectedPlayerId: string | null; par: number }>({
    currentHole: 1,
    selectedPlayerId: null,
    par: 4,
  })

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
    // Refresh new format states
    if (round?.format === 'nassau') {
      const result = await getNassauStateAction(roundId)
      if (result.nassauState) setNassauState(result.nassauState)
    }
    if (round?.format === 'skins') {
      const result = await getSkinsStateAction(roundId)
      if (result.skinsState) setSkinsState(result.skinsState)
    }
    if (round?.format === 'wolf') {
      const result = await getWolfStateAction(roundId)
      if (result.wolfState) setWolfState(result.wolfState)
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

      // Load Nassau state
      if (format === 'nassau') {
        const nassauResult = await getNassauStateAction(roundId)
        if (nassauResult.nassauState) {
          setNassauState(nassauResult.nassauState)
        } else if (nassauResult.error) {
          setFormatError(nassauResult.error)
        }
      }

      // Load Skins state
      if (format === 'skins') {
        const skinsResult = await getSkinsStateAction(roundId)
        if (skinsResult.skinsState) {
          setSkinsState(skinsResult.skinsState)
        } else if (skinsResult.error) {
          setFormatError(skinsResult.error)
        }
      }

      // Load Wolf state
      if (format === 'wolf') {
        const wolfResult = await getWolfStateAction(roundId)
        if (wolfResult.wolfState) {
          setWolfState(wolfResult.wolfState)
        } else if (wolfResult.error) {
          setFormatError(wolfResult.error)
        }
      }

      // Load junk bet config
      const junkResult = await getJunkConfigAction(roundId)
      if (junkResult.config?.enabled) {
        setJunkConfig(junkResult.config)
      }

      // Check if this round counts toward team competition
      if (format === 'match_play' || format === 'points_hilo' || format === 'nassau' || format === 'scramble') {
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

  // Refresh format state (Points Hi/Lo, Nassau, Skins, Wolf)
  const refreshFormatState = useCallback(async () => {
    if (!round) return

    if (round.format === 'points_hilo') {
      const result = await getFormatStateAction(roundId)
      if (result.formatState) {
        setFormatState(result.formatState)
        setFormatError(null)
      } else if (result.error) {
        setFormatError(result.error)
      }
    } else if (round.format === 'nassau') {
      const result = await getNassauStateAction(roundId)
      if (result.nassauState) {
        setNassauState(result.nassauState)
        setFormatError(null)
      } else if (result.error) {
        setFormatError(result.error)
      }
    } else if (round.format === 'skins') {
      const result = await getSkinsStateAction(roundId)
      if (result.skinsState) {
        setSkinsState(result.skinsState)
        setFormatError(null)
      } else if (result.error) {
        setFormatError(result.error)
      }
    } else if (round.format === 'wolf') {
      const result = await getWolfStateAction(roundId)
      if (result.wolfState) {
        setWolfState(result.wolfState)
        setFormatError(null)
      } else if (result.error) {
        setFormatError(result.error)
      }
    } else {
      return // no format state to refresh
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
    } else if (grossStrokes !== null) {
      // Generate feed events (fire and forget — don't block scoring)
      const player = players.find((p) => p.id === playerId)
      const hole = holes.find((h) => h.number === holeNumber)
      if (player && hole) {
        generateScoreEvents(
          tripId,
          roundId,
          playerId,
          player.name,
          holeNumber,
          grossStrokes,
          hole.par
        ).catch(() => {}) // Swallow errors
      }
    }

    // Refresh match state if there's an active match
    if (matchState) {
      await refreshMatchState()
    }

    // Refresh format state if it's a format with live state
    if (formatState || nassauState || skinsState || wolfState) {
      await refreshFormatState()
    }

    setSaving(false)
  }, [roundId, tripId, players, holes, matchState, formatState, nassauState, skinsState, wolfState, refreshMatchState, refreshFormatState, markLocalSave])

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
      <div className="min-h-screen bg-bg-0">
        <LayoutContainer className="py-4">
          {/* Skeleton header */}
          <div className="mb-4 animate-pulse">
            <div className="h-4 w-24 rounded bg-bg-2 mb-2" />
            <div className="h-5 w-40 rounded bg-bg-2" />
          </div>
          {/* Skeleton hole info */}
          <div className="mb-4 rounded-xl bg-bg-1 border border-stroke/40 p-4 animate-pulse">
            <div className="flex justify-between mb-2">
              <div className="h-8 w-24 rounded bg-bg-2" />
              <div className="h-8 w-16 rounded bg-bg-2" />
            </div>
            <div className="h-1 rounded-full bg-bg-2 mt-3" />
          </div>
          {/* Skeleton hole nav */}
          <div className="flex gap-1.5 mb-4 animate-pulse">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-9 w-9 rounded-lg bg-bg-2" />
            ))}
          </div>
          {/* Skeleton player rows */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-2 rounded-xl bg-bg-1 border border-stroke/40 p-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-bg-2" />
                <div className="flex-1">
                  <div className="h-4 w-24 rounded bg-bg-2 mb-1" />
                  <div className="h-3 w-16 rounded bg-bg-2" />
                </div>
                <div className="h-12 w-12 rounded-xl bg-bg-2" />
              </div>
            </div>
          ))}
          {/* Skeleton keypad */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-bg-1 border border-stroke/30" />
            ))}
          </div>
        </LayoutContainer>
      </div>
    )
  }

  if (error || !round) {
    return (
      <div className="min-h-screen bg-bg-0">
        <LayoutContainer className="py-6">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">😔</div>
            <p className="mb-2 text-lg font-medium text-text-0">{error || 'Round not found'}</p>
            <p className="text-sm text-text-2 mb-6">Something went wrong loading this round.</p>
            <Link href={`/trip/${tripId}`}>
              <Button variant="secondary">← Back to Trip</Button>
            </Link>
          </div>
        </LayoutContainer>
      </div>
    )
  }

  const course = (round.tees as any)?.courses

  return (
    <div className="min-h-screen bg-bg-0">
      <LayoutContainer className="py-3 pb-safe">
        {/* Compact header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <Link
              href={`/trip/${tripId}/round/${roundId}`}
              className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
            >
              <BackIcon />
              <span className="truncate max-w-[140px]">{round.name}</span>
            </Link>
            {course && (
              <p className="text-xs text-text-2/60 truncate mt-0.5">{course.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
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
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs text-good/80 animate-fadeIn">
            <div className="h-1.5 w-1.5 rounded-full bg-good animate-pulse" />
            Scores updated live
          </div>
        )}

        {/* Format Strip (for Points Hi/Lo with teams configured) */}
        {formatState && (
          <FormatStrip
            formatState={formatState}
            currentHole={currentHole}
            tripId={tripId}
            roundId={roundId}
            className="mb-3"
          />
        )}

        {/* Nassau Strip */}
        {nassauState && (
          <NassauStrip
            nassauState={nassauState}
            currentHole={currentHole}
            tripId={tripId}
            roundId={roundId}
            className="mb-3"
          />
        )}

        {/* Skins Strip */}
        {skinsState && (
          <SkinsStrip
            skinsState={skinsState}
            currentHole={currentHole}
            tripId={tripId}
            roundId={roundId}
            className="mb-3"
          />
        )}

        {/* Wolf Strip */}
        {wolfState && (
          <WolfStrip
            wolfState={wolfState}
            currentHole={currentHole}
            tripId={tripId}
            roundId={roundId}
            onWolfDecision={async (holeNumber, partnerId, isLoneWolf) => {
              await makeWolfDecisionAction({
                roundId,
                holeNumber,
                partnerId,
                isLoneWolf,
              })
              await refreshFormatState()
            }}
            className="mb-3"
          />
        )}

        {/* Bet not configured prompt for new formats */}
        {formatError && (round?.format === 'nassau' || round?.format === 'skins' || round?.format === 'wolf') && (
          <div className="mb-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gold text-lg">💰</span>
                <span className="text-sm text-text-1">
                  {round.format === 'nassau' ? 'Nassau' : round.format === 'skins' ? 'Skins' : 'Wolf'} bet not set up
                </span>
              </div>
              <Link href={`/trip/${tripId}/round/${roundId}`}>
                <Button variant="secondary" size="default">
                  Set Up
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Teams Not Set (for Points Hi/Lo without team assignments) */}
        {formatError && round?.format === 'points_hilo' && (
          <div className="mb-3 rounded-xl border border-gold/50 bg-gold/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-text-0">Teams not set yet</p>
                <p className="text-sm text-text-2">
                  Points Hi/Lo requires team assignments
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
            className="mb-3"
          />
        )}

        {/* No money game prompt (for Match Play without money game set up) */}
        {!matchState && !formatState && round?.format === 'match_play' && (
          <div className="mb-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
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
        {round?.format === 'scramble' ? (
          <ScrambleScorerWrapper
            round={round}
            holes={holes}
            scores={scores}
            onScoreChange={handleScoreChange}
            onComplete={handleComplete}
          />
        ) : players.length > 0 ? (
          <GroupScorer
            roundId={roundId}
            players={players}
            holes={holes}
            scores={scores}
            onScoreChange={handleScoreChange}
            onComplete={handleComplete}
            onStateChange={setScorerState}
            extraContent={
              junkConfig ? (
                <JunkBetButtons
                  roundId={roundId}
                  players={players}
                  selectedPlayerId={scorerState.selectedPlayerId}
                  currentHole={scorerState.currentHole}
                  par={scorerState.par}
                  junkConfig={junkConfig}
                  className="mb-4"
                />
              ) : undefined
            }
          />
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏌️</div>
            <p className="text-text-2 mb-4">No players in this round</p>
            <Link href={`/trip/${tripId}/round/${roundId}`}>
              <Button variant="secondary">← Back to Round</Button>
            </Link>
          </div>
        )}
      </LayoutContainer>
    </div>
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

/**
 * Wrapper that extracts team info from round groups for the ScrambleScorer.
 *
 * In scramble, team_number on group_players determines which team a player is on.
 * Team 1 = Team A, Team 2 = Team B. The first player on each team is the "captain"
 * whose player ID is used to store the team's score in the scores table.
 */
function ScrambleScorerWrapper({
  round,
  holes,
  scores,
  onScoreChange,
  onComplete,
}: {
  round: DbRoundWithGroups
  holes: { number: number; par: number; strokeIndex: number; yards: number | null }[]
  scores: { [playerId: string]: { [hole: number]: number | null } }
  onScoreChange: (playerId: string, hole: number, score: number | null) => void
  onComplete: () => void
}) {
  // Extract players with team assignments from all groups
  const allGroupPlayers = round.groups?.flatMap((g) =>
    g.group_players?.map((gp) => ({
      id: (gp as any).players?.id as string,
      name: (gp as any).players?.name as string,
      teamNumber: gp.team_number as 1 | 2 | null,
    })).filter((p) => p.id) || []
  ) || []

  const team1Players = allGroupPlayers.filter((p) => p.teamNumber === 1)
  const team2Players = allGroupPlayers.filter((p) => p.teamNumber === 2)

  // Need at least 1 player per team
  if (team1Players.length === 0 || team2Players.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">👥</div>
        <p className="text-text-0 font-medium mb-2">Teams not set up for scramble</p>
        <p className="text-xs text-text-2 mb-4">
          Each team needs at least 1 player with a team assignment.
        </p>
      </div>
    )
  }

  const teamA = {
    name: 'Team 1',
    captainId: team1Players[0].id,
    players: team1Players.map((p) => ({ id: p.id, name: p.name })),
  }

  const teamB = {
    name: 'Team 2',
    captainId: team2Players[0].id,
    players: team2Players.map((p) => ({ id: p.id, name: p.name })),
  }

  return (
    <ScrambleScorer
      roundId={round.id}
      teamA={teamA}
      teamB={teamB}
      holes={holes}
      scores={scores}
      onScoreChange={onScoreChange}
      onComplete={onComplete}
    />
  )
}
