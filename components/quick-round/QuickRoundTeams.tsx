'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { QuickRoundPlayer } from '@/hooks/useQuickRoundDraft'

interface QuickRoundTeamsProps {
  players: QuickRoundPlayer[]
  teamAssignments: Record<string, 1 | 2>
  onTeamAssignmentsChange: (assignments: Record<string, 1 | 2>) => void
  className?: string
}

export function QuickRoundTeams({
  players,
  teamAssignments,
  onTeamAssignmentsChange,
  className,
}: QuickRoundTeamsProps) {
  const team1Players = players.filter(p => teamAssignments[p.id] === 1)
  const team2Players = players.filter(p => teamAssignments[p.id] === 2)

  // Swap a player to the other team
  const handlePlayerTap = useCallback((playerId: string) => {
    const currentTeam = teamAssignments[playerId]
    const targetTeam = currentTeam === 1 ? 2 : 1

    // Check if target team already has 2 players
    const targetCount = Object.values(teamAssignments).filter(t => t === targetTeam).length
    if (targetCount >= 2) {
      // Find a player from target team to swap
      const playerToSwap = players.find(p => teamAssignments[p.id] === targetTeam)
      if (playerToSwap) {
        onTeamAssignmentsChange({
          ...teamAssignments,
          [playerId]: targetTeam,
          [playerToSwap.id]: currentTeam,
        })
      }
    } else {
      onTeamAssignmentsChange({
        ...teamAssignments,
        [playerId]: targetTeam,
      })
    }
  }, [players, teamAssignments, onTeamAssignmentsChange])

  // Randomize team assignments
  const handleRandomize = useCallback(() => {
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const newAssignments: Record<string, 1 | 2> = {}
    shuffled.forEach((player, idx) => {
      newAssignments[player.id] = idx < 2 ? 1 : 2
    })
    onTeamAssignmentsChange(newAssignments)
  }, [players, onTeamAssignmentsChange])

  // Reset to default (first 2 -> Team A, next 2 -> Team B)
  const handleReset = useCallback(() => {
    const newAssignments: Record<string, 1 | 2> = {}
    players.forEach((player, idx) => {
      newAssignments[player.id] = idx < 2 ? 1 : 2
    })
    onTeamAssignmentsChange(newAssignments)
  }, [players, onTeamAssignmentsChange])

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-text-1">
          Teams
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRandomize}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-text-1 hover:text-text-0 hover:bg-bg-2 rounded-button transition-colors"
          >
            <ShuffleIcon className="h-4 w-4" />
            Randomize
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-text-1 hover:text-text-0 hover:bg-bg-2 rounded-button transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Team A */}
        <div className="rounded-card bg-bg-2 p-3 border border-stroke">
          <div className="text-xs font-medium text-text-2 mb-2 uppercase tracking-wide">
            Team A
          </div>
          <div className="space-y-2">
            {team1Players.map(player => (
              <button
                key={player.id}
                type="button"
                onClick={() => handlePlayerTap(player.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-button',
                  'bg-accent/10 border border-accent/30 text-text-0',
                  'hover:bg-accent/20 transition-colors',
                  'active:scale-[0.98]'
                )}
              >
                <span className="font-medium">{player.name}</span>
                {player.handicap !== null && (
                  <span className="ml-1 text-text-2 text-sm">({player.handicap})</span>
                )}
              </button>
            ))}
            {team1Players.length === 0 && (
              <div className="text-sm text-text-2 py-2 text-center">
                Tap to move
              </div>
            )}
          </div>
        </div>

        {/* Team B */}
        <div className="rounded-card bg-bg-2 p-3 border border-stroke">
          <div className="text-xs font-medium text-text-2 mb-2 uppercase tracking-wide">
            Team B
          </div>
          <div className="space-y-2">
            {team2Players.map(player => (
              <button
                key={player.id}
                type="button"
                onClick={() => handlePlayerTap(player.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-button',
                  'bg-good/10 border border-good/30 text-text-0',
                  'hover:bg-good/20 transition-colors',
                  'active:scale-[0.98]'
                )}
              >
                <span className="font-medium">{player.name}</span>
                {player.handicap !== null && (
                  <span className="ml-1 text-text-2 text-sm">({player.handicap})</span>
                )}
              </button>
            ))}
            {team2Players.length === 0 && (
              <div className="text-sm text-text-2 py-2 text-center">
                Tap to move
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-text-2 text-center">
        Tap a player to swap teams
      </p>
    </div>
  )
}

function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}
