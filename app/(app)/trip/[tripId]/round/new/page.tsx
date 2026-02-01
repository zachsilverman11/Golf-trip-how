'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Button } from '@/components/ui/Button'
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
import type { DbPlayer } from '@/lib/supabase/types'
import type { CreateMatchInput } from '@/lib/supabase/match-types'

// ─── Types ─────────────────────────────────────────────

interface GroupConfig {
  id: string
  playerIds: string[]
  teeTime: string
}

// ─── Main Component ────────────────────────────────────

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

  // Groups (single group is default — multi-group for larger trips)
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: '1', playerIds: [], teeTime: '' },
  ])

  // Team assignments
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 1 | 2>>({})

  // Junk/side bets
  const [junkConfig, setJunkConfig] = useState<RoundJunkConfig>({ ...DEFAULT_JUNK_CONFIG })

  // Match setup (match_play only)
  const [matchEnabled, setMatchEnabled] = useState(false)
  const [matchConfig, setMatchConfig] = useState<Omit<CreateMatchInput, 'roundId'> | null>(null)
  const [showMatchSetup, setShowMatchSetup] = useState(false)

  // Manual course mode
  const [manualCourseMode, setManualCourseMode] = useState(false)

  // Data
  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Options
  const [startImmediately, setStartImmediately] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Prevent double submit
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

  // ─── Player toggle logic ─────────────────────────────

  const selectedPlayerIds = new Set(groups.flatMap((g) => g.playerIds))
  const selectedCount = selectedPlayerIds.size

  const togglePlayer = (playerId: string) => {
    // For single group: toggle in/out of group 0
    if (groups.length === 1) {
      const group = groups[0]
      if (group.playerIds.includes(playerId)) {
        // Remove
        setGroups([{ ...group, playerIds: group.playerIds.filter((id) => id !== playerId) }])
        // Also clear team assignment
        const next = { ...teamAssignments }
        delete next[playerId]
        setTeamAssignments(next)
      } else {
        // Add
        setGroups([{ ...group, playerIds: [...group.playerIds, playerId] }])
      }
    }
  }

  const selectAllPlayers = () => {
    if (groups.length === 1) {
      setGroups([{ ...groups[0], playerIds: players.map((p) => p.id) }])
    }
  }

  const deselectAllPlayers = () => {
    if (groups.length === 1) {
      setGroups([{ ...groups[0], playerIds: [] }])
      setTeamAssignments({})
    }
  }

  // ─── Multi-group helpers ──────────────────────────────

  const addGroup = () => {
    setGroups([...groups, { id: String(Date.now()), playerIds: [], teeTime: '' }])
  }

  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return
    setGroups(groups.filter((g) => g.id !== groupId))
  }

  const addPlayerToGroup = (groupId: string, playerId: string) => {
    // Remove from any other group first
    setGroups(
      groups.map((g) => {
        if (g.id === groupId) {
          return { ...g, playerIds: [...g.playerIds.filter((id) => id !== playerId), playerId] }
        }
        return { ...g, playerIds: g.playerIds.filter((id) => id !== playerId) }
      })
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

  const updateGroupTeeTime = (groupId: string, time: string) => {
    setGroups(groups.map((g) => (g.id === groupId ? { ...g, teeTime: time } : g)))
  }

  // ─── Submit ───────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    if (!name.trim()) {
      setError('Round name is required')
      isSubmittingRef.current = false
      return
    }

    const nonEmptyGroups = groups.filter((g) => g.playerIds.length > 0)
    if (nonEmptyGroups.length === 0) {
      setError('Select at least one player')
      isSubmittingRef.current = false
      return
    }

    const allPlayerIds = nonEmptyGroups.flatMap((g) => g.playerIds)
    const requiresTeams = formatRequiresTeams(format)

    if (requiresTeams) {
      if ((format === 'points_hilo' || format === 'nassau') && allPlayerIds.length !== 4) {
        setError(`${format === 'nassau' ? 'Nassau' : 'Points Hi/Lo'} requires exactly 4 players`)
        isSubmittingRef.current = false
        return
      }
      if (format === 'scramble' && allPlayerIds.length < 2) {
        setError('Scramble requires at least 2 players')
        isSubmittingRef.current = false
        return
      }
      const assignedPlayers = players.filter((p) => allPlayerIds.includes(p.id))
      if (format === 'scramble') {
        const t1 = assignedPlayers.filter((p) => teamAssignments[p.id] === 1)
        const t2 = assignedPlayers.filter((p) => teamAssignments[p.id] === 2)
        if (t1.length < 1 || t2.length < 1) {
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

    if (format === 'wolf' && allPlayerIds.length !== 4) {
      setError('Wolf requires exactly 4 players')
      isSubmittingRef.current = false
      return
    }
    if (format === 'skins' && allPlayerIds.length < 2) {
      setError('Skins requires at least 2 players')
      isSubmittingRef.current = false
      return
    }

    setSubmitting(true)
    setError(null)

    let teeTimeTimestamp: string | null = null
    if (teeTime) teeTimeTimestamp = `${date}T${teeTime}:00`

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
      if (matchEnabled && matchConfig) {
        await createMatchAction({ ...matchConfig, roundId: result.roundId }).catch(() => {})
      }
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

  // ─── Loading ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-0">
        <LayoutContainer className="py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-20 rounded bg-bg-2" />
            <div className="h-7 w-48 rounded bg-bg-2" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
                <div className="h-5 w-32 rounded bg-bg-2 mb-3" />
                <div className="h-10 rounded-lg bg-bg-2" />
              </div>
            ))}
          </div>
        </LayoutContainer>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────

  const isMultiGroup = groups.length > 1

  return (
    <div className="min-h-screen bg-bg-0">
      <LayoutContainer className="py-6 pb-32">
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
            New Round
          </h1>
          <p className="text-sm text-text-2 mt-1">Pick your players, choose the format, tee it up.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ═══════════════════════════════════════════════
              SECTION 1: PLAYERS — the hero section
              ═══════════════════════════════════════════════ */}
          <section className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2">
                  Players
                </h2>
                {selectedCount > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent tabular-nums">
                    {selectedCount}
                  </span>
                )}
              </div>
              {players.length > 0 && (
                <button
                  type="button"
                  onClick={selectedCount === players.length ? deselectAllPlayers : selectAllPlayers}
                  className="text-xs font-medium text-accent active:opacity-70"
                >
                  {selectedCount === players.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {players.length === 0 ? (
              /* No players on this trip at all */
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🏌️</div>
                <p className="text-text-2 text-sm mb-3">No players on this trip yet</p>
                <Link href={`/trip/${tripId}/players`}>
                  <Button type="button" variant="secondary" size="default">
                    Add Players First
                  </Button>
                </Link>
              </div>
            ) : !isMultiGroup ? (
              /* ── Single group: toggle chip grid ── */
              <div className="flex flex-wrap gap-2">
                {players.map((player) => {
                  const isSelected = selectedPlayerIds.has(player.id)
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => togglePlayer(player.id)}
                      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-accent text-bg-0 shadow-sm shadow-accent/25'
                          : 'bg-bg-2 text-text-1 border border-stroke hover:border-accent/40'
                      }`}
                    >
                      <span>{player.name}</span>
                      {player.handicap_index !== null && (
                        <span className={`text-[11px] ${isSelected ? 'text-bg-0/60' : 'text-text-2/60'}`}>
                          {player.handicap_index}
                        </span>
                      )}
                      {isSelected && (
                        <svg className="h-4 w-4 -mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              /* ── Multi-group: group cards with drag/assign ── */
              <MultiGroupSection
                groups={groups}
                players={players}
                selectedPlayerIds={selectedPlayerIds}
                onAddPlayer={addPlayerToGroup}
                onRemovePlayer={removePlayerFromGroup}
                onAddGroup={addGroup}
                onRemoveGroup={removeGroup}
                onUpdateTeeTime={updateGroupTeeTime}
              />
            )}

            {/* Multi-group toggle (only show if >4 players and single group) */}
            {!isMultiGroup && players.length > 4 && (
              <button
                type="button"
                onClick={addGroup}
                className="mt-3 text-xs text-text-2 hover:text-accent transition-colors"
              >
                Need multiple groups? →
              </button>
            )}
          </section>

          {/* ═══════════════════════════════════════════════
              SECTION 2: ROUND DETAILS
              ═══════════════════════════════════════════════ */}
          <section className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-4">
              Details
            </h2>
            <div className="space-y-4">
              {/* Name */}
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

              {/* Date + Tee Time side by side */}
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
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text-1">
                    <ClockIcon />
                    Tee Time
                    <span className="text-text-2/50 text-[11px] font-normal">optional</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={teeTime}
                      onChange={(e) => setTeeTime(e.target.value)}
                      className={`w-full rounded-xl border bg-bg-2 px-4 py-3 focus:border-accent focus:outline-none text-[16px] transition-colors ${
                        teeTime ? 'border-accent/40 text-text-0' : 'border-stroke text-text-2/60'
                      }`}
                    />
                    {teeTime && (
                      <button
                        type="button"
                        onClick={() => setTeeTime('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2/50 hover:text-text-1"
                      >
                        <XCircleIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scoring toggle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-1">
                  Scoring
                </label>
                <div className="flex gap-2">
                  {([
                    { value: 'net' as const, label: 'Net', desc: 'Handicap applied' },
                    { value: 'gross' as const, label: 'Gross', desc: 'Raw scores' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setScoringBasis(opt.value)}
                      className={`flex-1 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                        scoringBasis === opt.value
                          ? 'border-accent bg-accent/10'
                          : 'border-stroke bg-bg-2'
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
          </section>

          {/* ═══════════════════════════════════════════════
              SECTION 3: FORMAT
              ═══════════════════════════════════════════════ */}
          <section className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-4">
              Format
            </h2>
            <RoundFormatSelector
              value={format}
              onChange={setFormat}
            />
          </section>

          {/* ═══════════════════════════════════════════════
              SECTION 4: COURSE
              ═══════════════════════════════════════════════ */}
          <section className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-4">
              Course
            </h2>
            {!manualCourseMode ? (
              <>
                <CourseSelector
                  selectedTeeId={selectedTeeId}
                  onTeeSelected={(teeId, courseName) => {
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
          </section>

          {/* ═══════════════════════════════════════════════
              CONDITIONAL: Team Assignment
              ═══════════════════════════════════════════════ */}
          {formatRequiresTeams(format) && selectedCount > 0 && (
            <div className="animate-fadeIn">
              <TeamAssignmentForm
                players={players.filter((p) => selectedPlayerIds.has(p.id))}
                assignments={teamAssignments}
                onChange={setTeamAssignments}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              CONDITIONAL: Match Play extras
              ═══════════════════════════════════════════════ */}
          {format === 'match_play' && selectedCount >= 2 && (
            <div className="animate-fadeIn">
              {!matchConfig ? (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold">
                      <MoneyIcon />
                    </div>
                    <div>
                      <p className="font-medium text-text-0">Money Game</p>
                      <p className="text-xs text-text-2">Configure teams and stakes</p>
                    </div>
                  </div>
                  {showMatchSetup ? (
                    <MatchSetupForm
                      players={players.filter((p) => selectedPlayerIds.has(p.id))}
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
                    if (!enabled) setMatchConfig(null)
                  }}
                  matchConfig={matchConfig}
                  onConfigure={() => setShowMatchSetup(true)}
                  players={players.filter((p) => selectedPlayerIds.has(p.id))}
                />
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              CONDITIONAL: Side Bets
              ═══════════════════════════════════════════════ */}
          {selectedCount >= 2 && (
            <div className="animate-fadeIn">
              <JunkConfigForm config={junkConfig} onChange={setJunkConfig} />
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              START IMMEDIATELY + ERROR
              ═══════════════════════════════════════════════ */}
          <button
            type="button"
            onClick={() => setStartImmediately(!startImmediately)}
            className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.99] ${
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
              <button type="button" onClick={() => setError(null)} className="ml-2 underline text-bad/70">dismiss</button>
            </div>
          )}
        </form>

        {/* ═══════════════════════════════════════════════
            STICKY BOTTOM CTA
            ═══════════════════════════════════════════════ */}
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-bg-0 via-bg-0/95 to-transparent pt-6 pb-safe px-4 z-10">
          <LayoutContainer>
            <div className="flex gap-3 mb-2">
              <Link href={`/trip/${tripId}`} className="shrink-0">
                <button
                  type="button"
                  className="h-[52px] rounded-xl border border-stroke bg-bg-1 px-5 font-medium text-text-1 active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
              </Link>
              <button
                type="submit"
                form="round-form"
                onClick={handleSubmit}
                disabled={submitting || !name.trim() || selectedCount === 0 || (!selectedTeeId && !manualCourseMode)}
                className="flex-1 flex items-center justify-center gap-2 h-[52px] rounded-xl bg-accent font-display font-bold text-bg-0 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
              >
                {submitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-bg-0 border-t-transparent" />
                ) : (
                  <>
                    {startImmediately ? 'Create & Score' : 'Create Round'}
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            </div>
          </LayoutContainer>
        </div>
      </LayoutContainer>
    </div>
  )
}

// ─── Multi-Group Section ───────────────────────────────

function MultiGroupSection({
  groups,
  players,
  selectedPlayerIds,
  onAddPlayer,
  onRemovePlayer,
  onAddGroup,
  onRemoveGroup,
  onUpdateTeeTime,
}: {
  groups: GroupConfig[]
  players: DbPlayer[]
  selectedPlayerIds: Set<string>
  onAddPlayer: (groupId: string, playerId: string) => void
  onRemovePlayer: (groupId: string, playerId: string) => void
  onAddGroup: () => void
  onRemoveGroup: (groupId: string) => void
  onUpdateTeeTime: (groupId: string, time: string) => void
}) {
  const unassigned = players.filter((p) => !selectedPlayerIds.has(p.id))

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={group.id} className="rounded-xl border border-stroke/40 bg-bg-2/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-sm font-bold text-text-0">
              Group {index + 1}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={group.teeTime}
                onChange={(e) => onUpdateTeeTime(group.id, e.target.value)}
                className="rounded-lg border border-stroke bg-bg-1 px-2.5 py-1.5 text-sm text-text-0 focus:border-accent focus:outline-none text-[16px]"
              />
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveGroup(group.id)}
                  className="p-1.5 text-text-2 hover:text-bad transition-colors rounded-lg"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.playerIds.map((pid) => {
              const p = players.find((pl) => pl.id === pid)
              if (!p) return null
              return (
                <div key={pid} className="flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 pl-3 pr-1.5 py-1.5">
                  <span className="text-sm font-medium text-text-0">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePlayer(group.id, pid)}
                    className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-bad/20 text-text-2 hover:text-bad transition-colors"
                  >
                    <XSmallIcon />
                  </button>
                </div>
              )
            })}
            {unassigned.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onAddPlayer(group.id, e.target.value)
                }}
                className="rounded-full border border-dashed border-stroke bg-bg-2 px-3 py-1.5 text-sm text-text-2 focus:border-accent focus:outline-none text-[16px]"
              >
                <option value="">+ Add</option>
                {unassigned.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAddGroup}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-stroke py-2.5 text-sm text-text-2 hover:border-accent/40 hover:text-accent transition-colors"
      >
        <PlusSmallIcon /> Add Group
      </button>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
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

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function MoneyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PlusSmallIcon() {
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

function XSmallIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
