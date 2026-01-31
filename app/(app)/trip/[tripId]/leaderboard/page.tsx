'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { LeaderboardRow } from '@/components/ui/LeaderboardRow'
import { getTripLeaderboardAction } from '@/lib/supabase/leaderboard-actions'
import { getTripFormatStandingsAction } from '@/lib/supabase/format-actions'
import { getRoundsAction } from '@/lib/supabase/round-actions'
import type { LeaderboardEntry, TripLeaderboard } from '@/lib/supabase/leaderboard-actions'
import type { DbRoundWithTee } from '@/lib/supabase/types'
import type { TripFormatStandings } from '@/lib/format-types'
import { getScrambleRoundResultsAction } from '@/lib/supabase/scramble-actions'
import type { ScrambleRoundResult } from '@/lib/supabase/scramble-actions'

type ScoringMode = 'net' | 'gross' | 'format' | 'scramble'

export default function LeaderboardPage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [leaderboard, setLeaderboard] = useState<TripLeaderboard>({
    entries: [],
    par: 72,
    holesTotal: 18,
  })
  const [formatStandings, setFormatStandings] = useState<TripFormatStandings | null>(null)
  const [scrambleResults, setScrambleResults] = useState<ScrambleRoundResult[]>([])
  const [rounds, setRounds] = useState<DbRoundWithTee[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | undefined>()
  const [scoringMode, setScoringMode] = useState<ScoringMode>('net')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadData = async () => {
    const [leaderboardResult, roundsResult, formatResult, scrambleResult] = await Promise.all([
      getTripLeaderboardAction(tripId, selectedRoundId),
      getRoundsAction(tripId),
      getTripFormatStandingsAction(tripId),
      getScrambleRoundResultsAction(tripId),
    ])

    if (leaderboardResult.leaderboard) {
      setLeaderboard(leaderboardResult.leaderboard)
    }
    if (roundsResult.rounds) {
      setRounds(roundsResult.rounds)
    }
    if (formatResult.standings) {
      setFormatStandings(formatResult.standings)
    }
    if (scrambleResult.results) {
      setScrambleResults(scrambleResult.results)
    }
    setLastUpdate(new Date())
    setLoading(false)
  }

  // Initial load
  useEffect(() => {
    loadData()
  }, [tripId, selectedRoundId])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [tripId, selectedRoundId])

  // Check if there are format rounds
  const hasFormatRounds = formatStandings &&
    (formatStandings.pointsHiLoRoundCount > 0 || formatStandings.stablefordRoundCount > 0)
  const hasScrambleRounds = scrambleResults.length > 0

  const scoringTabs = [
    { id: 'net', label: 'Net' },
    { id: 'gross', label: 'Gross' },
    ...(hasFormatRounds ? [{ id: 'format', label: 'Format' }] : []),
    ...(hasScrambleRounds ? [{ id: 'scramble', label: 'Scramble' }] : []),
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
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading leaderboard...</div>
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            href={`/trip/${tripId}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            Back to trip
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">
            Leaderboard
          </h1>
        </div>
        <Badge variant="live">
          Live
        </Badge>
      </div>

      {/* Round filter */}
      {rounds.length > 1 && (
        <div className="mb-4">
          <select
            value={selectedRoundId || ''}
            onChange={(e) => setSelectedRoundId(e.target.value || undefined)}
            className="w-full rounded-button border border-stroke bg-bg-1 px-4 py-2 text-text-0 focus:border-accent focus:outline-none"
          >
            <option value="">All Rounds</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scoring mode tabs */}
      <div className="mb-4">
        <Tabs
          tabs={scoringTabs}
          activeTab={scoringMode}
          onChange={(tab) => setScoringMode(tab as ScoringMode)}
        />
      </div>

      {/* Leaderboard content based on mode */}
      {scoringMode === 'scramble' ? (
        <ScrambleResultsView results={scrambleResults} />
      ) : scoringMode === 'format' ? (
        <FormatStandingsView standings={formatStandings} />
      ) : entriesWithPosition.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-2">No scores yet</p>
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

      {/* Last update */}
      <div className="mt-4 text-center text-xs text-text-2">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </div>
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

/**
 * Format standings view for Points Hi/Lo and Stableford
 * Shows player totals across all format rounds (teams rotate, players accumulate)
 */
function FormatStandingsView({ standings }: { standings: TripFormatStandings | null }) {
  if (!standings) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text-2">No format rounds played</p>
      </Card>
    )
  }

  const hasPointsHiLo = standings.pointsHiLoRoundCount > 0
  const hasStableford = standings.stablefordRoundCount > 0

  if (!hasPointsHiLo && !hasStableford) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text-2">No format rounds played</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Points Hi/Lo standings */}
      {hasPointsHiLo && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-text-0">Points (Hi/Lo)</h3>
            <span className="text-xs text-text-2">
              {standings.pointsHiLoRoundCount} round{standings.pointsHiLoRoundCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {standings.pointsHiLo.map((player, idx) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between py-2 border-b border-stroke/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-medium text-text-2">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-text-0">{player.playerName}</span>
                </div>
                <span className="font-display font-bold text-accent">
                  {player.total % 1 === 0 ? player.total : player.total.toFixed(1)} pts
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stableford standings */}
      {hasStableford && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-text-0">Stableford</h3>
            <span className="text-xs text-text-2">
              {standings.stablefordRoundCount} round{standings.stablefordRoundCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {standings.stableford.map((player, idx) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between py-2 border-b border-stroke/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-medium text-text-2">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-text-0">{player.playerName}</span>
                </div>
                <span className="font-display font-bold text-accent">
                  {player.total} pts
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Explanation */}
      <p className="text-center text-xs text-text-2">
        Player totals across all rounds (teams rotate each round)
      </p>
    </div>
  )
}

/**
 * Scramble results view — shows team scores for scramble rounds
 */
function ScrambleResultsView({ results }: { results: ScrambleRoundResult[] }) {
  if (results.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text-2">No scramble rounds played</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {results.map((result) => {
        const formatToPar = (toPar: number) =>
          toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`

        return (
          <Card key={result.roundId} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-text-0">
                {result.roundName}
              </h3>
              <Badge variant={result.status === 'completed' ? 'default' : 'live'}>
                {result.status === 'completed' ? 'Final' : 'Live'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Team 1 */}
              <div
                className={cn(
                  'rounded-card-sm border p-3 text-center',
                  result.winner === 'team1'
                    ? 'border-good/50 bg-good/5'
                    : 'border-stroke bg-bg-2'
                )}
              >
                <div className="font-display text-sm font-bold text-text-0 mb-1">
                  Team 1
                </div>
                <div className="text-[11px] text-text-2 mb-2 truncate">
                  {result.team1Players.join(', ')}
                </div>
                <div className="font-display text-2xl font-bold text-text-0">
                  {result.team1Total}
                </div>
                {result.team1ToPar !== undefined && (
                  <div
                    className={cn(
                      'text-xs font-display font-bold mt-1',
                      result.team1ToPar < 0
                        ? 'text-good'
                        : result.team1ToPar > 0
                          ? 'text-bad'
                          : 'text-text-2'
                    )}
                  >
                    {formatToPar(result.team1ToPar)}
                  </div>
                )}
                {result.winner === 'team1' && (
                  <div className="mt-1 text-xs text-good font-medium">Winner</div>
                )}
              </div>

              {/* Team 2 */}
              <div
                className={cn(
                  'rounded-card-sm border p-3 text-center',
                  result.winner === 'team2'
                    ? 'border-good/50 bg-good/5'
                    : 'border-stroke bg-bg-2'
                )}
              >
                <div className="font-display text-sm font-bold text-text-0 mb-1">
                  Team 2
                </div>
                <div className="text-[11px] text-text-2 mb-2 truncate">
                  {result.team2Players.join(', ')}
                </div>
                <div className="font-display text-2xl font-bold text-text-0">
                  {result.team2Total}
                </div>
                {result.team2ToPar !== undefined && (
                  <div
                    className={cn(
                      'text-xs font-display font-bold mt-1',
                      result.team2ToPar < 0
                        ? 'text-good'
                        : result.team2ToPar > 0
                          ? 'text-bad'
                          : 'text-text-2'
                    )}
                  >
                    {formatToPar(result.team2ToPar)}
                  </div>
                )}
                {result.winner === 'team2' && (
                  <div className="mt-1 text-xs text-good font-medium">Winner</div>
                )}
              </div>
            </div>

            {result.winner === 'tied' && (
              <div className="mt-2 text-center text-sm text-gold font-medium">
                Tied
              </div>
            )}
            {result.margin > 0 && result.winner !== 'tied' && (
              <div className="mt-2 text-center text-xs text-text-2">
                Won by {result.margin} stroke{result.margin !== 1 ? 's' : ''}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
