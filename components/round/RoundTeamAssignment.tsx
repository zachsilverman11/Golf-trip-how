'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { updateTeamAssignmentsAction } from '@/lib/supabase/round-actions'

interface Player {
  id: string
  name: string
  handicap: number | null
  currentTeam: 1 | 2 | null
}

interface RoundTeamAssignmentProps {
  roundId: string
  tripId: string
  players: Player[]
  format: string
  status: string
  className?: string
}

/**
 * Team assignment component for Points Hi/Lo rounds
 * Shows on the round detail page when format is points_hilo
 */
export function RoundTeamAssignment({
  roundId,
  tripId,
  players,
  format,
  status,
  className,
}: RoundTeamAssignmentProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Record<string, 1 | 2>>({})
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize assignments from current data
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
      setHasChanges(true)
    }
  }, [players, assignments])

  const toggleTeam = useCallback((playerId: string) => {
    setAssignments((prev) => {
      const currentTeam = prev[playerId]
      const newTeam: 1 | 2 = currentTeam === 1 ? 2 : 1

      // Check if target team has room
      const targetTeamCount = Object.values(prev).filter((t) => t === newTeam).length
      if (targetTeamCount >= 2) {
        return prev // Can't move, target team is full
      }

      setHasChanges(true)
      return {
        ...prev,
        [playerId]: newTeam,
      }
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const result = await updateTeamAssignmentsAction(roundId, tripId, assignments)
    if (result.success) {
      setHasChanges(false)
      router.refresh()
    }
    setSaving(false)
  }

  // Only show for Points Hi/Lo format
  if (format !== 'points_hilo') {
    return null
  }

  // Must have exactly 4 players
  if (players.length !== 4) {
    return (
      <Card className={cn('p-4', className)}>
        <h2 className="font-display text-lg font-bold text-text-0 mb-2">
          Team Assignment
        </h2>
        <p className="text-bad text-sm">
          Points Hi/Lo requires exactly 4 players ({players.length} currently)
        </p>
      </Card>
    )
  }

  const team1Players = players.filter((p) => assignments[p.id] === 1)
  const team2Players = players.filter((p) => assignments[p.id] === 2)
  const isValid = team1Players.length === 2 && team2Players.length === 2

  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-text-0">
            Team Assignment
          </h2>
          <p className="text-sm text-text-2 mt-0.5">
            Tap a player to swap teams
          </p>
        </div>
        {hasChanges && (
          <Button
            size="default"
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? 'Saving...' : 'Save Teams'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Team 1 */}
        <div
          className={cn(
            'rounded-card-sm border-2 p-3',
            team1Players.length === 2
              ? 'border-good/50 bg-good/5'
              : 'border-stroke bg-bg-2'
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-text-0">Team 1</span>
            <span
              className={cn(
                'text-xs font-medium',
                team1Players.length === 2 ? 'text-good' : 'text-text-2'
              )}
            >
              {team1Players.length}/2
            </span>
          </div>
          <div className="space-y-2">
            {team1Players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => toggleTeam(player.id)}
                disabled={status === 'completed'}
                className={cn(
                  'w-full rounded-button border border-stroke bg-bg-1 px-3 py-2',
                  'text-left text-sm transition-colors',
                  status !== 'completed' && 'hover:border-accent/50 hover:bg-bg-2',
                  status === 'completed' && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span className="font-medium text-text-0">{player.name}</span>
                {player.handicap !== null && (
                  <span className="ml-2 text-text-2">({player.handicap})</span>
                )}
              </button>
            ))}
            {team1Players.length < 2 && (
              <div className="rounded-button border border-dashed border-stroke px-3 py-2 text-center text-sm text-text-2">
                Need {2 - team1Players.length} more
              </div>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div
          className={cn(
            'rounded-card-sm border-2 p-3',
            team2Players.length === 2
              ? 'border-gold/50 bg-gold/5'
              : 'border-stroke bg-bg-2'
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-text-0">Team 2</span>
            <span
              className={cn(
                'text-xs font-medium',
                team2Players.length === 2 ? 'text-gold' : 'text-text-2'
              )}
            >
              {team2Players.length}/2
            </span>
          </div>
          <div className="space-y-2">
            {team2Players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => toggleTeam(player.id)}
                disabled={status === 'completed'}
                className={cn(
                  'w-full rounded-button border border-stroke bg-bg-1 px-3 py-2',
                  'text-left text-sm transition-colors',
                  status !== 'completed' && 'hover:border-accent/50 hover:bg-bg-2',
                  status === 'completed' && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span className="font-medium text-text-0">{player.name}</span>
                {player.handicap !== null && (
                  <span className="ml-2 text-text-2">({player.handicap})</span>
                )}
              </button>
            ))}
            {team2Players.length < 2 && (
              <div className="rounded-button border border-dashed border-stroke px-3 py-2 text-center text-sm text-text-2">
                Need {2 - team2Players.length} more
              </div>
            )}
          </div>
        </div>
      </div>

      {!isValid && (
        <p className="mt-3 text-center text-sm text-bad">
          Each team must have exactly 2 players
        </p>
      )}

      {status === 'completed' && (
        <p className="mt-3 text-center text-xs text-text-2">
          Teams are locked for completed rounds
        </p>
      )}
    </Card>
  )
}
