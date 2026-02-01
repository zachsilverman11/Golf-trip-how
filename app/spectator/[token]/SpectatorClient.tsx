'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { LeaderboardRow } from '@/components/ui/LeaderboardRow'
import { MatchStatus, PressStatus } from '@/components/match'
import { getSpectatorLeaderboardAction } from '@/lib/supabase/leaderboard-actions'
import {
  getSpectatorMatchesAction,
  getSpectatorFeedAction,
  type SpectatorMatchInfo,
} from '@/lib/supabase/spectator-actions'
import { formatMoney } from '@/lib/match-utils'
import type {
  LeaderboardEntry,
  TripLeaderboard,
} from '@/lib/supabase/leaderboard-actions'
import type { FeedEvent, FeedEventType } from '@/lib/supabase/feed-actions'

// ============================================================================
// Types
// ============================================================================

type ScoringMode = 'net' | 'gross'
type SpectatorTab = 'leaderboard' | 'matches' | 'feed'

// ============================================================================
// Feed Event Styling
// ============================================================================

function getEventStyle(event: FeedEvent): { emoji: string; borderColor: string } {
  const eventType = event.event_type
  const metadata = event.metadata as Record<string, unknown> | null

  if (eventType === 'score') {
    const diff = typeof metadata?.diff === 'number' ? metadata.diff : 0
    if (diff < 0) return { emoji: '🏌️', borderColor: 'border-l-good' }
    return { emoji: '😬', borderColor: 'border-l-bad' }
  }

  const styles: Record<FeedEventType, { emoji: string; borderColor: string }> = {
    score: { emoji: '🏌️', borderColor: 'border-l-text-2' },
    press: { emoji: '🔥', borderColor: 'border-l-gold' },
    match_result: { emoji: '🏆', borderColor: 'border-l-accent' },
    media: { emoji: '📸', borderColor: 'border-l-text-2' },
    milestone: { emoji: '🎯', borderColor: 'border-l-gold' },
    settlement: { emoji: '💰', borderColor: 'border-l-good' },
    round_start: { emoji: '⛳', borderColor: 'border-l-accent' },
    round_complete: { emoji: '🏆', borderColor: 'border-l-accent' },
  }

  return styles[eventType] || styles.score
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// Component
// ============================================================================

interface SpectatorClientProps {
  token: string
}

export function SpectatorClient({ token }: SpectatorClientProps) {
  const [trip, setTrip] = useState<{
    id: string
    name: string
    description: string | null
  } | null>(null)
  const [leaderboard, setLeaderboard] = useState<TripLeaderboard>({
    entries: [],
    par: 72,
    holesTotal: 18,
  })
  const [matches, setMatches] = useState<SpectatorMatchInfo[]>([])
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [scoringMode, setScoringMode] = useState<ScoringMode>('net')
  const [activeTab, setActiveTab] = useState<SpectatorTab>('leaderboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isLive, setIsLive] = useState(false)

  // Load all data
  const loadData = useCallback(async () => {
    const [leaderboardResult, matchesResult, feedResult] = await Promise.all([
      getSpectatorLeaderboardAction(token),
      getSpectatorMatchesAction(token),
      getSpectatorFeedAction(token, 30),
    ])

    if (leaderboardResult.error) {
      setError(leaderboardResult.error)
    } else {
      setTrip(leaderboardResult.trip || null)
      setLeaderboard(leaderboardResult.leaderboard)
      setError(null)
    }

    if (!matchesResult.error) {
      setMatches(matchesResult.matches)
      // Check if any round is live
      const hasLive = matchesResult.matches.some(
        (m) => m.roundStatus === 'in_progress'
      )
      setIsLive(hasLive || leaderboardResult.leaderboard.entries.some((e) => e.thru > 0 && e.thru < 18))
    }

    if (!feedResult.error) {
      setFeedEvents(feedResult.events)
    }

    setLastUpdate(new Date())
    setLoading(false)
  }, [token])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  // Sort leaderboard entries
  const sortedEntries = [...leaderboard.entries].sort((a, b) => {
    if (scoringMode === 'net') return a.netTotal - b.netTotal
    return a.grossTotal - b.grossTotal
  })

  let currentPosition = 1
  const entriesWithPosition = sortedEntries.map((entry, idx) => {
    const compareValue =
      scoringMode === 'net' ? entry.netTotal : entry.grossTotal
    const prevValue =
      idx > 0
        ? scoringMode === 'net'
          ? sortedEntries[idx - 1].netTotal
          : sortedEntries[idx - 1].grossTotal
        : null

    if (idx > 0 && compareValue > prevValue!) {
      currentPosition = idx + 1
    }

    return { ...entry, displayPosition: currentPosition }
  })

  // Separate active vs completed matches
  const activeMatches = matches.filter((m) => m.match.status === 'in_progress')
  const completedMatches = matches.filter(
    (m) => m.match.status === 'completed'
  )

  // Tab configuration
  const tabs = [
    { id: 'leaderboard' as const, label: 'Leaderboard' },
    { id: 'matches' as const, label: `Matches${matches.length > 0 ? ` (${matches.length})` : ''}` },
    { id: 'feed' as const, label: 'Feed' },
  ]

  // ========================================================================
  // Loading State
  // ========================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-0">
        <LayoutContainer className="py-6">
          {/* Header skeleton */}
          <div className="text-center mb-6">
            <div className="mx-auto h-5 w-32 animate-pulse rounded-full bg-bg-2 mb-3" />
            <div className="mx-auto h-7 w-48 animate-pulse rounded bg-bg-2 mb-2" />
            <div className="mx-auto h-4 w-64 animate-pulse rounded bg-bg-2" />
          </div>
          {/* Tabs skeleton */}
          <div className="flex gap-2 mb-4">
            <div className="h-9 flex-1 animate-pulse rounded-button bg-bg-2" />
            <div className="h-9 flex-1 animate-pulse rounded-button bg-bg-2" />
            <div className="h-9 flex-1 animate-pulse rounded-button bg-bg-2" />
          </div>
          {/* Row skeletons */}
          <Card>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-stroke/30 last:border-0"
              >
                <div className="h-6 w-6 animate-pulse rounded-full bg-bg-2" />
                <div className="h-4 w-24 animate-pulse rounded bg-bg-2" />
                <div className="flex-1" />
                <div className="h-4 w-12 animate-pulse rounded bg-bg-2" />
              </div>
            ))}
          </Card>
        </LayoutContainer>
      </div>
    )
  }

  // ========================================================================
  // Error State
  // ========================================================================

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-0 px-4">
        <Card className="max-w-md p-8 text-center">
          <div className="mb-4 text-4xl opacity-50">
            <span role="img" aria-label="error">
              ⛳
            </span>
          </div>
          <h1 className="mb-2 font-display text-xl font-bold text-text-0">
            Invalid Link
          </h1>
          <p className="text-text-2">
            This spectator link is invalid or has expired.
          </p>
        </Card>
      </div>
    )
  }

  // ========================================================================
  // Main Render
  // ========================================================================

  return (
    <div className="min-h-screen bg-bg-0 pb-8">
      <LayoutContainer className="py-6">
        {/* ============================================================== */}
        {/* Hero Header */}
        {/* ============================================================== */}
        <div className="mb-6 text-center">
          {/* Live indicator */}
          {isLive ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-bad/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-bad mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bad opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-bad" />
              </span>
              Live
            </div>
          ) : (
            <Badge variant="default" className="mb-3">
              Leaderboard
            </Badge>
          )}

          <h1 className="font-display text-2xl font-bold text-text-0">
            {trip?.name || 'Press'}
          </h1>

          {/* Subtitle */}
          <p className="mt-1 text-sm text-text-2">
            {isLive
              ? 'Follow along live'
              : trip?.description || 'Golf trip leaderboard'}
          </p>
        </div>

        {/* ============================================================== */}
        {/* Navigation Tabs */}
        {/* ============================================================== */}
        <div className="mb-4">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as SpectatorTab)}
          />
        </div>

        {/* ============================================================== */}
        {/* Leaderboard Tab */}
        {/* ============================================================== */}
        {activeTab === 'leaderboard' && (
          <>
            {/* Scoring mode toggle */}
            <div className="mb-4 flex justify-center">
              <div className="inline-flex gap-1 rounded-button bg-bg-1 border border-stroke p-1">
                {(['net', 'gross'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setScoringMode(mode)}
                    className={`px-4 py-1.5 rounded-button text-xs font-medium transition-colors ${
                      scoringMode === mode
                        ? 'bg-accent text-bg-0'
                        : 'text-text-2 hover:text-text-1'
                    }`}
                  >
                    {mode === 'net' ? 'Net' : 'Gross'}
                  </button>
                ))}
              </div>
            </div>

            {entriesWithPosition.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="mb-4 text-4xl opacity-50">
                  <span role="img" aria-label="golf">
                    🏌️
                  </span>
                </div>
                <p className="text-text-1 font-medium">No scores yet</p>
                <p className="mt-2 text-sm text-text-2">
                  Check back once the round has started!
                </p>
              </Card>
            ) : (
              <Card>
                {entriesWithPosition.map((entry) => (
                  <LeaderboardRow
                    key={entry.playerId}
                    rank={entry.displayPosition}
                    name={entry.playerName}
                    score={
                      scoringMode === 'net'
                        ? entry.netTotal
                        : entry.grossTotal
                    }
                    netScore={entry.netTotal}
                    grossScore={entry.grossTotal}
                    showNet={scoringMode === 'net'}
                    delta={entry.scoreToPar}
                    thru={entry.thru}
                    badges={
                      entry.playingHandicap !== null
                        ? [
                            {
                              text: `HCP ${entry.playingHandicap}`,
                              variant: 'default' as const,
                            },
                          ]
                        : []
                    }
                  />
                ))}
              </Card>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* Matches Tab */}
        {/* ============================================================== */}
        {activeTab === 'matches' && (
          <>
            {matches.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="mb-4 text-4xl opacity-50">🤝</div>
                <p className="text-text-1 font-medium">No matches yet</p>
                <p className="mt-2 text-sm text-text-2">
                  Matches will appear here once they&apos;re set up.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Active Matches */}
                {activeMatches.length > 0 && (
                  <div>
                    <p className="text-xs text-text-2 uppercase tracking-wider mb-2 px-1">
                      Active
                    </p>
                    {activeMatches.map((m) => (
                      <SpectatorMatchCard
                        key={m.match.id}
                        matchInfo={m}
                        isLive
                      />
                    ))}
                  </div>
                )}

                {/* Completed Matches */}
                {completedMatches.length > 0 && (
                  <div>
                    <p className="text-xs text-text-2 uppercase tracking-wider mb-2 px-1">
                      Completed
                    </p>
                    {completedMatches.map((m) => (
                      <SpectatorMatchCard
                        key={m.match.id}
                        matchInfo={m}
                        isLive={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* Feed Tab */}
        {/* ============================================================== */}
        {activeTab === 'feed' && (
          <>
            {feedEvents.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="mb-3 text-3xl opacity-40">⛳</div>
                <p className="text-text-1 font-medium">No activity yet</p>
                <p className="mt-2 text-sm text-text-2">
                  Birdies, presses, and drama will appear here once the round
                  starts.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {feedEvents.map((event) => {
                  const style = getEventStyle(event)
                  return (
                    <Card
                      key={event.id}
                      className={`border-l-4 ${style.borderColor} px-4 py-3`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0 text-lg leading-none">
                          {style.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-0 leading-snug">
                            {event.headline}
                          </p>
                          {event.detail && (
                            <p className="mt-0.5 text-xs text-text-2 leading-snug">
                              {event.detail}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-text-2">
                            {timeAgo(event.created_at)}
                          </p>
                        </div>
                        {event.hole_number && (
                          <span className="flex-shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-2 text-xs font-medium text-text-1">
                            {event.hole_number}
                          </span>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* Footer */}
        {/* ============================================================== */}
        <div className="mt-8 text-center">
          <p className="text-xs text-text-2">
            Auto-updates every 15 seconds · Last:{' '}
            {lastUpdate.toLocaleTimeString()}
          </p>
          <p className="mt-4 text-xs text-text-2">
            Powered by{' '}
            <span className="font-extrabold tracking-wider text-accent">
              PRESS
            </span>
          </p>
        </div>
      </LayoutContainer>
    </div>
  )
}

// ============================================================================
// Spectator Match Card
// ============================================================================

function SpectatorMatchCard({
  matchInfo,
  isLive,
}: {
  matchInfo: SpectatorMatchInfo
  isLive: boolean
}) {
  const { match, teamANames, teamBNames, roundName } = matchInfo
  const holesRemaining = 18 - match.holes_played
  const isDormie =
    match.current_lead !== 0 &&
    Math.abs(match.current_lead) === holesRemaining

  // Active presses
  const activePresses = match.presses.filter(
    (p) => p.status === 'in_progress'
  )

  // Calculate total exposure
  let totalStake = match.stake_per_man
  for (const press of activePresses) {
    totalStake += press.stake_per_man
  }

  return (
    <Card className="p-4 mb-2">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-2">{roundName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-2 uppercase">
            {match.match_type}
          </span>
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bad opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-bad" />
            </span>
          )}
        </div>
      </div>

      {/* Teams and score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-0 truncate">{teamANames}</p>
          <p className="text-xs text-text-2 mt-0.5">vs</p>
          <p className="font-medium text-text-0 truncate">{teamBNames}</p>
        </div>

        <div className="text-right flex-shrink-0 ml-3">
          {match.status === 'completed' ? (
            <div>
              <Badge variant="gold">{match.final_result}</Badge>
              <p className="text-xs text-text-2 mt-1">
                {match.winner === 'team_a'
                  ? teamANames
                  : match.winner === 'team_b'
                    ? teamBNames
                    : 'Halved'}
              </p>
            </div>
          ) : (
            <div>
              <MatchStatus
                lead={match.current_lead}
                dormie={isDormie}
                size="large"
              />
              <p className="text-xs text-text-2 mt-1">
                thru {match.holes_played} · {holesRemaining} to play
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stakes and presses */}
      <div className="flex items-center justify-between pt-2 border-t border-stroke/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-2">
            {formatMoney(match.stake_per_man)}/man
          </span>
          {/* Press badges */}
          {activePresses.map((press, idx) => (
            <PressStatus
              key={press.id}
              pressNumber={idx + 1}
              lead={press.current_lead}
              startingHole={press.starting_hole}
              endingHole={press.ending_hole}
            />
          ))}
        </div>

        {/* Total at stake */}
        {activePresses.length > 0 && (
          <span className="text-xs font-medium text-accent">
            {formatMoney(totalStake)}/man total
          </span>
        )}
      </div>

      {/* Dormie alert */}
      {isDormie && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full border animate-pulse bg-gold/20 text-gold border-gold/40 text-xs font-bold uppercase tracking-wider">
            Dormie
          </span>
        </div>
      )}
    </Card>
  )
}
