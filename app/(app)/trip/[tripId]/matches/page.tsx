'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { MatchStatus } from '@/components/match'
import { getMatchesForTripAction, TripMatchSummary } from '@/lib/supabase/match-actions'
import { formatMoney, formatMatchStatus } from '@/lib/match-utils'
import { ShareButton } from '@/components/ui/ShareButton'
import { cn } from '@/lib/utils'

export default function MatchesPage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [matches, setMatches] = useState<TripMatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const result = await getMatchesForTripAction(tripId)

        if (result.error) {
          console.error('Failed to load matches:', result.error)
          setError(result.error)
        } else {
          setMatches(result.matches)
        }
      } catch (err) {
        console.error('Failed to load matches:', err)
        setError('An unexpected error occurred')
      }
      setLoading(false)
    }

    loadMatches()
  }, [tripId])

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="mb-6">
          <Link
            href={`/trip/${tripId}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            Back to trip
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">
            Matches
          </h1>
        </div>
        <div className="text-center text-text-2">Loading matches...</div>
      </LayoutContainer>
    )
  }

  if (error) {
    return (
      <LayoutContainer className="py-6">
        <div className="mb-6">
          <Link
            href={`/trip/${tripId}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            <BackIcon />
            Back to trip
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-0">
            Matches
          </h1>
        </div>
        <ErrorCard
          title="Unable to Load Matches"
          message="Money Games aren't available yet. Please try again later."
          backHref={`/trip/${tripId}`}
          backLabel="Back to Trip"
        />
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      <div className="mb-6">
        <Link
          href={`/trip/${tripId}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trip
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">
          Matches
        </h1>
      </div>

      {matches.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mb-4 text-4xl opacity-50">
            <span role="img" aria-label="golf flag">🏳️</span>
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-text-0">
            No Matches Yet
          </h2>
          <p className="mb-4 text-text-2">
            Add a money game when creating a new round to track match play betting.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard key={match.matchId} match={match} tripId={tripId} />
          ))}
        </div>
      )}
    </LayoutContainer>
  )
}

function MatchCard({ match, tripId }: { match: TripMatchSummary; tripId: string }) {
  const isComplete = match.status === 'completed'

  // Format type labels
  const typeLabels: Record<string, string> = {
    'match_play': 'MATCH PLAY',
    'nassau': 'NASSAU',
    'skins': 'SKINS',
    'wolf': 'WOLF',
  }
  const typeLabel = typeLabels[match.matchType] || match.matchType.toUpperCase()

  // Different link based on type
  const href = match.matchType === 'nassau' || match.matchType === 'skins'
    ? `/trip/${tripId}/round/${match.roundId}/score`
    : `/trip/${tripId}/round/${match.roundId}/match`

  return (
    <Link href={href}>
      <Card className="p-4 hover:border-accent/50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-medium text-text-0">{match.roundName}</div>
            <div className="text-xs text-text-2">
              {new Date(match.roundDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton
              title={`Match: ${match.teamANames} vs ${match.teamBNames}`}
              text={buildMatchShareText(match)}
            />
            {isComplete ? (
              <Badge variant="gold">Complete</Badge>
            ) : (
              <Badge variant="live">Live</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            {match.teamBNames ? (
              <div className="text-sm">
                <span className={cn(
                  'font-medium',
                  match.winner === 'team_a' && 'text-good'
                )}>
                  {match.teamANames}
                </span>
                <span className="text-text-2 mx-2">vs</span>
                <span className={cn(
                  'font-medium',
                  match.winner === 'team_b' && 'text-good'
                )}>
                  {match.teamBNames}
                </span>
              </div>
            ) : (
              <div className="text-sm font-medium text-text-0">
                {match.teamANames}
              </div>
            )}
            <div className="text-xs text-text-2 mt-1">
              {typeLabel} • {formatMoney(match.stakePerMan)}/{match.matchType === 'skins' ? 'skin' : 'man'}
              {match.matchType === 'nassau' && ' × 3 bets'}
              {match.pressCount > 0 && match.matchType !== 'nassau' && ` • ${match.pressCount} press${match.pressCount > 1 ? 'es' : ''}`}
            </div>
          </div>
          <div className="text-right">
            {isComplete ? (
              <span className="font-bold text-gold">{match.finalResult || 'Complete'}</span>
            ) : match.matchType === 'match_play' ? (
              <>
                <MatchStatus lead={match.currentLead} />
                <div className="text-xs text-text-2 mt-0.5">
                  thru {match.holesPlayed}
                </div>
              </>
            ) : (
              <span className="text-sm text-accent font-medium">In Progress</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

function buildMatchShareText(match: TripMatchSummary): string {
  if (match.status === 'completed' && match.winner && match.finalResult) {
    const winner = match.winner === 'team_a' ? match.teamANames : match.teamBNames
    return `🏆 Match Play: ${winner} wins ${match.finalResult} 💰`
  }
  if (match.holesPlayed > 0) {
    const lead = Math.abs(match.currentLead)
    const remaining = 18 - match.holesPlayed
    if (match.currentLead === 0) {
      return `⛳ ${match.teamANames} vs ${match.teamBNames} — All Square thru ${match.holesPlayed}`
    }
    const leader = match.currentLead > 0 ? match.teamANames : match.teamBNames
    return `⛳ ${leader} ${lead} UP with ${remaining} to play — ${match.teamANames} vs ${match.teamBNames}`
  }
  return `⛳ Match Play: ${match.teamANames} vs ${match.teamBNames}`
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
