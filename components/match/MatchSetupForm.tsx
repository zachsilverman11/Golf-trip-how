'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { MatchType, CreateMatchInput } from '@/lib/supabase/match-types'

interface Player {
  id: string
  name: string
}

interface MatchSetupFormProps {
  players: Player[]
  onMatchConfigured: (config: Omit<CreateMatchInput, 'roundId'>) => void
  onCancel: () => void
  className?: string
}

/**
 * Match setup form for round creation
 * Allows selecting match type, teams, and stake
 */
export function MatchSetupForm({
  players,
  onMatchConfigured,
  onCancel,
  className,
}: MatchSetupFormProps) {
  const [matchType, setMatchType] = useState<MatchType>('2v2')
  const [stakePerHole, setStakePerHole] = useState(1)
  const [teamA, setTeamA] = useState<string[]>([])
  const [teamB, setTeamB] = useState<string[]>([])

  // Players not yet assigned to a team
  const unassignedPlayers = useMemo(() => {
    return players.filter(
      (p) => !teamA.includes(p.id) && !teamB.includes(p.id)
    )
  }, [players, teamA, teamB])

  // Required team size based on match type
  const requiredTeamSize = matchType === '1v1' ? 1 : 2

  // Validation
  const isValid =
    teamA.length === requiredTeamSize &&
    teamB.length === requiredTeamSize &&
    stakePerHole > 0

  // Add player to team
  const addToTeam = useCallback(
    (playerId: string, team: 'A' | 'B') => {
      if (team === 'A' && teamA.length < requiredTeamSize) {
        setTeamA([...teamA, playerId])
      } else if (team === 'B' && teamB.length < requiredTeamSize) {
        setTeamB([...teamB, playerId])
      }
    },
    [teamA, teamB, requiredTeamSize]
  )

  // Remove player from team
  const removeFromTeam = useCallback(
    (playerId: string, team: 'A' | 'B') => {
      if (team === 'A') {
        setTeamA(teamA.filter((id) => id !== playerId))
      } else {
        setTeamB(teamB.filter((id) => id !== playerId))
      }
    },
    [teamA, teamB]
  )

  // Handle match type change
  const handleMatchTypeChange = (type: MatchType) => {
    setMatchType(type)
    // Clear teams if switching between 1v1 and 2v2
    setTeamA([])
    setTeamB([])
  }

  // Submit configuration
  const handleSubmit = () => {
    if (!isValid) return

    onMatchConfigured({
      matchType,
      stakePerHole,
      teamAPlayer1Id: teamA[0],
      teamAPlayer2Id: matchType === '2v2' ? teamA[1] : undefined,
      teamBPlayer1Id: teamB[0],
      teamBPlayer2Id: matchType === '2v2' ? teamB[1] : undefined,
    })
  }

  // Get player name by ID
  const getPlayerName = (id: string) => {
    return players.find((p) => p.id === id)?.name || 'Unknown'
  }

  return (
    <Card className={cn('p-4', className)}>
      <h3 className="font-display text-lg font-bold text-text-0 mb-4">
        Match Setup
      </h3>

      {/* Match Type Selector */}
      <div className="mb-4">
        <label className="block text-sm text-text-2 mb-2">Match Type</label>
        <div className="flex gap-2">
          <button
            onClick={() => handleMatchTypeChange('1v1')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
              matchType === '1v1'
                ? 'bg-accent text-bg-0 border-accent'
                : 'bg-bg-2 text-text-1 border-stroke hover:border-accent/50'
            )}
          >
            1 vs 1
          </button>
          <button
            onClick={() => handleMatchTypeChange('2v2')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
              matchType === '2v2'
                ? 'bg-accent text-bg-0 border-accent'
                : 'bg-bg-2 text-text-1 border-stroke hover:border-accent/50'
            )}
          >
            2 vs 2
          </button>
        </div>
        {matchType === '2v2' && (
          <p className="text-xs text-text-2 mt-1">Best ball net format</p>
        )}
      </div>

      {/* Stake Input */}
      <div className="mb-4">
        <label className="block text-sm text-text-2 mb-2">Stake per Hole</label>
        <div className="flex items-center gap-2">
          <span className="text-text-1">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={stakePerHole}
            onChange={(e) => setStakePerHole(Math.max(1, parseInt(e.target.value) || 1))}
            className={cn(
              'w-20 px-3 py-2 rounded-lg bg-bg-2 border border-stroke',
              'text-text-0 text-center font-medium',
              'focus:outline-none focus:border-accent'
            )}
          />
          <span className="text-text-2 text-sm">per hole</span>
        </div>
      </div>

      {/* Team Selection */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Team A */}
        <div>
          <label className="block text-sm text-text-2 mb-2">Team A</label>
          <div className="bg-bg-2 rounded-lg p-2 min-h-[80px] border border-good/30">
            {teamA.length === 0 ? (
              <p className="text-xs text-text-2 text-center py-4">
                Select {requiredTeamSize} player{requiredTeamSize > 1 ? 's' : ''}
              </p>
            ) : (
              <div className="space-y-1">
                {teamA.map((id) => (
                  <div
                    key={id}
                    className="flex items-center justify-between bg-bg-1 rounded px-2 py-1"
                  >
                    <span className="text-sm text-text-0 truncate">
                      {getPlayerName(id)}
                    </span>
                    <button
                      onClick={() => removeFromTeam(id, 'A')}
                      className="text-text-2 hover:text-bad text-xs ml-2"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team B */}
        <div>
          <label className="block text-sm text-text-2 mb-2">Team B</label>
          <div className="bg-bg-2 rounded-lg p-2 min-h-[80px] border border-bad/30">
            {teamB.length === 0 ? (
              <p className="text-xs text-text-2 text-center py-4">
                Select {requiredTeamSize} player{requiredTeamSize > 1 ? 's' : ''}
              </p>
            ) : (
              <div className="space-y-1">
                {teamB.map((id) => (
                  <div
                    key={id}
                    className="flex items-center justify-between bg-bg-1 rounded px-2 py-1"
                  >
                    <span className="text-sm text-text-0 truncate">
                      {getPlayerName(id)}
                    </span>
                    <button
                      onClick={() => removeFromTeam(id, 'B')}
                      className="text-text-2 hover:text-bad text-xs ml-2"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unassigned Players */}
      {unassignedPlayers.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm text-text-2 mb-2">
            Available Players
          </label>
          <div className="flex flex-wrap gap-2">
            {unassignedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-1 bg-bg-2 rounded-full pl-3 pr-1 py-1"
              >
                <span className="text-sm text-text-1">{player.name}</span>
                <div className="flex gap-0.5">
                  {teamA.length < requiredTeamSize && (
                    <button
                      onClick={() => addToTeam(player.id, 'A')}
                      className="w-6 h-6 rounded-full bg-good/20 text-good text-xs font-bold hover:bg-good/30"
                    >
                      A
                    </button>
                  )}
                  {teamB.length < requiredTeamSize && (
                    <button
                      onClick={() => addToTeam(player.id, 'B')}
                      className="w-6 h-6 rounded-full bg-bad/20 text-bad text-xs font-bold hover:bg-bad/30"
                    >
                      B
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1"
        >
          Set Match
        </Button>
      </div>
    </Card>
  )
}

/**
 * Compact match setup toggle for round creation flow
 */
interface MatchSetupToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  matchConfig: Omit<CreateMatchInput, 'roundId'> | null
  onConfigure: () => void
  players: Player[]
  className?: string
}

export function MatchSetupToggle({
  enabled,
  onToggle,
  matchConfig,
  onConfigure,
  players,
  className,
}: MatchSetupToggleProps) {
  const getTeamNames = (ids: (string | undefined)[]) => {
    return ids
      .filter((id): id is string => !!id)
      .map((id) => players.find((p) => p.id === id)?.name || 'Unknown')
      .join(' & ')
  }

  return (
    <div className={cn('bg-bg-1 border border-stroke rounded-card p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-0">Money Game</span>
          <Badge variant="gold">Optional</Badge>
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          className={cn(
            'w-12 h-6 rounded-full transition-colors relative',
            enabled ? 'bg-accent' : 'bg-bg-2 border border-stroke'
          )}
        >
          <span
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              enabled ? 'translate-x-7' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 pt-3 border-t border-stroke/50">
          {matchConfig ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="text-text-1">
                  {matchConfig.matchType.toUpperCase()} - ${matchConfig.stakePerHole}/hole
                </div>
                <div className="text-text-2 text-xs mt-0.5">
                  {getTeamNames([matchConfig.teamAPlayer1Id, matchConfig.teamAPlayer2Id])}
                  {' vs '}
                  {getTeamNames([matchConfig.teamBPlayer1Id, matchConfig.teamBPlayer2Id])}
                </div>
              </div>
              <Button variant="secondary" size="default" onClick={onConfigure}>
                Edit
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={onConfigure} className="w-full">
              Configure Match
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
