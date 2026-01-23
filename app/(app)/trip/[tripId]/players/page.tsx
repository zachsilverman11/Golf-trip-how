'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PlayerFormModal } from '@/components/trip/PlayerForm'
import {
  getPlayersAction,
  createPlayerAction,
  updatePlayerAction,
  deletePlayerAction,
} from '@/lib/supabase/player-actions'
import type { DbPlayer } from '@/lib/supabase/types'

export default function PlayersPage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<DbPlayer | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadPlayers = async () => {
    const result = await getPlayersAction(tripId)
    if (result.error) {
      setError(result.error)
    } else {
      setPlayers(result.players)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPlayers()
  }, [tripId])

  const handleAddPlayer = async (name: string, handicap: number | null) => {
    setSubmitting(true)
    const result = await createPlayerAction({
      trip_id: tripId,
      name,
      handicap_index: handicap,
    })

    if (result.success) {
      setShowAddModal(false)
      loadPlayers()
    } else {
      setError(result.error || 'Failed to add player')
    }
    setSubmitting(false)
  }

  const handleUpdatePlayer = async (name: string, handicap: number | null) => {
    if (!editingPlayer) return

    setSubmitting(true)
    const result = await updatePlayerAction(editingPlayer.id, tripId, {
      name,
      handicap_index: handicap,
    })

    if (result.success) {
      setEditingPlayer(null)
      loadPlayers()
    } else {
      setError(result.error || 'Failed to update player')
    }
    setSubmitting(false)
  }

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to remove this player?')) return

    const result = await deletePlayerAction(playerId, tripId)
    if (result.success) {
      loadPlayers()
    } else {
      setError(result.error || 'Failed to delete player')
    }
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading players...</div>
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/trip/${tripId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trip
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text-0">
            Players
          </h1>
          <Button onClick={() => setShowAddModal(true)}>
            <PlusIcon />
            Add
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-card bg-bad/10 p-4 text-bad">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Player list */}
      {players.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-bg-2 p-4">
              <UsersIcon />
            </div>
          </div>
          <h2 className="mb-2 font-display text-lg font-bold text-text-0">
            No players yet
          </h2>
          <p className="mb-6 text-sm text-text-2">
            Add your crew so we can calculate handicaps and money games.
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            Add First Player
          </Button>
        </Card>
      ) : (
        <Card>
          {players.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center justify-between px-4 py-3 ${
                idx < players.length - 1 ? 'border-b border-stroke/60' : ''
              }`}
            >
              <div>
                <span className="font-medium text-text-0">{player.name}</span>
                {player.handicap_index !== null && (
                  <Badge variant="default" className="ml-2">
                    HCP {player.handicap_index > 0 ? player.handicap_index : player.handicap_index < 0 ? `+${Math.abs(player.handicap_index)}` : '0'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingPlayer(player)}
                  className="p-2 text-text-2 hover:text-text-1 transition-colors"
                >
                  <EditIcon />
                </button>
                <button
                  onClick={() => handleDeletePlayer(player.id)}
                  className="p-2 text-text-2 hover:text-bad transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Add player modal */}
      <PlayerFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddPlayer}
        loading={submitting}
        title="Add Player"
        submitLabel="Add Player"
      />

      {/* Edit player modal */}
      <PlayerFormModal
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        onSubmit={handleUpdatePlayer}
        loading={submitting}
        title="Edit Player"
        submitLabel="Save Changes"
        initialName={editingPlayer?.name}
        initialHandicap={editingPlayer?.handicap_index}
      />
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

function PlusIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-8 w-8 text-text-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}
