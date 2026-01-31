'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlayerEntry } from '@/components/quick-round/PlayerEntry'
import { QuickRoundTeams } from '@/components/quick-round/QuickRoundTeams'
import { WizardStep } from '@/components/quick-round/WizardStep'
import { CourseSelector } from '@/components/round/CourseSelector'
import { RoundFormatSelector, type RoundFormat } from '@/components/round/RoundFormatSelector'
import { createQuickRoundAction } from '@/lib/supabase/quick-round-actions'
import { useQuickRoundDraft, type QuickRoundPlayer } from '@/hooks/useQuickRoundDraft'

// ── Helpers ──────────────────────────────────────────────

function shouldShowTeams(format: RoundFormat, playerCount: number): boolean {
  if (format === 'points_hilo') return playerCount === 4
  if (format === 'match_play') return playerCount === 4
  return false
}

function teamsRequired(format: RoundFormat, playerCount: number): boolean {
  if (format === 'points_hilo') return true
  if (format === 'match_play' && playerCount === 4) return true
  return false
}

function getPlayerCountError(format: RoundFormat, playerCount: number): string | null {
  if (format === 'match_play') {
    if (playerCount !== 2 && playerCount !== 4 && playerCount > 0) {
      return 'Match play requires 2 players (1v1) or 4 players (2v2)'
    }
  }
  if (format === 'points_hilo') {
    if (playerCount !== 4 && playerCount > 0) {
      return 'Points Hi/Lo requires exactly 4 players'
    }
  }
  return null
}

const FORMAT_LABELS: Record<RoundFormat, string> = {
  stroke_play: 'Stroke Play',
  match_play: 'Match Play',
  points_hilo: 'Points Hi/Lo',
  stableford: 'Stableford',
}

// ── Component ────────────────────────────────────────────

