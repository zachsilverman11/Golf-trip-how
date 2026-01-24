'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { DbRoundSummary } from '@/lib/supabase/types'

interface SetupChecklistProps {
  tripId: string
  playerCount: number
  roundCount: number
  rounds: DbRoundSummary[]
}

export function SetupChecklist({
  tripId,
  playerCount,
  roundCount,
  rounds,
}: SetupChecklistProps) {
  const hasPlayers = playerCount > 0
  const hasRounds = roundCount > 0
  const isSetupComplete = hasPlayers && hasRounds

  // Check for in-progress round
  const inProgressRound = rounds.find((r) => r.status === 'in_progress')

  // Show "Continue Scoring" CTA if there's an in-progress round
  if (isSetupComplete && inProgressRound) {
    return (
      <Card className="mb-6 border-good/30 bg-good/5 p-4">
        <Link href={`/trip/${tripId}/round/${inProgressRound.id}/score`}>
          <Button size="large" className="w-full">
            <LiveIcon />
            Continue Scoring: {inProgressRound.name}
          </Button>
        </Link>
      </Card>
    )
  }

  // Don't show checklist when setup is complete (and no in-progress round)
  if (isSetupComplete) return null

  // Determine primary CTA
  const primaryCTA = getPrimaryCTA(tripId, playerCount, rounds)

  return (
    <Card className="mb-6 border-accent/30 bg-accent/5 p-4">
      <h2 className="mb-4 font-display text-lg font-bold text-text-0">
        Get Your Trip Ready
      </h2>

      <div className="space-y-2">
        <ChecklistItem
          completed={hasPlayers}
          label="Add players"
          href={`/trip/${tripId}/players`}
          count={playerCount}
        />
        <ChecklistItem
          completed={hasRounds}
          label="Create first round"
          href={`/trip/${tripId}/round/new`}
          count={roundCount}
          disabled={!hasPlayers}
          disabledHint="Add players first"
        />
      </div>

      {/* Primary CTA inside checklist */}
      {primaryCTA && (
        <Link href={primaryCTA.href} className="mt-4 block">
          <Button size="large" className="w-full">
            {primaryCTA.label}
          </Button>
        </Link>
      )}
    </Card>
  )
}

function LiveIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4" className="animate-pulse" />
    </svg>
  )
}

interface ChecklistItemProps {
  completed: boolean
  label: string
  href: string
  count?: number
  disabled?: boolean
  disabledHint?: string
}

function ChecklistItem({
  completed,
  label,
  href,
  count,
  disabled,
  disabledHint,
}: ChecklistItemProps) {
  const content = (
    <div
      className={`flex items-center justify-between rounded-card-sm px-3 py-2.5 transition-colors ${
        completed
          ? 'bg-good/10'
          : disabled
            ? 'bg-bg-1 opacity-60'
            : 'bg-bg-2 hover:bg-bg-2/80'
      }`}
    >
      <div className="flex items-center gap-3">
        {completed ? (
          <CheckCircleIcon className="h-5 w-5 text-good" />
        ) : (
          <CircleIcon className={`h-5 w-5 ${disabled ? 'text-text-2/50' : 'text-text-2'}`} />
        )}
        <span
          className={`text-sm ${
            completed ? 'text-text-1' : disabled ? 'text-text-2' : 'text-text-0'
          }`}
        >
          {label}
        </span>
        {disabled && disabledHint && (
          <span className="text-xs text-text-2">({disabledHint})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {count !== undefined && count > 0 && (
          <Badge variant={completed ? 'positive' : 'default'}>{count}</Badge>
        )}
        {!disabled && <ChevronRightIcon className="h-4 w-4 text-text-2" />}
      </div>
    </div>
  )

  if (disabled) return content
  return <Link href={href}>{content}</Link>
}

function getPrimaryCTA(
  tripId: string,
  playerCount: number,
  rounds: DbRoundSummary[]
): { label: string; href: string } | null {
  // No players -> Add Players
  if (playerCount === 0) {
    return {
      label: 'Add Players',
      href: `/trip/${tripId}/players`,
    }
  }

  // Has players but no rounds -> Create First Round
  if (rounds.length === 0) {
    return {
      label: 'Create First Round',
      href: `/trip/${tripId}/round/new`,
    }
  }

  // Has rounds, check for in-progress
  const inProgressRound = rounds.find((r) => r.status === 'in_progress')
  if (inProgressRound) {
    return {
      label: 'Continue Scoring',
      href: `/trip/${tripId}/round/${inProgressRound.id}/score`,
    }
  }

  // Has rounds but none in progress
  const upcomingRound = rounds.find((r) => r.status === 'upcoming')
  if (upcomingRound) {
    return {
      label: 'Start Scoring',
      href: `/trip/${tripId}/round/${upcomingRound.id}`,
    }
  }

  return null
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  )
}
