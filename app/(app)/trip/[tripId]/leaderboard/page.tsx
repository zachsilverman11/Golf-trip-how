'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { LeaderboardRow } from '@/components/ui/LeaderboardRow'
import { getTripLeaderboardAction } from '@/lib/supabase/leaderboard-actions'
import { getRoundsAction } from '@/lib/supabase/round-actions'
import type { LeaderboardEntry, TripLeaderboard } from '@/lib/supabase/leaderboard-actions'
import type { DbRoundWithTee } from '@/lib/supabase/types'

type ScoringMode = 'net' | 'gross'

export default function LeaderboardPage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [leaderboard, setLeaderboard] = useState<TripLeaderboard>({
    entries: [],
    par: 72,
    holesTotal: 18,
  })
  const [rounds, setRounds] = useState<DbRoundWithTee[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | undefined>()
  const [scoringMode, setScoringMode] = useState<ScoringMode>('net')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadData = async () => {
    const [leaderboardResult, roundsResult] = await Promise.all([
      getTripLeaderboardAction(tripId, selectedRoundId),
      getRoundsAction(tripId),
    ])

    if (leaderboardResult.leaderboard) {
      setLeaderboard(leaderboardResult.leaderboard)
    }
    if (roundsResult.rounds) {
      setRounds(roundsResult.rounds)
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

      {/* Leaderboard */}
      {entriesWithPosition.length === 0 ? (
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