export default function QuickRoundPage() {
  const router = useRouter()
  const { draft, isHydrated, updateDraft, clearDraft } = useQuickRoundDraft()
  const submitRef = useRef(false)

  // Wizard state
  const [activeStep, setActiveStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Step completion logic ──

  const completeStep = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]))
    // Auto-advance to the next uncompleted step
    if (step < 3) {
      setActiveStep(step + 1)
    } else {
      // After step 3, collapse everything — Go section is always visible
      setActiveStep(0)
    }
  }

  const expandStep = (step: number) => {
    setActiveStep(step)
  }

  // ── Player actions ──

  const addPlayer = (name: string, handicap: number | null) => {
    const newPlayer: QuickRoundPlayer = {
      id: crypto.randomUUID(),
      name,
      handicap,
    }
    updateDraft({ players: [...draft.players, newPlayer] })
  }

  const removePlayer = (id: string) => {
    updateDraft({ players: draft.players.filter((p) => p.id !== id) })
  }

  // ── Summaries ──

  const playersSummary = draft.players.length > 0
    ? `${draft.players.length} player${draft.players.length !== 1 ? 's' : ''}: ${draft.players.map(p => p.name).join(', ')}`
    : undefined

  const formatSummary = `${FORMAT_LABELS[draft.format]} · ${draft.scoringBasis === 'net' ? 'Net' : 'Gross'}`

  const courseSummary = draft.courseDisplayName
    ? `${draft.courseDisplayName}${draft.teeName ? ` — ${draft.teeName}` : ''}`
    : 'No course selected'

  // ── Validation ──

  const playerCountError = getPlayerCountError(draft.format, draft.players.length)
  const hasValidPlayerCount = draft.players.length > 0 && !playerCountError
  const needsTeams = teamsRequired(draft.format, draft.players.length)
  const hasValidTeams = !needsTeams || (
    Object.values(draft.teamAssignments).filter(t => t === 1).length === 2 &&
    Object.values(draft.teamAssignments).filter(t => t === 2).length === 2
  )
  const isValid = hasValidPlayerCount && hasValidTeams

  const step1Complete = completedSteps.has(1)
  const step2Complete = completedSteps.has(2)
  const showTeamsUI = shouldShowTeams(draft.format, draft.players.length)

  // ── Submit ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitRef.current || submitting) return

    if (draft.players.length === 0) {
      setError('Add at least one player')
      return
    }

    if (playerCountError) {
      setError(playerCountError)
      return
    }

    if (teamsRequired(draft.format, draft.players.length)) {
      const team1Count = Object.values(draft.teamAssignments).filter(t => t === 1).length
      const team2Count = Object.values(draft.teamAssignments).filter(t => t === 2).length
      if (team1Count !== 2 || team2Count !== 2) {
        setError('Teams must have exactly 2 players each')
        return
      }
    }

    submitRef.current = true
    setSubmitting(true)
    setError(null)

    const teamAssignmentsByIndex = teamsRequired(draft.format, draft.players.length)
      ? Object.fromEntries(
          draft.players.map((player, idx) => [
            idx.toString(),
            draft.teamAssignments[player.id],
          ])
        ) as Record<string, 1 | 2>
      : undefined

    const result = await createQuickRoundAction({
      players: draft.players.map((p) => ({ name: p.name, handicap: p.handicap })),
      teeId: draft.teeId,
      courseName: draft.courseDisplayName || null,
      format: draft.format,
      scoringBasis: draft.scoringBasis,
      teeTime: draft.teeTime || null,
      teamAssignments: teamAssignmentsByIndex,
    })

    if (result.success && result.tripId && result.roundId) {
      clearDraft()
      if (draft.startImmediately) {
        router.push(`/trip/${result.tripId}/round/${result.roundId}/score`)
      } else {
        router.push(`/trip/${result.tripId}/round/${result.roundId}`)
      }
    } else {
      setError(result.error || 'Failed to create round')
      setSubmitting(false)
      submitRef.current = false
    }
  }

  // ── Loading skeleton ──

  if (!isHydrated) {
    return (
      <LayoutContainer className="py-6">
        <div className="mb-6">
          <Link
            href="/trips"
            className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            Back to trips
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">Quick Round</h1>
          <p className="text-sm text-text-2">Start a round in seconds</p>
        </div>
        <Card className="p-4 mb-3">
          <div className="h-32 animate-pulse bg-bg-2 rounded-card-sm" />
        </Card>
        <Card className="p-4 mb-3">
          <div className="h-24 animate-pulse bg-bg-2 rounded-card-sm" />
        </Card>
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/trips"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trips
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">Quick Round</h1>
        <p className="text-sm text-text-2">Start a round in seconds</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {/* ── Step 1: Players ── */}
          <WizardStep
            step={1}
            title="Players"
            summary={playersSummary}
            isActive={activeStep === 1}
            isComplete={step1Complete}
            onExpand={() => expandStep(1)}
          >
            <PlayerEntry
              players={draft.players}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
            />
            {/* Player count hint for team formats */}
            {(draft.format === 'match_play' || draft.format === 'points_hilo') && draft.players.length > 0 && draft.players.length < 4 && (
              <p className="mt-2 text-xs text-text-2">
                {draft.format === 'match_play'
                  ? `Add ${draft.players.length === 1 ? '1 more player for 1v1' : `${4 - draft.players.length} more for 2v2`}`
                  : `Add ${4 - draft.players.length} more player${4 - draft.players.length > 1 ? 's' : ''} for Points Hi/Lo`
                }
              </p>
            )}
            {draft.players.length > 0 && (
              <Button
                type="button"
                size="default"
                className="w-full mt-4"
                onClick={() => completeStep(1)}
              >
                Next
              </Button>
            )}
          </WizardStep>

          {/* ── Step 2: Format ── */}
          <WizardStep
            step={2}
            title="Format"
            summary={step2Complete ? formatSummary : undefined}
            isActive={activeStep === 2}
            isComplete={step2Complete}
            onExpand={() => expandStep(2)}
          >
            <RoundFormatSelector
              value={draft.format}
              onChange={(format) => updateDraft({ format })}
            />

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-text-1">
                Scoring Basis
              </label>
              <select
                value={draft.scoringBasis}
                onChange={(e) => updateDraft({ scoringBasis: e.target.value as 'gross' | 'net' })}
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="net">Net (Handicap)</option>
                <option value="gross">Gross</option>
              </select>
            </div>

            {/* Teams UI inline if applicable */}
            {showTeamsUI && (
              <div className="mt-4">
                <QuickRoundTeams
                  players={draft.players}
                  teamAssignments={draft.teamAssignments}
                  onTeamAssignmentsChange={(assignments) => updateDraft({ teamAssignments: assignments })}
                />
              </div>
            )}

            {playerCountError && (
              <div className="mt-3 rounded-card-sm bg-warning/10 p-3 text-warning text-sm">
                {playerCountError}
              </div>
            )}

            <Button
              type="button"
              size="default"
              className="w-full mt-4"
              disabled={!!playerCountError || (needsTeams && !hasValidTeams)}
              onClick={() => completeStep(2)}
            >
              Next
            </Button>
          </WizardStep>

          {/* ── Step 3: Course (optional) ── */}
          <WizardStep
            step={3}
            title="Course"
            summary={step2Complete || completedSteps.has(3) ? courseSummary : undefined}
            isActive={activeStep === 3}
            isComplete={completedSteps.has(3)}
            optional
            onExpand={() => expandStep(3)}
          >
            <CourseSelector
              selectedTeeId={draft.teeId}
              initialCourseInfo={
                draft.courseDisplayName && draft.teeName
                  ? { name: draft.courseDisplayName, teeName: draft.teeName }
                  : null
              }
              onTeeSelected={(teeId, courseName, teeName) => {
                updateDraft({
                  teeId,
                  courseDisplayName: courseName,
                  teeName,
                })
              }}
            />
            <Button
              type="button"
              variant={draft.teeId ? 'primary' : 'secondary'}
              size="default"
              className="w-full mt-4"
              onClick={() => completeStep(3)}
            >
              {draft.teeId ? 'Next' : 'Skip — No Course'}
            </Button>
          </WizardStep>
        </div>

        {/* ── Step 4: Go (always visible once Step 1 done) ── */}
        {step1Complete && (
          <Card className="mt-6 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-bg-0 text-sm font-bold">
                4
              </div>
              <span className="font-display font-bold text-sm text-text-0">Go!</span>
            </div>

            {/* Tee time */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-text-1">
                Tee Time <span className="text-text-2 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={draft.teeTime || ''}
                onChange={(e) => updateDraft({ teeTime: e.target.value || null })}
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Start immediately toggle */}
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={draft.startImmediately}
                onChange={(e) => updateDraft({ startImmediately: e.target.checked })}
                className="h-5 w-5 rounded border-stroke bg-bg-2 text-accent focus:ring-accent focus:ring-offset-bg-0"
              />
              <div>
                <p className="font-medium text-text-0 text-sm">Start scoring immediately</p>
                <p className="text-xs text-text-2">Jump straight to the scorecard</p>
              </div>
            </label>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-card-sm bg-bad/10 p-3 text-bad text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              size="large"
              loading={submitting}
              disabled={submitting || !isValid}
              className="w-full"
            >
              {draft.startImmediately ? 'Start Round' : 'Create Round'}
            </Button>
          </Card>
        )}
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
