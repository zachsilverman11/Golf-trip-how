'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  getWarTeamAssignmentsAction,
  saveWarTeamAssignmentsAction,
} from '@/lib/supabase/war-actions'

interface Player {
  id: string
  name: string
}

interface TripTeamAssignmentProps {
  tripId: string
  players: Player[]
  className?: string
}

export function TripTeamAssignment({
  tripId,
  players,
  className,
}: TripTeamAssignmentProps) {
  const [assignments, setAssignments] = useState<Record<string, 'A' | 'B'>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing assignments
  useEffect(() => {
    const load = async () => {
      const result = await getWarTeamAssignmentsAction(tripId)
      if (result.assignments) {
        const map: Record<string, 'A' | 'B'> = {}
        for (const a of result.assignments) {
          map[a.player_id] = a.team
        }
        setAssignments(map)
      }
      setLoading(false)
    }
    load()
  }, [tripId])

  const assignToTeam = (playerId: string, team: 'A' | 'B') => {
    setAssignments((prev) => ({ ...prev, [playerId]: team }))
    setHasChanges(true)
  }

  const unassign = (playerId: string) => {
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[playerId]
      return next
    })
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const result = await saveWarTeamAssignmentsAction(tripId, assignments)

    if (result.success) {
      setHasChanges(false)
    } else {
      setError(result.error || 'Failed to save')
    }
    setSaving(false)
  }

  const teamAPlayers = players.filter((p) => assignments[p.id] === 'A')
  const teamBPlayers = players.filter((p) => assignments[p.id] === 'B')
  const unassignedPlayers = players.filter((p) => !assignments[p.id])

  if (loading) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-center text-text-2">Loading teams...</div>
      </Card>
    )
  }

  return (
    <Card className={cn('p-4', className)}>
      <h3 className="font-display text-lg font-bold text-text-0 mb-4">
        War Teams
      </h3>

      {/* Team containers */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Team A */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="positive">Team A</Badge>
            <span className="text-sm text-text-2">({teamAPlayers.length})</span>
          </div>
          <div className="bg-good/5 border border-good/20 rounded-lg p-3 min-h-[100px]">
            {teamAPlayers.length === 0 ? (
              <p className="text-xs text-text-2 text-center py-4">No players</p>
            ) : (
              <div className="space-y-2">
                {teamAPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-bg-1 rounded px-2 py-1.5"
                  >
                    <span className="text-sm text-text-0">{player.name}</span>
                    <button
                      onClick={() => unassign(player.id)}
                      className="text-xs text-text-2 hover:text-bad"
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
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="negative">Team B</Badge>
            <span className="text-sm text-text-2">({teamBPlayers.length})</span>
          </div>
          <div className="bg-bad/5 border border-bad/20 rounded-lg p-3 min-h-[100px]">
            {teamBPlayers.length === 0 ? (
              <p className="text-xs text-text-2 text-center py-4">No players</p>
            ) : (
              <div className="space-y-2">
                {teamBPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-bg-1 rounded px-2 py-1.5"
                  >
                    <span className="text-sm text-text-0">{player.name}</span>
                    <button
                      onClick={() => unassign(player.id)}
                      className="text-xs text-text-2 hover:text-bad"
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

      {/* Unassigned players */}
      {unassignedPlayers.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-text-2 mb-2">Unassigned</p>
          <div className="flex flex-wrap gap-2">
            {unassignedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-1 bg-bg-2 rounded-full pl-3 pr-1 py-1"
              >
                <span className="text-sm text-text-1">{player.name}</span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => assignToTeam(player.id, 'A')}
                    className="w-6 h-6 rounded-full bg-good/20 text-good text-xs font-bold hover:bg-good/30"
                  >
                    A
                  </button>
                  <button
                    onClick={() => assignToTeam(player.id, 'B')}
                    className="w-6 h-6 rounded-full bg-bad/20 text-bad text-xs font-bold hover:bg-bad/30"
                  >
                    B
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-bad">{error}</div>
      )}

      {hasChanges && (
        <Button
          onClick={handleSave}
          loading={saving}
          className="w-full"
        >
          Save Teams
        </Button>
      )}
    </Card>
  )
}
