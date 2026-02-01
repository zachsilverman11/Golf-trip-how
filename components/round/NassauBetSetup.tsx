'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createNassauBetAction } from '@/lib/supabase/nassau-actions'

interface Player {
  id: string
  name: string
  handicap: number | null
  currentTeam: 1 | 2 | null
}

interface NassauBetSetupProps {
  roundId: string
  tripId: string
  players: Player[]
  status: string
  hasExistingBet?: boolean
  className?: string
}

/**
 * Nassau bet setup component for the round detail page.
 * Shows when format is 'nassau' and no nassau_bets row exists yet.
 * Handles team assignment + stake + settings in one card.
 */
export function NassauBetSetup({
  roundId,
  tripId,
  players,
  status,
  hasExistingBet = false,
  className,
}: NassauBetSetupProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Record<string, 1 | 2>>({})
  const [stake, setStake] = useState(10)
  const [autoPress, setAutoPress] = useState(false)
  const [autoPressThreshold, setAutoPressThreshold] = useState(2)
  const [highBallTiebreaker, setHighBallTiebreaker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Initialize assignments from current team data
  useEffect(() => {
    const initial: Record<string, 1 | 2> = {}
    players.forEach((player) => {
      if (player.currentTeam) {
        initial[player.id] = player.currentTeam
      }
    })
    setAssignments(initial)
  }, [players])

  // Auto-assign teams if not set and we have exactly 4 players
  useEffect(() => {
    if (players.length === 4 && Object.keys(assignments).length === 0) {
      const defaultAssignments: Record<string, 1 | 2> = {}
      players.forEach((player, index) => {
        defaultAssignments[player.id] = index < 2 ? 1 : 2
      })
      setAssignments(defaultAssignments)
    }
  }, [players, assignments])

  const toggleTeam = useCallback((playerId: string) => {
    setAssignments((prev) => {
      const currentTeam = prev[playerId]
      const newTeam: 1 | 2 = currentTeam === 1 ? 2 : 1
      const targetTeamCount = Object.values(prev).filter((t) => t === newTeam).length
      if (targetTeamCount >= 2) return prev
      return { ...prev, [playerId]: newTeam }
    })
  }, [])

  const handleCreate = async () => {
    const team1 = players.filter((p) => assignments[p.id] === 1)
    const team2 = players.filter((p) => assignments[p.id] === 2)

    if (team1.length !== 2 || team2.length !== 2) {
      setError('Each team must have exactly 2 players')
      return
    }

    setSaving(true)
    setError(null)

    const result = await createNassauBetAction({
      roundId,
      stakePerMan: stake,
      autoPress,
      autoPressThreshold,
      highBallTiebreaker,
      teamAPlayer1Id: team1[0].id,
      teamAPlayer2Id: team1[1].id,
      teamBPlayer1Id: team2[0].id,
      teamBPlayer2Id: team2[1].id,
    })

    if (result.success) {
      setSuccess(true)
      router.refresh()
    } else {
      setError(result.error || 'Failed to create Nassau bet')
    }

    setSaving(false)
  }

  // Already set up
  if (hasExistingBet || success) {
    return (
      <Card className={cn('p-4 border-good/30 bg-good/5', className)}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-good/20 text-good text-lg">
            ✅
          </div>
          <div>
            <p className="font-medium text-text-0">Nassau bet is set up</p>
            <p className="text-sm text-text-2">
              ${stake}/man per bet · {autoPress ? `Auto-press at ${autoPressThreshold} down` : 'No auto-press'}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // Need exactly 4 players
  if (players.length !== 4) {
    return (
      <Card className={cn('p-4 border-gold/30 bg-gold/5', className)}>
        <div className="flex items-center gap-3">
          <span className="text-gold text-2xl">💰</span>
          <div>
            <p className="font-medium text-text-0">Nassau Bet Setup</p>
            <p className="text-sm text-bad">
              Nassau requires exactly 4 players ({players.length} currently)
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const team1Players = players.filter((p) => assignments[p.id] === 1)
  const team2Players = players.filter((p) => assignments[p.id] === 2)
  const teamsValid = team1Players.length === 2 && team2Players.length === 2

  return (
    <Card className={cn('p-4 border-gold/30 bg-gold/5', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold text-lg">
          💰
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-text-0">
            Nassau Bet Setup
          </h2>
          <p className="text-sm text-text-2">
            3 bets in 1: Front 9 · Back 9 · Overall
          </p>
        </div>
      </div>

      {/* Teams — tap to swap */}
      <div className="mb-4">
        <p className="text-xs text-text-2 uppercase tracking-wider mb-2">
          Teams <span className="normal-case">(tap to swap)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Team A */}
          <div
            className={cn(
              'rounded-card-sm border-2 p-3',
              team1Players.length === 2
                ? 'border-good/50 bg-good/5'
                : 'border-stroke bg-bg-2'
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-text-0 text-sm">Team A</span>
              <span className={cn('text-xs font-medium', team1Players.length === 2 ? 'text-good' : 'text-text-2')}>
                {team1Players.length}/2
              </span>
            </div>
            <div className="space-y-1.5">
              {team1Players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggleTeam(player.id)}
                  disabled={status === 'completed'}
                  className="w-full rounded-button border border-stroke bg-bg-1 px-3 py-2 text-left text-sm hover:border-accent/50 transition-colors"
                >
                  <span className="font-medium text-text-0">{player.name}</span>
                  {player.handicap !== null && (
                    <span className="ml-1.5 text-text-2 text-xs">({player.handicap})</span>
                  )}
                </button>
              ))}
              {team1Players.length < 2 && (
                <div className="rounded-button border border-dashed border-stroke px-3 py-2 text-center text-xs text-text-2">
                  Need {2 - team1Players.length} more
                </div>
              )}
            </div>
          </div>

          {/* Team B */}
          <div
            className={cn(
              'rounded-card-sm border-2 p-3',
              team2Players.length === 2
                ? 'border-gold/50 bg-gold/5'
                : 'border-stroke bg-bg-2'
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-text-0 text-sm">Team B</span>
              <span className={cn('text-xs font-medium', team2Players.length === 2 ? 'text-gold' : 'text-text-2')}>
                {team2Players.length}/2
              </span>
            </div>
            <div className="space-y-1.5">
              {team2Players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggleTeam(player.id)}
                  disabled={status === 'completed'}
                  className="w-full rounded-button border border-stroke bg-bg-1 px-3 py-2 text-left text-sm hover:border-accent/50 transition-colors"
                >
                  <span className="font-medium text-text-0">{player.name}</span>
                  {player.handicap !== null && (
                    <span className="ml-1.5 text-text-2 text-xs">({player.handicap})</span>
                  )}
                </button>
              ))}
              {team2Players.length < 2 && (
                <div className="rounded-button border border-dashed border-stroke px-3 py-2 text-center text-xs text-text-2">
                  Need {2 - team2Players.length} more
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stake */}
      <div className="mb-4">
        <p className="text-xs text-text-2 uppercase tracking-wider mb-2">
          Stake per man (per bet)
        </p>
        <div className="flex items-center gap-2">
          {[5, 10, 20, 25, 50].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setStake(amount)}
              className={cn(
                'flex-1 rounded-button border py-2.5 text-sm font-bold transition-all',
                stake === amount
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke bg-bg-2 text-text-1 hover:border-accent/30'
              )}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="mb-4 space-y-3">
        {/* Auto-press */}
        <button
          type="button"
          onClick={() => setAutoPress(!autoPress)}
          className="flex w-full items-center justify-between rounded-card-sm border border-stroke bg-bg-2 px-3 py-3"
        >
          <div>
            <p className="text-sm font-medium text-text-0 text-left">Auto-Press</p>
            <p className="text-xs text-text-2 text-left">
              New bet starts when {autoPressThreshold} down
            </p>
          </div>
          <div className={cn(
            'h-6 w-11 rounded-full transition-colors relative',
            autoPress ? 'bg-accent' : 'bg-bg-0'
          )}>
            <div className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              autoPress ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </div>
        </button>

        {/* Auto-press threshold */}
        {autoPress && (
          <div className="flex items-center gap-2 px-3">
            <span className="text-sm text-text-2">Press when down by:</span>
            <div className="flex items-center gap-1">
              {[2, 3].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAutoPressThreshold(t)}
                  className={cn(
                    'rounded-button border px-4 py-1.5 text-sm font-bold transition-all',
                    autoPressThreshold === t
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-stroke bg-bg-2 text-text-1'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* High-ball tiebreaker */}
        <button
          type="button"
          onClick={() => setHighBallTiebreaker(!highBallTiebreaker)}
          className="flex w-full items-center justify-between rounded-card-sm border border-stroke bg-bg-2 px-3 py-3"
        >
          <div>
            <p className="text-sm font-medium text-text-0 text-left">High Ball Tiebreaker</p>
            <p className="text-xs text-text-2 text-left">
              If low net ties, best high net wins the hole
            </p>
          </div>
          <div className={cn(
            'h-6 w-11 rounded-full transition-colors relative',
            highBallTiebreaker ? 'bg-accent' : 'bg-bg-0'
          )}>
            <div className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              highBallTiebreaker ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </div>
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="mb-3 text-center text-sm text-bad">{error}</p>
      )}

      {/* Create button */}
      <Button
        size="large"
        onClick={handleCreate}
        disabled={!teamsValid || saving}
        className="w-full"
      >
        {saving ? 'Setting Up...' : `Lock In Nassau · $${stake * 3}/man exposure`}
      </Button>

      <p className="mt-2 text-center text-xs text-text-2/60">
        3 bets × ${stake} = ${stake * 3} total exposure per man
      </p>
    </Card>
  )
}
