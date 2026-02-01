'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import {
  getPlayersAction,
  createPlayerAction,
  updatePlayerAction,
  deletePlayerAction,
} from '@/lib/supabase/player-actions'
import type { DbPlayer } from '@/lib/supabase/types'

export default function PlayersPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline add state
  const [newName, setNewName] = useState('')
  const [newHandicap, setNewHandicap] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editHandicap, setEditHandicap] = useState<number | null>(null)

  // Swipe delete state
  const [swipedId, setSwipedId] = useState<string | null>(null)

  const loadPlayers = useCallback(async () => {
    const result = await getPlayersAction(tripId)
    if (result.error) {
      setError(result.error)
    } else {
      setPlayers(result.players)
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  // Focus name input on mount
  useEffect(() => {
    if (!loading) {
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [loading])

  const handleAdd = async () => {
    if (!newName.trim() || adding) return
    setAdding(true)
    setError(null)

    const result = await createPlayerAction({
      trip_id: tripId,
      name: newName.trim(),
      handicap_index: newHandicap,
    })

    if (result.success) {
      setJustAdded(result.playerId || null)
      setNewName('')
      setNewHandicap(null)
      await loadPlayers()
      // Auto-focus back to name for rapid entry
      setTimeout(() => nameInputRef.current?.focus(), 50)
      // Clear animation after delay
      setTimeout(() => setJustAdded(null), 600)
    } else {
      setError(result.error || 'Failed to add player')
    }
    setAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const startEdit = (player: DbPlayer) => {
    setEditingId(player.id)
    setEditName(player.name)
    setEditHandicap(player.handicap_index)
    setSwipedId(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    const result = await updatePlayerAction(editingId, tripId, {
      name: editName.trim(),
      handicap_index: editHandicap,
    })
    if (result.success) {
      setEditingId(null)
      loadPlayers()
    } else {
      setError(result.error || 'Failed to update')
    }
  }

  const handleDelete = async (playerId: string) => {
    const result = await deletePlayerAction(playerId, tripId)
    if (result.success) {
      setSwipedId(null)
      loadPlayers()
    } else {
      setError(result.error || 'Failed to remove player')
    }
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="flex h-40 items-center justify-center text-text-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </LayoutContainer>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-0">
      <LayoutContainer className="flex-1 py-6 pb-28">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/trip/${tripId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <ChevronLeftIcon />
            Back to trip
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">
            Players
          </h1>
          <p className="text-sm text-text-2 mt-1">
            {players.length === 0
              ? 'Add your crew to get started'
              : `${players.length} player${players.length !== 1 ? 's' : ''} added`}
          </p>
        </div>

        {/* Inline Add Form — always visible at top */}
        <div className="mb-6 rounded-xl bg-bg-1 border border-stroke/40 p-4">
          <div className="flex items-center gap-3">
            {/* Name input */}
            <input
              ref={nameInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Player name"
              autoComplete="off"
              className="flex-1 rounded-lg border border-stroke bg-bg-2 px-3 py-2.5 text-text-0 placeholder:text-text-2/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-[16px]"
            />
            {/* Add button */}
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || adding}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-bg-0 font-bold transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {adding ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-bg-0 border-t-transparent" />
              ) : (
                <PlusIcon />
              )}
            </button>
          </div>

          {/* Handicap stepper — shows when name has content */}
          {newName.trim() && (
            <div className="mt-3 flex items-center justify-between animate-fadeIn">
              <span className="text-sm text-text-2">Handicap</span>
              <HandicapStepper
                value={newHandicap}
                onChange={setNewHandicap}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Player List */}
        {players.length === 0 ? (
          <div className="mt-8 text-center">
            <div className="mb-3 text-4xl">🏌️</div>
            <p className="text-text-2 text-sm">Type a name above and tap + to add</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((player) => (
              <div key={player.id} className="relative overflow-hidden rounded-xl">
                {/* Delete backdrop (revealed on swipe) */}
                <div className="absolute inset-0 flex items-center justify-end bg-bad px-6">
                  <button
                    onClick={() => handleDelete(player.id)}
                    className="text-white font-medium text-sm"
                  >
                    Remove
                  </button>
                </div>

                {/* Player card */}
                <div
                  className={`relative bg-bg-1 border border-stroke/40 rounded-xl transition-all duration-300
                    ${justAdded === player.id ? 'animate-slideIn' : ''}
                    ${swipedId === player.id ? '-translate-x-24' : 'translate-x-0'}
                  `}
                  onClick={() => {
                    if (swipedId === player.id) {
                      setSwipedId(null)
                    } else if (swipedId) {
                      setSwipedId(null)
                    }
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0]
                    const startX = touch.clientX
                    const el = e.currentTarget

                    const handleMove = (moveEvent: TouchEvent) => {
                      const diff = startX - moveEvent.touches[0].clientX
                      if (diff > 60) setSwipedId(player.id)
                      if (diff < -30) setSwipedId(null)
                    }

                    const handleEnd = () => {
                      el.removeEventListener('touchmove', handleMove)
                      el.removeEventListener('touchend', handleEnd)
                    }

                    el.addEventListener('touchmove', handleMove)
                    el.addEventListener('touchend', handleEnd)
                  }}
                >
                  {editingId === player.id ? (
                    /* Inline edit mode */
                    <div className="p-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="mb-2 w-full rounded-lg border border-stroke bg-bg-2 px-3 py-2 text-text-0 focus:border-accent focus:outline-none text-[16px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <HandicapStepper value={editHandicap} onChange={setEditHandicap} />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-3 py-1.5 text-sm text-text-2 hover:bg-bg-2"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg-0"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <button
                      onClick={() => startEdit(player)}
                      className="flex w-full items-center gap-3 p-3 text-left active:bg-bg-2/50 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
                        <span className="text-sm font-bold text-accent">
                          {player.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Name + handicap */}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-text-0">
                          {player.name}
                        </span>
                      </div>

                      {/* Handicap pill */}
                      {player.handicap_index !== null ? (
                        <span className="shrink-0 rounded-full bg-bg-2 px-2.5 py-1 text-xs font-medium text-text-1">
                          {player.handicap_index > 0
                            ? player.handicap_index.toFixed(1)
                            : player.handicap_index < 0
                            ? `+${Math.abs(player.handicap_index).toFixed(1)}`
                            : '0.0'}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-bg-2 px-2.5 py-1 text-xs text-text-2/50">
                          No HCP
                        </span>
                      )}

                      {/* Edit hint */}
                      <ChevronRightIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </LayoutContainer>

      {/* Fixed bottom CTA */}
      {players.length >= 2 && (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-bg-0 via-bg-0 to-transparent pb-safe pt-6 px-4">
          <LayoutContainer>
            <button
              onClick={() => router.push(`/trip/${tripId}/round/new`)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-display font-bold text-bg-0 text-base active:scale-[0.98] transition-transform"
            >
              Done — Set Up Round
              <ArrowRightIcon />
            </button>
          </LayoutContainer>
        </div>
      )}
    </div>
  )
}

// ─── Handicap Stepper ──────────────────────────────────────────

function HandicapStepper({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  const displayValue = value !== null ? (value < 0 ? `+${Math.abs(value).toFixed(1)}` : value.toFixed(1)) : '—'
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const adjust = useCallback((delta: number) => {
    onChange(Math.round(((value ?? 0) + delta) * 10) / 10)
  }, [value, onChange])

  const startHold = useCallback((delta: number) => {
    adjust(delta)
    let speed = 200
    const repeat = () => {
      intervalRef.current = setTimeout(() => {
        adjust(delta)
        speed = Math.max(50, speed - 20)
        repeat()
      }, speed)
    }
    intervalRef.current = setTimeout(() => repeat(), 400)
  }, [adjust])

  const stopHold = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current) }
  }, [])

  return (
    <div className="flex items-center gap-1">
      {/* Minus button */}
      <button
        onMouseDown={() => startHold(-0.1)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(-0.1)}
        onTouchEnd={stopHold}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-2 text-text-1 active:bg-bg-0 transition-colors select-none"
      >
        <MinusIcon />
      </button>

      {/* Value display */}
      <div className="flex h-9 w-14 items-center justify-center rounded-lg bg-bg-2 text-sm font-medium text-text-0 tabular-nums">
        {displayValue}
      </div>

      {/* Plus button */}
      <button
        onMouseDown={() => startHold(0.1)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(0.1)}
        onTouchEnd={stopHold}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-2 text-text-1 active:bg-bg-0 transition-colors select-none"
      >
        <StepperPlusIcon />
      </button>

      {/* Clear button */}
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="ml-1 text-xs text-text-2 hover:text-text-1"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4 text-text-2/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
  )
}

function StepperPlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
