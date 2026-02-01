'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Divider } from '@/components/ui/Divider'
import { MatchSetupForm, MatchSetupToggle } from '@/components/match'
import {
  RoundFormatSelector,
  CourseSelector,
  TeamAssignmentForm,
  isTeamAssignmentValid,
  formatRequiresTeams,
  JunkConfigForm,
  type RoundFormat,
} from '@/components/round'
import { DEFAULT_JUNK_CONFIG, type RoundJunkConfig } from '@/lib/junk-types'
import { getPlayersAction } from '@/lib/supabase/player-actions'
import { getTripAction } from '@/lib/supabase/trip-actions'
import { createRoundWithGroupsAction } from '@/lib/supabase/round-actions'
import { createMatchAction } from '@/lib/supabase/match-actions'
import type { DbPlayer } from '@/lib/supabase/types'
import type { CreateMatchInput } from '@/lib/supabase/match-types'

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
  const [tripStartDate, setTripStartDate] = useState<string | null>(null)
  const [tripEndDate, setTripEndDate] = useState<string | null>(null)
  const [teeTime, setTeeTime] = useState('')
  const [format, setFormat] = useState<RoundFormat>('stroke_play')
  const [scoringBasis, setScoringBasis] = useState<'gross' | 'net'>('net')
  const [selectedTeeId, setSelectedTeeId] = useState<string | null>(null)
  const [selectedCourseName, setSelectedCourseName] = useState<string>('')

  // Groups
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: '1', playerIds: [], teeTime: '' },
  ])

  // Team assignments (for Points Hi/Lo and Stableford)
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 1 | 2>>({})

  // Junk/side bets config
  const [junkConfig, setJunkConfig] = useState<RoundJunkConfig>({ ...DEFAULT_JUNK_CONFIG })

  // Match setup (only for match_play)
  const [matchEnabled, setMatchEnabled] = useState(false)
  const [matchConfig, setMatchConfig] = useState<Omit<CreateMatchInput, 'roundId'> | null>(null)
  const [showMatchSetup, setShowMatchSetup] = useState(false)

  // Manual course mode (when user can't find their course)
  const [manualCourseMode, setManualCourseMode] = useState(false)

  // Data
  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start scoring immediately option
  const [startImmediately, setStartImmediately] = useState(false)

  // Ref to prevent double submission
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    const loadData = async () => {
      const [playersResult, tripResult] = await Promise.all([
        getPlayersAction(tripId),
        getTripAction(tripId),
      ])

      if (playersResult.players) {
        setPlayers(playersResult.players)
      }

      // Constrain date picker to trip dates
      if (tripResult.trip) {
        const start = tripResult.trip.start_date
        const end = tripResult.trip.end_date
        if (start) setTripStartDate(start)
        if (end) setTripEndDate(end)
        // Default to trip start date (or today if within trip range)
        if (start) {
          const today = new Date().toISOString().split('T')[0]
          if (today >= start && (!end || today <= end)) {
            setDate(today)
          } else {
            setDate(start)
          }
        }
      }

      setLoading(false)
    }

    loadData()
  }, [tripId])

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

    // Prevent double submission
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    if (!name.trim()) {
      setError('Round name is required')
      isSubmittingRef.current = false
      return
    }

    // Filter out empty groups
    const nonEmptyGroups = groups.filter((g) => g.playerIds.length > 0)

    if (nonEmptyGroups.length === 0) {
      setError('Add at least one player to a group')
      isSubmittingRef.current = false
      return
    }

    // Validate team assignments for format rounds
    const allPlayerIds = nonEmptyGroups.flatMap((g) => g.playerIds)
    const requiresTeams = formatRequiresTeams(format)

    if (requiresTeams) {
      if ((format === 'points_hilo' || format === 'nassau') && allPlayerIds.length !== 4) {
        setError(`${format === 'nassau' ? 'Nassau' : 'Points Hi/Lo'} format requires exactly 4 players`)
        isSubmittingRef.current = false
        return
      }

      if (format === 'scramble' && allPlayerIds.length < 2) {
        setError('Scramble format requires at least 2 players')
        isSubmittingRef.current = false
        return
      }

      const assignedPlayers = players.filter((p) => allPlayerIds.includes(p.id))
      // For scramble, just check that every player has a team and both teams have at least 1
      if (format === 'scramble') {
        const team1 = assignedPlayers.filter((p) => teamAssignments[p.id] === 1)
        const team2 = assignedPlayers.filter((p) => teamAssignments[p.id] === 2)
        if (team1.length < 1 || team2.length < 1) {
          setError('Each team must have at least 1 player')
          isSubmittingRef.current = false
          return
        }
      } else if (!isTeamAssignmentValid(assignedPlayers, teamAssignments)) {
        setError('Each team must have exactly 2 players')
        isSubmittingRef.current = false
        return
      }
    }

    // Wolf requires exactly 4 players
    if (format === 'wolf' && allPlayerIds.length !== 4) {
      setError('Wolf format requires exactly 4 players')
      isSubmittingRef.current = false
      return
    }

    // Skins requires at least 2 players
    if (format === 'skins' && allPlayerIds.length < 2) {
      setError('Skins format requires at least 2 players')
      isSubmittingRef.current = false
      return
    }

    setSubmitting(true)
    setError(null)

    // Build tee_time as ISO timestamp if both date and time provided
    let teeTimeTimestamp: string | null = null
    if (teeTime) {
      teeTimeTimestamp = `${date}T${teeTime}:00`
    }

    const result = await createRoundWithGroupsAction({
      trip_id: tripId,
      tee_id: selectedTeeId || null,
      name: name.trim(),
      date,
      tee_time: teeTimeTimestamp,
      format,
      scoring_basis: scoringBasis,
      groups: nonEmptyGroups.map((g) => ({
        tee_time: g.teeTime || null,
        player_ids: g.playerIds,
      })),
      team_assignments: requiresTeams ? teamAssignments : undefined,
      junk_config: junkConfig.enabled ? junkConfig : null,
    })

    if (result.success && result.roundId) {
      // Create match if configured
      if (matchEnabled && matchConfig) {
        const matchResult = await createMatchAction({
          ...matchConfig,
          roundId: result.roundId,
        })

        if (!matchResult.success) {
          console.error('Failed to create match:', matchResult.error)
          // Continue to round page even if match creation fails
        }
      }

      // Redirect based on start immediately preference
      if (startImmediately) {
        router.push(`/trip/${tripId}/round/${result.roundId}/score`)
      } else {
        router.push(`/trip/${tripId}/round/${result.roundId}`)
      }
    } else {
      setError(result.error || 'Failed to create round')
      setSubmitting(false)
      isSubmittingRef.current = false
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={tripStartDate || undefined}
                  max={tripEndDate || undefined}
                  required
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Tee Time
                </label>
                <input
                  type="time"
                  value={teeTime}
                  onChange={(e) => setTeeTime(e.target.value)}
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <RoundFormatSelector
              value={format}
              onChange={setFormat}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-text-1">
                Scoring Basis
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
        </Card>

        {/* Course Selection */}
        <Card className="p-4 mb-4">
          <h2 className="mb-4 font-display text-lg font-bold text-text-0">
            Course
          </h2>

          {!manualCourseMode ? (
            <>
              <CourseSelector
                selectedTeeId={selectedTeeId}
                onTeeSelected={(teeId, courseName, teeName) => {
                  setSelectedTeeId(teeId)
                  setSelectedCourseName(courseName)
                }}
              />
              <button
                type="button"
                onClick={() => setManualCourseMode(true)}
                className="mt-4 text-sm text-text-2 hover:text-accent transition-colors"
              >
                Can&apos;t find your course?
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-card-sm bg-yellow-500/10 border border-yellow-500/30 p-3">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  <span className="font-medium">Manual mode:</span> Without course data, all holes will default to Par 4.
                  Handicap strokes won&apos;t be calculated.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualCourseMode(false)}
                className="text-sm text-accent hover:underline"
              >
                ← Back to course search
              </button>
            </div>
          )}
        </Card>

        {/* Groups */}
        <Card className="p-4 mb-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-text-0">
              {groups.length === 1 ? 'Players & Tee Time' : 'Groups'}
            </h2>
            {groups.length > 1 || players.length > 4 ? (
              <Button type="button" variant="secondary" size="default" onClick={addGroup}>
                <PlusIcon />
                Add Group
              </Button>
            ) : null}
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
                  className={groups.length === 1 ? '' : 'rounded-card-sm border border-stroke bg-bg-2 p-4'}
                >
                  {/* Group header (only show for multiple groups) */}
                  {groups.length > 1 && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-medium text-text-0">
                        Group {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={group.teeTime}
                          onChange={(e) => updateGroupTeeTime(group.id, e.target.value)}
                          className="rounded-button border border-stroke bg-bg-1 px-3 py-1.5 text-sm text-text-0 focus:border-accent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="p-1 text-text-2 hover:text-bad transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Single group: simpler tee time input */}
                  {groups.length === 1 && (
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-text-1">
                        Tee Time
                      </label>
                      <input
                        type="time"
                        value={group.teeTime}
                        onChange={(e) => updateGroupTeeTime(group.id, e.target.value)}
                        className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Players section */}
                  {groups.length === 1 && (
                    <label className="mb-2 block text-sm font-medium text-text-1">
                      Players
                    </label>
                  )}

                  {/* Player chips — tap to toggle */}
                  <div className="flex flex-wrap gap-2">
                    {players.map((player) => {
                      const isInThisGroup = group.playerIds.includes(player.id)
                      const isInOtherGroup = !isInThisGroup && assignedPlayerIds.has(player.id)

                      return (
                        <button
                          key={player.id}
                          type="button"
                          disabled={isInOtherGroup}
                          onClick={() => {
                            if (isInThisGroup) {
                              removePlayerFromGroup(group.id, player.id)
                            } else {
                              addPlayerToGroup(group.id, player.id)
                            }
                          }}
                          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all active:scale-95
                            ${isInThisGroup
                              ? 'bg-accent text-bg-0 shadow-sm'
                              : isInOtherGroup
                              ? 'bg-bg-2/50 text-text-2/40 cursor-not-allowed'
                              : 'bg-bg-2 text-text-1 border border-stroke hover:border-accent/50'
                            }`}
                        >
                          {isInThisGroup && (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          {player.name}
                          {player.handicap_index !== null && (
                            <span className={`text-xs ${isInThisGroup ? 'text-bg-0/70' : 'text-text-2'}`}>
                              {player.handicap_index > 0 ? player.handicap_index.toFixed(1) : player.handicap_index < 0 ? `+${Math.abs(player.handicap_index).toFixed(1)}` : '0'}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {group.playerIds.length === 0 && (
                    <p className="mt-2 text-xs text-text-2">Tap players to add them to this round</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Team Assignment (for Points Hi/Lo and Stableford) */}
        {formatRequiresTeams(format) && assignedPlayerIds.size > 0 && (
          <div className="mb-4">
            <TeamAssignmentForm
              players={players.filter((p) => assignedPlayerIds.has(p.id))}
              assignments={teamAssignments}
              onChange={setTeamAssignments}
            />
          </div>
        )}

        {/* Money Game (Match Setup) - Only for Match Play */}
        {format === 'match_play' && assignedPlayerIds.size >= 2 && (
          <div className="mb-4">
            {/* Auto-expand match setup for match play to make it prominent */}
            {!matchConfig ? (
              <Card className="p-4 border-gold/30 bg-gold/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-text-0">Set Up Money Game</p>
                    <p className="text-xs text-text-2">Configure teams and stakes for match play</p>
                  </div>
                </div>
                {showMatchSetup ? (
                  <MatchSetupForm
                    players={players.filter((p) => assignedPlayerIds.has(p.id))}
                    onMatchConfigured={(config) => {
                      setMatchConfig(config)
                      setMatchEnabled(true)
                      setShowMatchSetup(false)
                    }}
                    onCancel={() => setShowMatchSetup(false)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowMatchSetup(true)}
                    className="w-full"
                  >
                    Configure Money Game
                  </Button>
                )}
              </Card>
            ) : (
              <MatchSetupToggle
                enabled={matchEnabled}
                onToggle={(enabled) => {
                  setMatchEnabled(enabled)
                  if (!enabled) {
                    setMatchConfig(null)
                  }
                }}
                matchConfig={matchConfig}
                onConfigure={() => setShowMatchSetup(true)}
                players={players.filter((p) => assignedPlayerIds.has(p.id))}
              />
            )}
          </div>
        )}

        {/* Junk/Side Bets */}
        {assignedPlayerIds.size >= 2 && (
          <div className="mb-4">
            <JunkConfigForm
              config={junkConfig}
              onChange={setJunkConfig}
            />
          </div>
        )}

        {/* Start immediately option */}
        <Card className="p-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={startImmediately}
              onChange={(e) => setStartImmediately(e.target.checked)}
              className="h-5 w-5 rounded border-stroke bg-bg-2 text-accent focus:ring-accent focus:ring-offset-bg-0"
            />
            <div>
              <p className="font-medium text-text-0">Start scoring immediately</p>
              <p className="text-sm text-text-2">Jump straight to the scorecard after creating</p>
            </div>
          </label>
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
            disabled={submitting || !name.trim() || players.length === 0 || (!selectedTeeId && !manualCourseMode)}
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
