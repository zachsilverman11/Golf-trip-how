'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Divider } from '@/components/ui/Divider'
import { getPlayersAction } from '@/lib/supabase/player-actions'
import { getCoursesAction } from '@/lib/supabase/actions'
import { createRoundWithGroupsAction } from '@/lib/supabase/round-actions'
import type { DbPlayer, DbCourseWithTees } from '@/lib/supabase/types'

interface GroupConfig {
  id: string
  playerIds: string[]
  teeTime: string
}

export default function NewRoundPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string

  // Form state
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [format, setFormat] = useState<'stroke_play' | 'best_ball' | 'scramble' | 'match_play'>('stroke_play')
  const [scoringBasis, setScoringBasis] = useState<'gross' | 'net'>('net')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [selectedTeeId, setSelectedTeeId] = useState<string>('')

  // Groups
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: '1', playerIds: [], teeTime: '' },
  ])

  // Data
  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [courses, setCourses] = useState<DbCourseWithTees[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const [playersResult, coursesResult] = await Promise.all([
        getPlayersAction(tripId),
        getCoursesAction(),
      ])

      if (playersResult.players) {
        setPlayers(playersResult.players)
      }
      if (coursesResult.courses) {
        setCourses(coursesResult.courses)
      }
      setLoading(false)
    }

    loadData()
  }, [tripId])

  const selectedCourse = courses.find((c) => c.id === selectedCourseId)
  const availableTees = selectedCourse?.tees || []

  const assignedPlayerIds = new Set(groups.flatMap((g) => g.playerIds))
  const unassignedPlayers = players.filter((p) => !assignedPlayerIds.has(p.id))

  const addGroup = () => {
    setGroups([
      ...groups,
      { id: String(Date.now()), playerIds: [], teeTime: '' },
    ])
  }

  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return
    setGroups(groups.filter((g) => g.id !== groupId))
  }

  const addPlayerToGroup = (groupId: string, playerId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, playerIds: [...g.playerIds, playerId] }
          : g
      )
    )
  }

  const removePlayerFromGroup = (groupId: string, playerId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, playerIds: g.playerIds.filter((id) => id !== playerId) }
          : g
      )
    )
  }

  const updateGroupTeeTime = (groupId: string, teeTime: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId ? { ...g, teeTime } : g
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Round name is required')
      return
    }

    // Filter out empty groups
    const nonEmptyGroups = groups.filter((g) => g.playerIds.length > 0)

    if (nonEmptyGroups.length === 0) {
      setError('Add at least one player to a group')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await createRoundWithGroupsAction({
      trip_id: tripId,
      tee_id: selectedTeeId || null,
      name: name.trim(),
      date,
      format,
      scoring_basis: scoringBasis,
      groups: nonEmptyGroups.map((g) => ({
        tee_time: g.teeTime || null,
        player_ids: g.playerIds,
      })),
    })

    if (result.success && result.roundId) {
      router.push(`/trip/${tripId}/round/${result.roundId}`)
    } else {
      setError(result.error || 'Failed to create round')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading...</div>
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
        <h1 className="font-display text-2xl font-bold text-text-0">
          Create Round
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <Card className="p-4 mb-4">
          <h2 className="mb-4 font-display text-lg font-bold text-text-0">
            Round Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-1">
                Round Name <span className="text-bad">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Day 1 - Morning Round"
                required
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text-1">
                Date <span className="text-bad">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="stroke_play">Stroke Play</option>
                  <option value="best_ball">Best Ball</option>
                  <option value="scramble">Scramble</option>
                  <option value="match_play">Match Play</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Scoring
                </label>
                <select
                  value={scoringBasis}
                  onChange={(e) => setScoringBasis(e.target.value as typeof scoringBasis)}
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="net">Net (Handicap)</option>
                  <option value="gross">Gross</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Course Selection */}
        <Card className="p-4 mb-4">
          <h2 className="mb-4 font-display text-lg font-bold text-text-0">
            Course
          </h2>

          {courses.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-text-2 mb-3">No courses added yet</p>
              <Link href="/course/new">
                <Button type="button" variant="secondary" size="default">
                  Add Course
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Select Course
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value)
                    setSelectedTeeId('')
                  }}
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select a course...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCourseId && availableTees.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-1">
                    Select Tees
                  </label>
                  <select
                    value={selectedTeeId}
                    onChange={(e) => setSelectedTeeId(e.target.value)}
                    className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select tees...</option>
                    {availableTees.map((tee) => (
                      <option key={tee.id} value={tee.id}>
                        {tee.name} ({tee.rating}/{tee.slope}, {tee.yards} yds)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Groups */}
        <Card className="p-4 mb-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-text-0">
              Groups
            </h2>
            <Button type="button" variant="secondary" size="default" onClick={addGroup}>
              <PlusIcon />
              Add Group
            </Button>
          </div>

          {players.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-text-2 mb-3">No players added yet</p>
              <Link href={`/trip/${tripId}/players`}>
                <Button type="button" variant="secondary" size="default">
                  Add Players
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group, index) => (
                <div
                  key={group.id}
                  className="rounded-card-sm border border-stroke bg-bg-2 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-text-0">
                      Group {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={group.teeTime}
                        onChange={(e) => updateGroupTeeTime(group.id, e.target.value)}
                        placeholder="Tee time"
                        className="rounded-button border border-stroke bg-bg-1 px-3 py-1.5 text-sm text-text-0 focus:border-accent focus:outline-none"
                      />
                      {groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="p-1 text-text-2 hover:text-bad transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Players in group */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {group.playerIds.map((playerId) => {
                      const player = players.find((p) => p.id === playerId)
                      if (!player) return null
                      return (
                        <Badge
                          key={playerId}
                          variant="default"
                          className="pr-1"
                        >
                          {player.name}
                          <button
                            type="button"
                            onClick={() => removePlayerFromGroup(group.id, playerId)}
                            className="ml-1 p-0.5 hover:text-bad"
                          >
                            <XIcon />
                          </button>
                        </Badge>
                      )
                    })}
                    {group.playerIds.length === 0 && (
                      <span className="text-sm text-text-2">
                        No players assigned
                      </span>
                    )}
                  </div>

                  {/* Add player dropdown */}
                  {unassignedPlayers.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addPlayerToGroup(group.id, e.target.value)
                        }
                      }}
                      className="w-full rounded-button border border-stroke bg-bg-1 px-3 py-2 text-sm text-text-0 focus:border-accent focus:outline-none"
                    >
                      <option value="">Add player...</option>
                      {unassignedPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                          {player.handicap_index !== null && ` (${player.handicap_index})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {error && (
          <div className="mb-4 rounded-card bg-bad/10 p-4 text-bad">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Link href={`/trip/${tripId}`} className="flex-1">
            <Button type="button" variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            loading={submitting}
            disabled={!name.trim() || players.length === 0}
            className="flex-1"
          >
            Create Round
          </Button>
        </div>
      </form>
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
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function XIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
