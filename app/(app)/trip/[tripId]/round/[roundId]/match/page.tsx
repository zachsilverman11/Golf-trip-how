'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { MatchStatus, PressStatus, PressButton } from '@/components/match'
import { getMatchStateAction, syncMatchStateAction, updateMatchStakesAction } from '@/lib/supabase/match-actions'
import { formatMoney, formatTeamNames, calculateExposure, formatMatchStatus } from '@/lib/match-utils'
import type { MatchState, ComputedHoleResult } from '@/lib/supabase/match-types'
import { cn } from '@/lib/utils'

export default function MatchPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const roundId = params.roundId as string

  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingStake, setEditingStake] = useState(false)
  const [newStake, setNewStake] = useState<number>(1)

  // Load match state
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getMatchStateAction(roundId)

        if (!result.success || !result.state) {
          console.error('Failed to load match:', result.error)
          setError(result.error || 'No match found for this round')
          setLoading(false)
          return
        }

        setMatchState(result.state)
        setNewStake(result.state.stakePerMan)
      } catch (err) {
        console.error('Failed to load match:', err)
        setError('An unexpected error occurred')
      }
      setLoading(false)
    }

    loadData()
  }, [roundId])

  // Refresh match state
  const refreshMatchState = useCallback(async () => {
    if (!matchState) return

    await syncMatchStateAction(matchState.matchId)
    const result = await getMatchStateAction(roundId)

    if (result.success && result.state) {
      setMatchState(result.state)
    }
  }, [roundId, matchState])

  // Update stake
  const handleUpdateStake = async () => {
    if (!matchState || newStake <= 0) return

    const result = await updateMatchStakesAction({
      matchId: matchState.matchId,
      stakePerMan: newStake,
    })

    if (result.success) {
      await refreshMatchState()
      setEditingStake(false)
    }
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading match...</div>
      </LayoutContainer>
    )
  }

  if (error || !matchState) {
    return (
      <LayoutContainer className="py-6">
        <ErrorCard
          title="Match Not Available"
          message={error || 'No match found for this round. The match may not have been set up yet.'}
          backHref={`/trip/${tripId}/round/${roundId}`}
          backLabel="Back to Round"
        />
        <div className="mt-4">
          <Link href={`/trip/${tripId}/round/${roundId}/match/setup`}>
            <Button variant="secondary" className="w-full">
              Set Up Money Game
            </Button>
          </Link>
        </div>
      </LayoutContainer>
    )
  }

  const exposure = calculateExposure(matchState)
  const teamANames = formatTeamNames(matchState.teamA)
  const teamBNames = formatTeamNames(matchState.teamB)

  // Current hole (next hole to play or last hole)
  const currentHole = matchState.holesPlayed + 1

  return (
    <LayoutContainer className="py-4">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/trip/${tripId}/round/${roundId}/score`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to scoring
        </Link>
        <h1 className="font-display text-xl font-bold text-text-0">
          Match Details
        </h1>
      </div>

      {/* Teams & Status */}
      <Card className="p-4 mb-4">
        <div className="text-center mb-4">
          <div className="text-sm text-text-2 mb-2">
            {matchState.matchType.toUpperCase()} Match
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 text-right">
              <div className="font-medium text-text-0">{teamANames}</div>
              <div className="text-xs text-text-2">Team A</div>
            </div>
            <div className="text-xl font-bold text-text-2">vs</div>
            <div className="flex-1 text-left">
              <div className="font-medium text-text-0">{teamBNames}</div>
              <div className="text-xs text-text-2">Team B</div>
            </div>
          </div>
        </div>

        {/* Main Status */}
        <div className="text-center">
          {matchState.status === 'completed' ? (
            <div className="py-4">
              <Badge variant="gold" className="text-lg px-4 py-2">
                {matchState.finalResult}
              </Badge>
              <div className="mt-2 text-sm text-text-2">
                Winner: Team {matchState.winner === 'team_a' ? 'A' : matchState.winner === 'team_b' ? 'B' : 'Halved'}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <MatchStatus lead={matchState.currentLead} size="large" />
              <div className="mt-2 text-sm text-text-2">
                thru {matchState.holesPlayed} • {matchState.holesRemaining} to play
                {matchState.isDormie && (
                  <Badge variant="gold" className="ml-2">Dormie</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stakes & Exposure */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-text-0">Stakes</h2>
          {!editingStake && matchState.status === 'in_progress' && (
            <Button
              variant="secondary"
              size="default"
              onClick={() => setEditingStake(true)}
            >
              Edit Stakes
            </Button>
          )}
        </div>

        {editingStake ? (
          <div className="flex items-center gap-2">
            <span className="text-text-1">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={newStake}
              onChange={(e) => setNewStake(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-3 py-2 rounded-lg bg-bg-2 border border-stroke text-text-0 text-center"
            />
            <span className="text-text-2">per man</span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="default" onClick={() => setEditingStake(false)}>
                Cancel
              </Button>
              <Button size="default" onClick={handleUpdateStake}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-2">Main match</span>
              <span className="text-text-0 font-medium">
                {formatMoney(matchState.stakePerMan)}/man
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-2">Total exposure</span>
              <span className="text-text-0 font-bold">
                {formatMoney(exposure.totalExposure)}
              </span>
            </div>
            {exposure.currentPosition !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-2">Current position</span>
                <span className={cn(
                  'font-bold',
                  exposure.currentPosition > 0 ? 'text-good' : 'text-bad'
                )}>
                  {exposure.currentPosition > 0 ? '+' : ''}{formatMoney(exposure.currentPosition)}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Presses */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-text-0">Presses</h2>
          {matchState.status === 'in_progress' && !matchState.isMatchClosed && (
            <PressButton
              matchId={matchState.matchId}
              currentHole={currentHole}
              onPressAdded={refreshMatchState}
            />
          )}
        </div>

        {matchState.presses.length === 0 ? (
          <p className="text-sm text-text-2">No presses yet</p>
        ) : (
          <div className="space-y-2">
            {matchState.presses.map((press) => (
              <div
                key={press.id}
                className="flex items-center justify-between bg-bg-2 rounded-lg p-3"
              >
                <div>
                  <div className="font-medium text-text-0 text-sm">
                    Press {press.pressNumber}
                  </div>
                  <div className="text-xs text-text-2">
                    from hole {press.startingHole} • {formatMoney(press.stakePerMan)}/man
                  </div>
                </div>
                <div className="text-right">
                  {press.status === 'completed' ? (
                    <Badge variant="gold">{press.finalResult}</Badge>
                  ) : (
                    <PressStatus pressNumber={press.pressNumber} lead={press.currentLead} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Hole-by-Hole Timeline */}
      <Card className="p-4">
        <h2 className="font-display font-bold text-text-0 mb-3">Timeline</h2>

        <div className="grid grid-cols-2 gap-2">
          {matchState.holeResults.map((result) => (
            <HoleResultRow key={result.holeNumber} result={result} />
          ))}
        </div>
      </Card>
    </LayoutContainer>
  )
}

function HoleResultRow({ result }: { result: ComputedHoleResult }) {
  const hasScores = result.teamANetScore !== null && result.teamBNetScore !== null

  return (
    <div
      className={cn(
        'flex items-center justify-between py-1.5 px-2 rounded text-xs',
        result.winner === 'team_a' && 'bg-good/10',
        result.winner === 'team_b' && 'bg-bad/10',
        result.winner === 'halved' && 'bg-bg-2',
        !hasScores && 'opacity-40'
      )}
    >
      <span className="text-text-2 font-medium">H{result.holeNumber}</span>
      {hasScores ? (
        <>
          <span className="text-text-1">
            {result.teamANetScore}/{result.teamBNetScore}
          </span>
          <span
            className={cn(
              'font-bold',
              result.winner === 'team_a' && 'text-good',
              result.winner === 'team_b' && 'text-bad',
              result.winner === 'halved' && 'text-text-2'
            )}
          >
            {result.cumulativeLead > 0 && '+'}
            {result.cumulativeLead === 0 ? 'A/S' : result.cumulativeLead}
          </span>
        </>
      ) : (
        <span className="text-text-2">-</span>
      )}
    </div>
  )
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
