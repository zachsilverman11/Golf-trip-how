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
import { createRoundWithGroupsAction } from '@/lib/supabase/round-actions'
import { createMatchAction } from '@/lib/supabase/match-actions'
import { createNassauBetAction } from '@/lib/supabase/nassau-actions'
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

  // Nassau config
  const [nassauStake, setNassauStake] = useState(5)
  const [nassauAutoPress, setNassauAutoPress] = useState(false)
  const [nassauHighBallTiebreaker, setNassauHighBallTiebreaker] = useState(false)

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
      const playersResult = await getPlayersAction(tripId)

      if (playersResult.players) {
        setPlayers(playersResult.players)
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

  // Quick-add all players to first group
  const addAllPlayers = () => {
    if (groups[0] && unassignedPlayers.length > 0) {
      setGroups(
        groups.map((g, idx) =>
          idx === 0
            ? { ...g, playerIds: [...g.playerIds, ...unassignedPlayers.map((p) => p.id)] }
            : g
        )
      )
    }
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
        }
      }

      // Create nassau bet if format is nassau
      if (format === 'nassau' && teamAssignments) {
        const team1Players = Object.entries(teamAssignments).filter(([, t]) => t === 1).map(([id]) => id)
        const team2Players = Object.entries(teamAssignments).filter(([, t]) => t === 2).map(([id]) => id)

        if (team1Players.length >= 1 && team2Players.length >= 1) {
          const nassauResult = await createNassauBetAction({
            roundId: result.roundId,
            stakePerMan: nassauStake,
            autoPress: nassauAutoPress,
            autoPressThreshold: 2,
            highBallTiebreaker: nassauHighBallTiebreaker,
            teamAPlayer1Id: team1Players[0],
            teamAPlayer2Id: team1Players[1],
            teamBPlayer1Id: team2Players[0],
            teamBPlayer2Id: team2Players[1],
          })

          if (!nassauResult.success) {
            console.error('Failed to create Nassau bet:', nassauResult.error)
          }
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
      <div className="min-h-screen bg-bg-0">
        <LayoutContainer className="py-6">
          <div className="animate-pulse">
            <div className="h-4 w-20 rounded bg-bg-2 mb-3" />
            <div className="h-7 w-48 rounded bg-bg-2 mb-6" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-4 rounded-xl bg-bg-1 border border-stroke/40 p-4">
                <div className="h-5 w-32 rounded bg-bg-2 mb-3" />
                <div className="h-10 rounded-lg bg-bg-2" />
              </div>
            ))}
          </div>
        </LayoutContainer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-0">
      <LayoutContainer className="py-6 pb-safe">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/trip/${tripId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            Back to trip
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">
            New Round
          </h1>
          <p className="text-sm text-text-2 mt-1">Set up your round, then get to scoring.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Section 1: Round Details ── */}
          <div className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-4">
              Round Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-1">
                  Round Name <span className="text-bad">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Day 1 - Morning Round"
                  required
                  className="w-full rounded-xl border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-[16px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none text-[16px]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-1">
                    Tee Time
                  </label>
                  <input
                    type="time"
                    value={teeTime}
                    onChange={(e) => setTeeTime(e.target.value)}
                    className="w-full rounded-xl border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none text-[16px]"
                  />
                </div>
              </div>

              {/* Scoring basis as toggle pills */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-1">
                  Scoring
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'net' as const, label: 'Net (Handicap)', desc: 'Recommended' },
                    { value: 'gross' as const, label: 'Gross', desc: 'Raw scores' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setScoringBasis(opt.value)}
                      className={`flex-1 rounded-xl border p-3 text-left transition-all ${
                        scoringBasis === opt.value
                          ? 'border-accent bg-accent/10'
                          : 'border-stroke bg-bg-2 active:bg-bg-0'
                      }`}
                    >
                      <span className={`text-sm font-medium ${scoringBasis === opt.value ? 'text-accent' : 'text-text-1'}`}>
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-text-2 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Format Selection ── */}
          <div className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-4">
              Format
            </h2>
            <RoundFormatSelector
              value={format}
              onChange={setFormat}
            />
          </div>

          {/* ── Section 3: Course ── */}
          <div className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-4">
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
                  Can&apos;t find your course? →
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-gold/5 border border-gold/20 p-3">
                  <p className="text-sm text-gold/80">
                    <span className="font-medium">Manual mode:</span> All holes default to Par 4. No handicap strokes.
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
          </div>

          {/* ── Section 4: Players ── */}
          <div className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2">
                {groups.length === 1 ? 'Players' : 'Groups'}
              </h2>
              <div className="flex items-center gap-2">
                {unassignedPlayers.length > 0 && groups[0] && assignedPlayerIds.size === 0 && (
                  <button
                    type="button"
                    onClick={addAllPlayers}
                    className="text-xs text-accent font-medium hover:underline"
                  >
                    Add All ({unassignedPlayers.length})
                  </button>
                )}
                {(groups.length > 1 || players.length > 4) && (
                  <button
                    type="button"
                    onClick={addGroup}
                    className="flex items-center gap-1 rounded-lg bg-bg-2 px-2.5 py-1.5 text-xs font-medium text-text-1 active:bg-bg-0"
                  >
                    <PlusIcon /> Group
                  </button>
                )}
              </div>
            </div>

            {players.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🏌️</div>
                <p className="text-text-2 text-sm mb-3">No players added yet</p>
                <Link href={`/trip/${tripId}/players`}>
                  <Button type="button" variant="secondary" size="default">
                    Add Players First
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group, index) => (
                  <div
                    key={group.id}
                    className={groups.length === 1 ? '' : 'rounded-xl border border-stroke/40 bg-bg-2 p-3'}
                  >
                    {/* Group header (only show for multiple groups) */}
                    {groups.length > 1 && (
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-text-0">
                          Group {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={group.teeTime}
                            onChange={(e) => updateGroupTeeTime(group.id, e.target.value)}
                            className="rounded-lg border border-stroke bg-bg-1 px-3 py-1.5 text-sm text-text-0 focus:border-accent focus:outline-none text-[16px]"
                          />
                          <button
                            type="button"
                            onClick={() => removeGroup(group.id)}
                            className="p-1.5 text-text-2 hover:text-bad transition-colors rounded-lg active:bg-bg-1"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Players as tap-to-assign chips */}
                    {group.playerIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {group.playerIds.map((playerId) => {
                          const player = players.find((p) => p.id === playerId)
                          if (!player) return null
                          return (
                            <div
                              key={playerId}
                              className="flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 pl-3 pr-1.5 py-1.5 animate-fadeIn"
                            >
                              <span className="text-sm font-medium text-text-0">{player.name}</span>
                              {player.handicap_index !== null && (
                                <span className="text-[11px] text-text-2">{player.handicap_index}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => removePlayerFromGroup(group.id, playerId)}
                                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-bad/20 text-text-2 hover:text-bad transition-colors"
                              >
                                <XIcon />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Unassigned players as tap targets */}
                    {unassignedPlayers.length > 0 && (
                      <div>
                        {group.playerIds.length === 0 && groups.length === 1 && (
                          <p className="text-xs text-text-2 mb-2">Tap to add players:</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {unassignedPlayers.map((player) => (
                            <button
                              key={player.id}
                              type="button"
                              onClick={() => addPlayerToGroup(group.id, player.id)}
                              className="flex items-center gap-1.5 rounded-full border border-stroke bg-bg-2 px-3 py-1.5 text-sm text-text-1 transition-all active:scale-95 active:bg-accent/10 active:border-accent/30 hover:border-accent/40"
                            >
                              <span className="text-text-2">+</span>
                              <span>{player.name}</span>
                              {player.handicap_index !== null && (
                                <span className="text-[11px] text-text-2/60">{player.handicap_index}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {group.playerIds.length === 0 && unassignedPlayers.length === 0 && (
                      <p className="text-sm text-text-2">All players assigned</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team Assignment (for Points Hi/Lo and Stableford) */}
          {formatRequiresTeams(format) && assignedPlayerIds.size > 0 && (
            <div className="animate-fadeIn">
              <TeamAssignmentForm
                players={players.filter((p) => assignedPlayerIds.has(p.id))}
                assignments={teamAssignments}
                onChange={setTeamAssignments}
              />
            </div>
          )}

          {/* Nassau Upsell — show when Match Play is selected */}
          {format === 'match_play' && (
            <div className="animate-fadeIn rounded-xl border border-accent/40 bg-accent/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                    <span className="text-lg">⚡</span>
                  </div>
                  <div>
                    <p className="font-display font-bold text-accent text-sm">UPGRADE TO NASSAU</p>
                    <p className="text-xs text-text-2">3 matches in 1 — Front 9 + Back 9 + Overall</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormat('nassau')}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-bg-0 active:scale-95 transition-transform"
                >
                  Switch
                </button>
              </div>
            </div>
          )}

          {/* Nassau Settings — show when Nassau is selected */}
          {format === 'nassau' && (
            <Card className="p-4 animate-fadeIn">
              <h3 className="font-display text-lg font-bold text-text-0 mb-4">Nassau Settings</h3>

              {/* Stake */}
              <div className="mb-4">
                <label className="block text-sm text-text-2 mb-2">Stake per Man (per bet)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNassauStake(Math.max(1, nassauStake - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-2 text-text-1 active:bg-bg-0"
                  >−</button>
                  <div className="flex h-10 items-center justify-center rounded-lg bg-bg-2 px-4 min-w-[80px] text-center font-bold text-accent text-lg tabular-nums">
                    ${nassauStake}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNassauStake(nassauStake + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-2 text-text-1 active:bg-bg-0"
                  >+</button>
                </div>
                <p className="text-xs text-text-2 mt-1">Total exposure: ${nassauStake * 3}/man (Front + Back + Overall)</p>
              </div>

              {/* High Ball Tiebreaker */}
              <div className="flex items-center justify-between py-3 border-t border-stroke/40">
                <div>
                  <p className="font-medium text-text-0 text-sm">High Ball Tiebreaker</p>
                  <p className="text-xs text-text-2">When low nets tie, best high net breaks it</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNassauHighBallTiebreaker(!nassauHighBallTiebreaker)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
                    nassauHighBallTiebreaker ? 'bg-accent' : 'bg-bg-2 border border-stroke'
                  }`}
                  role="switch"
                  aria-checked={nassauHighBallTiebreaker}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg absolute top-1 transition-transform ${
                    nassauHighBallTiebreaker ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Auto Press */}
              <div className="flex items-center justify-between py-3 border-t border-stroke/40">
                <div>
                  <p className="font-medium text-text-0 text-sm">Auto-Press When Down 2</p>
                  <p className="text-xs text-text-2">Automatically press when trailing by 2 in any sub-match</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNassauAutoPress(!nassauAutoPress)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
                    nassauAutoPress ? 'bg-accent' : 'bg-bg-2 border border-stroke'
                  }`}
                  role="switch"
                  aria-checked={nassauAutoPress}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg absolute top-1 transition-transform ${
                    nassauAutoPress ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </Card>
          )}

          {/* Press Settings — show for match-based formats */}
          {(format === 'match_play' || format === 'nassau') && (
            <div className="animate-fadeIn rounded-xl border border-stroke/40 bg-bg-1 p-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                  <span className="font-display text-xs font-extrabold tracking-widest text-accent">P</span>
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-text-0">Press</p>
                  <p className="text-xs text-text-2">When you&apos;re down, press to double the action</p>
                </div>
                <div className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent tracking-wide">
                  ALWAYS ON
                </div>
              </div>
              <p className="text-xs text-text-2 mt-2 ml-[52px]">
                Press Front 9, Back 9, or the full match at any point during play. It&apos;s what we&apos;re named after.
              </p>
            </div>
          )}

          {/* Money Game (Match Setup) - Only for Match Play */}
          {format === 'match_play' && assignedPlayerIds.size >= 2 && (
            <div className="animate-fadeIn">
              {/* Auto-expand match setup for match play to make it prominent */}
              {!matchConfig ? (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-text-0">Money Game</p>
                      <p className="text-xs text-text-2">Configure teams and stakes</p>
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
                </div>
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
            <div className="animate-fadeIn">
              <JunkConfigForm
                config={junkConfig}
                onChange={setJunkConfig}
              />
            </div>
          )}

          {/* Start immediately toggle */}
          <button
            type="button"
            onClick={() => setStartImmediately(!startImmediately)}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              startImmediately
                ? 'border-good/40 bg-good/5'
                : 'border-stroke/40 bg-bg-1'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${
                startImmediately ? 'bg-good text-white' : 'border-2 border-stroke bg-bg-2'
              }`}>
                {startImmediately && (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-text-0 text-sm">Start scoring immediately</p>
                <p className="text-xs text-text-2 mt-0.5">Jump straight to the scorecard</p>
              </div>
            </div>
          </button>

          {error && (
            <div className="rounded-xl bg-bad/10 border border-bad/20 px-4 py-3 text-sm text-bad animate-fadeIn">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline text-bad/70">dismiss</button>
            </div>
          )}

          {/* Submit area — sticky bottom */}
          <div className="sticky bottom-0 bg-gradient-to-t from-bg-0 via-bg-0 to-transparent pt-4 pb-2 -mx-4 px-4">
            <div className="flex gap-3">
              <Link href={`/trip/${tripId}`} className="flex-shrink-0">
                <Button type="button" variant="secondary" className="px-6">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                loading={submitting}
                disabled={submitting || !name.trim() || players.length === 0 || (!selectedTeeId && !manualCourseMode)}
                className="flex-1"
                size="large"
              >
                {startImmediately ? 'Create & Start Scoring →' : 'Create Round'}
              </Button>
            </div>
          </div>
        </form>
      </LayoutContainer>
    </div>
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
