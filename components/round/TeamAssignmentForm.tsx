'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import type { DbPlayer } from '@/lib/supabase/types'

interface TeamAssignmentFormProps {
  players: DbPlayer[]
  assignments: Record<string, 1 | 2>
  onChange: (assignments: Record<string, 1 | 2>) => void
  className?: string
}

/**
 * Team assignment form for Points Hi/Lo and Stableford formats
 * Requires exactly 4 players with 2 per team
 */
export function TeamAssignmentForm({
  players,
  assignments,
  onChange,
  className,
}: TeamAssignmentFormProps) {
  // Auto-assign teams on first load if not already assigned
  useEffect(() => {
    if (players.length === 4 && Object.keys(assignments).length === 0) {
      // Default: first 2 players on Team 1, last 2 on Team 2
      const defaultAssignments: Record<string, 1 | 2> = {}
      players.forEach((player, index) => {
        defaultAssignments[player.id] = index < 2 ? 1 : 2
      })
      onChange(defaultAssignments)
    }
  }, [players, assignments, onChange])

  const team1Players = players.filter(p => assignments[p.id] === 1)
  const team2Players = players.filter(p => assignments[p.id] === 2)

  const toggleTeam = (playerId: string) => {
    const currentTeam = assignments[playerId]
    const newTeam = currentTeam === 1 ? 2 : 1

    // Check if we can move to the other team (max 2 per team)
    const targetTeamCount = players.filter(p => assignments[p.id] === newTeam).length
    if (targetTeamCount >= 2) {
      return // Can't move, target team is full
    }

    onChange({
      ...assignments,
      [playerId]: newTeam,
    })
  }

  const isValid = team1Players.length === 2 && team2Players.length === 2

  // Show error if not exactly 4 players
  if (players.length !== 4) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-center py-4">
          <p className="text-bad font-medium">Team formats require exactly 4 players</p>
          <p className="text-text-2 text-sm mt-1">
            Currently have {players.length} player{players.length !== 1 ? 's' : ''}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-text-0">
          Team Assignment
        </h2>
        <p className="text-sm text-text-2 mt-1">
          Tap a player to swap teams (2 per team required)
        </p>
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
                className={cn(
                  'w-full rounded-button border border-stroke bg-bg-1 px-3 py-2',
                  'text-left text-sm transition-colors',
                  'hover:border-accent/50 hover:bg-bg-2'
                )}
              >
                <span className="font-medium text-text-0">{player.name}</span>
                {player.handicap_index !== null && (
                  <span className="ml-2 text-text-2">({player.handicap_index})</span>
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
                className={cn(
                  'w-full rounded-button border border-stroke bg-bg-1 px-3 py-2',
                  'text-left text-sm transition-colors',
                  'hover:border-accent/50 hover:bg-bg-2'
                )}
              >
                <span className="font-medium text-text-0">{player.name}</span>
                {player.handicap_index !== null && (
                  <span className="ml-2 text-text-2">({player.handicap_index})</span>
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
    </Card>
  )
}

/**
 * Validate team assignments
 */
export function isTeamAssignmentValid(
  players: DbPlayer[],
  assignments: Record<string, 1 | 2>
): boolean {
  if (players.length !== 4) return false

  const team1Count = players.filter(p => assignments[p.id] === 1).length
  const team2Count = players.filter(p => assignments[p.id] === 2).length

  return team1Count === 2 && team2Count === 2
}
