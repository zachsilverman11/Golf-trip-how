'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { getTripMoneyTotalsAction, type PlayerMoneyTotal } from '@/lib/supabase/match-actions'
import { getTripFormatStandingsAction } from '@/lib/supabase/format-actions'
import { getWarTotalsAction, type WarTotals } from '@/lib/supabase/war-actions'
import { WarTotalsCard } from '@/components/settle/WarTotalsCard'
import { formatMoney } from '@/lib/match-utils'
import { cn } from '@/lib/utils'
import type { TripFormatStandings } from '@/lib/format-types'

export default function SettlePage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [playerTotals, setPlayerTotals] = useState<PlayerMoneyTotal[]>([])
  const [formatStandings, setFormatStandings] = useState<TripFormatStandings | null>(null)
  const [warTotals, setWarTotals] = useState<WarTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [moneyResult, formatResult, warResult] = await Promise.all([
          getTripMoneyTotalsAction(tripId),
          getTripFormatStandingsAction(tripId),
          getWarTotalsAction(tripId),
        ])

        if (!moneyResult.success) {
          console.error('Failed to load money totals:', moneyResult.error)
          setError(moneyResult.error || 'Failed to load money totals')
        } else {
          setPlayerTotals(moneyResult.playerTotals)
        }

        if (formatResult.standings) {
          setFormatStandings(formatResult.standings)
        }

        if (warResult.totals) {
          setWarTotals(warResult.totals)
        }
      } catch (err) {
        console.error('Failed to load settle data:', err)
        setError('An unexpected error occurred')
      }

      setLoading(false)
    }

    loadData()
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
            Trip Money
          </h1>
        </div>
        <div className="text-center text-text-2">Loading...</div>
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
            Trip Money
          </h1>
        </div>
        <ErrorCard
          title="Unable to Load Settlements"
          message="Settlement data isn't available yet. Please try again later."
          backHref={`/trip/${tripId}`}
          backLabel="Back to Trip"
        />
      </LayoutContainer>
    )
  }

  const hasMoneyData = playerTotals.length > 0
  const hasFormatData = formatStandings &&
    (formatStandings.pointsHiLoRoundCount > 0 || formatStandings.stablefordRoundCount > 0)

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
          Trip Money
        </h1>
      </div>

      {/* Team Competition Totals (if enabled and has data) */}
      {warTotals && (warTotals.teamA.points > 0 || warTotals.teamB.points > 0 || (warTotals.rounds && warTotals.rounds.length > 0)) && (
        <WarTotalsCard totals={warTotals} className="mb-4" />
      )}

      {/* Format Standings (if any format rounds played) */}
      {hasFormatData && (
        <FormatStandingsCard standings={formatStandings} className="mb-4" />
      )}

      {!hasMoneyData ? (
        <Card className="p-8 text-center">
          <div className="mb-4 text-4xl opacity-50">
            <span role="img" aria-label="money">💰</span>
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-text-0">
            No Completed Money Games Yet
          </h2>
          <p className="text-text-2">
            Complete some money games to see trip standings here.
          </p>
        </Card>
      ) : (
        <>
          {/* Summary Card */}
          <Card className="p-4 mb-4">
            <h2 className="font-display font-bold text-text-0 mb-3">
              Standings
            </h2>
            <p className="text-xs text-text-2 mb-4">
              All amounts are per player. Click a row to see details.
            </p>

            <div className="space-y-2">
              {playerTotals.map((player, index) => {
                const isExpanded = expandedPlayer === player.playerId
                const isPositive = player.totalWinnings > 0
                const isNegative = player.totalWinnings < 0

                return (
                  <div key={player.playerId}>
                    <button
                      onClick={() => setExpandedPlayer(isExpanded ? null : player.playerId)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left',
                        isExpanded ? 'bg-accent/10' : 'bg-bg-2 hover:bg-bg-2/80'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          index === 0 && isPositive ? 'bg-gold text-bg-0' : 'bg-bg-1 text-text-2'
                        )}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-text-0">
                          {player.playerName}
                        </span>
                      </div>
                      <div className={cn(
                        'font-bold',
                        isPositive && 'text-good',
                        isNegative && 'text-bad',
                        !isPositive && !isNegative && 'text-text-2'
                      )}>
                        {isPositive && '+'}{formatMoney(player.totalWinnings)}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && player.matchResults.length > 0 && (
                      <div className="mt-2 ml-9 space-y-1">
                        {player.matchResults.map((result, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-bg-1"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-text-1">{result.roundName}</span>
                              <span className="text-text-2 ml-2">{result.description}</span>
                            </div>
                            <span className={cn(
                              'font-medium ml-2',
                              result.amount > 0 ? 'text-good' : 'text-bad'
                            )}>
                              {result.amount > 0 && '+'}{formatMoney(result.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Settlement Info */}
          <Card className="p-4">
            <h2 className="font-display font-bold text-text-0 mb-3">
              Settlement
            </h2>
            <p className="text-sm text-text-2 mb-3">
              Based on the standings above, here&apos;s who owes what:
            </p>

            <SettlementMatrix playerTotals={playerTotals} />
          </Card>
        </>
      )}
    </LayoutContainer>
  )
}

/**
 * Format standings card showing Points Hi/Lo and Stableford totals
 * These are separate from money - just friendly competition
 */
function FormatStandingsCard({
  standings,
  className,
}: {
  standings: TripFormatStandings
  className?: string
}) {
  const hasPointsHiLo = standings.pointsHiLoRoundCount > 0
  const hasStableford = standings.stablefordRoundCount > 0

  return (
    <Card className={cn('p-4', className)}>
      <h2 className="font-display font-bold text-text-0 mb-1">
        Format Standings
      </h2>
      <p className="text-xs text-text-2 mb-4">
        Player totals across rounds (teams rotate each round)
      </p>

      <div className="space-y-4">
        {/* Points Hi/Lo */}
        {hasPointsHiLo && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-1">Points (Hi/Lo)</h3>
              <span className="text-xs text-text-2">
                {standings.pointsHiLoRoundCount} rd{standings.pointsHiLoRoundCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {standings.pointsHiLo.slice(0, 4).map((player, idx) => (
                <div
                  key={player.playerId}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                    idx === 0 ? 'bg-gold/15 text-gold' : 'bg-bg-2 text-text-1'
                  )}
                >
                  <span className="font-medium">{idx + 1}.</span>
                  <span>{player.playerName.split(' ')[0]}</span>
                  <span className="font-bold">
                    {player.total % 1 === 0 ? player.total : player.total.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stableford */}
        {hasStableford && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-1">Stableford</h3>
              <span className="text-xs text-text-2">
                {standings.stablefordRoundCount} rd{standings.stablefordRoundCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {standings.stableford.slice(0, 4).map((player, idx) => (
                <div
                  key={player.playerId}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                    idx === 0 ? 'bg-gold/15 text-gold' : 'bg-bg-2 text-text-1'
                  )}
                >
                  <span className="font-medium">{idx + 1}.</span>
                  <span>{player.playerName.split(' ')[0]}</span>
                  <span className="font-bold">{player.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Calculate and display the simplest settlement between players
 */
function SettlementMatrix({ playerTotals }: { playerTotals: PlayerMoneyTotal[] }) {
  // Simple settlement algorithm:
  // Sort by balance, then have losers pay winners starting from biggest
  const winners = playerTotals
    .filter(p => p.totalWinnings > 0)
    .sort((a, b) => b.totalWinnings - a.totalWinnings)

  const losers = playerTotals
    .filter(p => p.totalWinnings < 0)
    .sort((a, b) => a.totalWinnings - b.totalWinnings) // Most negative first

  if (winners.length === 0 || losers.length === 0) {
    return (
      <p className="text-sm text-text-2 italic">
        No settlements needed - all players are even.
      </p>
    )
  }

  // Calculate settlements
  const settlements: { from: string; to: string; amount: number }[] = []
  const winnerBalances = winners.map(w => ({ ...w, remaining: w.totalWinnings }))
  const loserBalances = losers.map(l => ({ ...l, remaining: Math.abs(l.totalWinnings) }))

  for (const loser of loserBalances) {
    for (const winner of winnerBalances) {
      if (loser.remaining <= 0) break
      if (winner.remaining <= 0) continue

      const amount = Math.min(loser.remaining, winner.remaining)
      if (amount > 0) {
        settlements.push({
          from: loser.playerName,
          to: winner.playerName,
          amount,
        })
        loser.remaining -= amount
        winner.remaining -= amount
      }
    }
  }

  return (
    <div className="space-y-2">
      {settlements.map((s, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between bg-bg-2 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-text-0">{s.from}</span>
            <span className="text-text-2">→</span>
            <span className="font-medium text-text-0">{s.to}</span>
          </div>
          <span className="font-bold text-accent">
            {formatMoney(s.amount)}
          </span>
        </div>
      ))}
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
