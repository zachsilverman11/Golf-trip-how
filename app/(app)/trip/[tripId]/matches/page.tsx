'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MatchStatus } from '@/components/match'
import { getMatchesForTripAction, TripMatchSummary } from '@/lib/supabase/match-actions'
import { formatMoney, formatMatchStatus } from '@/lib/match-utils'
import { cn } from '@/lib/utils'

export default function MatchesPage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [matches, setMatches] = useState<TripMatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMatches = async () => {
      const result = await getMatchesForTripAction(tripId)

      if (result.error) {
        setError(result.error)
      } else {
        setMatches(result.matches)
      }
      setLoading(false)
    }

    loadMatches()
  }, [tripId])

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <h1 className="mb-6 font-display text-2xl font-bold text-text-0">
          Matches
        </h1>
        <div className="text-center text-text-2">Loading matches...</div>
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-text-0">
        Matches
      </h1>

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
  const statusText = isComplete
    ? match.finalResult
    : formatMatchStatus(match.currentLead, 18 - match.holesPlayed, false)

  return (
    <Link href={`/trip/${tripId}/round/${match.roundId}/match`}>
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
            {isComplete ? (
              <Badge variant="gold">Complete</Badge>
            ) : (
              <Badge variant="live">Live</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
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
            <div className="text-xs text-text-2 mt-1">
              {match.matchType.toUpperCase()} • {formatMoney(match.stakePerMan)}/man
              {match.pressCount > 0 && ` • ${match.pressCount} press${match.pressCount > 1 ? 'es' : ''}`}
            </div>
          </div>
          <div className="text-right">
            {isComplete ? (
              <span className="font-bold text-gold">{match.finalResult}</span>
            ) : (
              <MatchStatus lead={match.currentLead} />
            )}
            {!isComplete && (
              <div className="text-xs text-text-2 mt-0.5">
                thru {match.holesPlayed}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
