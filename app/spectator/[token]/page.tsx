'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { LeaderboardRow } from '@/components/ui/LeaderboardRow'
import { MatchStatus } from '@/components/match'
import { getSpectatorLeaderboardAction } from '@/lib/supabase/leaderboard-actions'
import { getSpectatorMatchAction } from '@/lib/supabase/match-actions'
import { formatMoney } from '@/lib/match-utils'
import type { LeaderboardEntry, TripLeaderboard } from '@/lib/supabase/leaderboard-actions'
import type { DbMatchWithPresses } from '@/lib/supabase/match-types'

type ScoringMode = 'net' | 'gross'

export default function SpectatorPage() {
  const params = useParams()
  const token = params.token as string

  const [trip, setTrip] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [leaderboard, setLeaderboard] = useState<TripLeaderboard>({
    entries: [],
    par: 72,
    holesTotal: 18,
  })
  const [match, setMatch] = useState<DbMatchWithPresses | null>(null)
  const [matchTeamNames, setMatchTeamNames] = useState<{ teamA: string; teamB: string }>({ teamA: '', teamB: '' })
  const [scoringMode, setScoringMode] = useState<ScoringMode>('net')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadData = async () => {
    const [leaderboardResult, matchResult] = await Promise.all([
      getSpectatorLeaderboardAction(token),
      getSpectatorMatchAction(token),
    ])

    if (leaderboardResult.error) {
      setError(leaderboardResult.error)
    } else {
      setTrip(leaderboardResult.trip || null)
      setLeaderboard(leaderboardResult.leaderboard)
      setError(null)
    }

    // Set match data if available
    if (matchResult.match) {
      setMatch(matchResult.match)
      setMatchTeamNames({ teamA: matchResult.teamANames, teamB: matchResult.teamBNames })
    }

    setLastUpdate(new Date())
    setLoading(false)
  }

  // Initial load
  useEffect(() => {
    loadData()
  }, [token])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [token])

  const scoringTabs = [
    { id: 'net', label: 'Net' },
    { id: 'gross', label: 'Gross' },
  ]

  // Sort entries based on scoring mode
  const sortedEntries = [...leaderboard.entries].sort((a, b) => {
    if (scoringMode === 'net') {
      return a.netTotal - b.netTotal
    }
    return a.grossTotal - b.grossTotal
  })

  // Recalculate positions based on current sort
  let currentPosition = 1
  const entriesWithPosition = sortedEntries.map((entry, idx) => {
    const compareValue = scoringMode === 'net' ? entry.netTotal : entry.grossTotal
    const prevValue = idx > 0
      ? (scoringMode === 'net' ? sortedEntries[idx - 1].netTotal : sortedEntries[idx - 1].grossTotal)
      : null

    if (idx > 0 && compareValue > prevValue!) {
      currentPosition = idx + 1
    }

    return {
      ...entry,
      displayPosition: currentPosition,
    }
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-0">
        <div className="text-text-2">Loading leaderboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-0 px-4">
        <Card className="max-w-md p-8 text-center">
          <div className="mb-4 text-4xl opacity-50">
            <span role="img" aria-label="error">⛳</span>
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

  return (
    <div className="min-h-screen bg-bg-0 pb-8">
      <LayoutContainer className="py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <Badge variant="live" className="mb-2">
            Live Leaderboard
          </Badge>
          <h1 className="font-display text-2xl font-bold text-text-0">
            {trip?.name || 'Press'}
          </h1>
          {trip?.description && (
            <p className="mt-1 text-text-2">{trip.description}</p>
          )}
        </div>

        {/* Scoring mode tabs */}
        <div className="mb-4">
          <Tabs
            tabs={scoringTabs}
            activeTab={scoringMode}
            onChange={(tab) => setScoringMode(tab as ScoringMode)}
          />
        </div>

        {/* Leaderboard */}
        {entriesWithPosition.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mb-4 text-4xl opacity-50">
              <span role="img" aria-label="golf">🏌️</span>
            </div>
            <p className="text-text-2">No scores yet</p>
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
                score={scoringMode === 'net' ? entry.netTotal : entry.grossTotal}
                netScore={entry.netTotal}
                grossScore={entry.grossTotal}
                showNet={scoringMode === 'net'}
                delta={entry.scoreToPar}
                thru={entry.thru}
                badges={entry.playingHandicap !== null ? [
                  { text: `HCP ${entry.playingHandicap}`, variant: 'default' as const }
                ] : []}
              />
            ))}
          </Card>
        )}

        {/* Match Status (if exists) */}
        {match && (
          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-text-0">Match</h2>
              {match.status === 'in_progress' && (
                <Badge variant="live">Live</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm">
                  <span className="font-medium text-text-0">{matchTeamNames.teamA}</span>
                  <span className="text-text-2 mx-2">vs</span>
                  <span className="font-medium text-text-0">{matchTeamNames.teamB}</span>
                </div>
                <div className="text-xs text-text-2 mt-1">
                  {match.match_type.toUpperCase()} • {formatMoney(match.stake_per_man)}/man
                  {match.presses.length > 0 && ` • ${match.presses.length} press${match.presses.length > 1 ? 'es' : ''}`}
                </div>
              </div>
              <div className="text-right">
                {match.status === 'completed' ? (
                  <Badge variant="gold">{match.final_result}</Badge>
                ) : (
                  <>
                    <MatchStatus lead={match.current_lead} />
                    <div className="text-xs text-text-2 mt-0.5">
                      thru {match.holes_played}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Last update */}
        <div className="mt-6 text-center text-xs text-text-2">
          Auto-updates every 10 seconds
          <br />
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>

        {/* Powered by footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-text-2">
            Powered by <span className="font-extrabold tracking-wider text-accent">PRESS</span>
          </p>
        </div>
      </LayoutContainer>
    </div>
  )
}
