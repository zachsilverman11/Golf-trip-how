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
import { getTripJunkBetsAction } from '@/lib/supabase/junk-actions'
import { getPlayersAction } from '@/lib/supabase/player-actions'
import { WarTotalsCard } from '@/components/settle/WarTotalsCard'
import { formatMoney } from '@/lib/match-utils'
import { calculateJunkSettlement, formatJunkValue } from '@/lib/junk-utils'
import { JUNK_TYPES, type RoundJunkConfig, type DbJunkBet, type RoundJunkSettlement } from '@/lib/junk-types'
import { Badge } from '@/components/ui/Badge'
import { ShareButton } from '@/components/ui/ShareButton'
import { cn } from '@/lib/utils'
import type { TripFormatStandings } from '@/lib/format-types'
import type { DbPlayer } from '@/lib/supabase/types'

export default function SettlePage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [playerTotals, setPlayerTotals] = useState<PlayerMoneyTotal[]>([])
  const [formatStandings, setFormatStandings] = useState<TripFormatStandings | null>(null)
  const [warTotals, setWarTotals] = useState<WarTotals | null>(null)
  const [junkSettlements, setJunkSettlements] = useState<RoundJunkSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [moneyResult, formatResult, warResult, junkResult, playersResult] = await Promise.all([
          getTripMoneyTotalsAction(tripId),
          getTripFormatStandingsAction(tripId),
          getWarTotalsAction(tripId),
          getTripJunkBetsAction(tripId),
          getPlayersAction(tripId),
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

        // Calculate junk settlements
        if (junkResult.roundBets && junkResult.roundBets.length > 0 && playersResult.players) {
          const players = playersResult.players as DbPlayer[]
          const playerNames: Record<string, string> = {}
          for (const p of players) {
            playerNames[p.id] = p.name
          }
          const playerIds = players.map((p) => p.id)

          const settlements = junkResult.roundBets
            .filter((rb) => rb.bets.length > 0 && rb.config?.enabled)
            .map((rb) =>
              calculateJunkSettlement(
                rb.roundId,
                rb.roundName,
                rb.bets,
                playerIds,
                playerNames,
                rb.config!
              )
            )

          setJunkSettlements(settlements)
        }
      } catch (err) {
        console.error('Failed to load settle data:', err)
        setError('An unexpected error occurred')
      }

      setLoading(false)
    }

    loadData()
  }, [tripId])

  // Calculate grand total for hero number
  const topWinner = playerTotals.length > 0
    ? playerTotals.reduce((best, p) => p.totalWinnings > best.totalWinnings ? p : best, playerTotals[0])
    : null
  const topLoser = playerTotals.length > 0
    ? playerTotals.reduce((worst, p) => p.totalWinnings < worst.totalWinnings ? p : worst, playerTotals[0])
    : null

  // Build share text
  const buildShareText = () => {
    if (playerTotals.length === 0) return '💰 Trip Money — No games played yet'
    const lines = playerTotals.map((p) => {
      const prefix = p.totalWinnings > 0 ? '+' : ''
      return `${p.playerName}: ${prefix}${formatMoney(p.totalWinnings)}`
    })
    return `💰 Trip Money\n${lines.join('\n')}`
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-0">
        <LayoutContainer className="py-6">
          <div className="mb-6">
            <div className="h-4 w-20 rounded bg-bg-2 animate-pulse mb-2" />
            <div className="h-7 w-36 rounded bg-bg-2 animate-pulse" />
          </div>
          {/* Skeleton hero */}
          <div className="rounded-xl bg-bg-1 border border-stroke/40 p-6 mb-4 animate-pulse">
            <div className="h-12 w-24 rounded bg-bg-2 mx-auto mb-2" />
            <div className="h-4 w-32 rounded bg-bg-2 mx-auto" />
          </div>
          {/* Skeleton rows */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-2 rounded-xl bg-bg-1 border border-stroke/40 p-4 animate-pulse">
              <div className="flex justify-between">
                <div className="h-5 w-24 rounded bg-bg-2" />
                <div className="h-5 w-16 rounded bg-bg-2" />
              </div>
            </div>
          ))}
        </LayoutContainer>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-bg-0">
        <LayoutContainer className="py-6">
          <div className="mb-6">
            <Link
              href={`/trip/${tripId}`}
              className="mb-2 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
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
      </div>
    )
  }

  const hasMoneyData = playerTotals.length > 0
  const hasFormatData = formatStandings &&
    (formatStandings.pointsHiLoRoundCount > 0 || formatStandings.stablefordRoundCount > 0)

  return (
    <div className="min-h-[100dvh] bg-bg-0">
      <LayoutContainer className="py-6 pb-safe">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link
              href={`/trip/${tripId}`}
              className="mb-2 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
            >
              <BackIcon />
              Back to trip
            </Link>
            <h1 className="font-display text-2xl font-bold text-text-0">
              Trip Money
            </h1>
          </div>
          {hasMoneyData && (
            <ShareButton
              title="Trip Money"
              text={buildShareText()}
            />
          )}
        </div>

        {/* ── Hero Number ── */}
        {hasMoneyData && topWinner && topWinner.totalWinnings > 0 && (
          <div className="mb-6 rounded-2xl bg-gradient-to-br from-bg-1 to-bg-2 border border-stroke/40 p-6 text-center animate-fadeIn">
            <p className="text-xs text-text-2 uppercase tracking-widest mb-2">Top Earner</p>
            <p className="font-display text-lg font-bold text-text-0 mb-1">
              {topWinner.playerName}
            </p>
            <p className="font-display text-4xl font-extrabold text-good tabular-nums">
              +{formatMoney(topWinner.totalWinnings)}
            </p>
            {topLoser && topLoser.totalWinnings < 0 && (
              <p className="text-xs text-text-2 mt-3">
                {topLoser.playerName} owes the most: <span className="text-bad font-medium">{formatMoney(topLoser.totalWinnings)}</span>
              </p>
            )}
          </div>
        )}

        {/* Team Competition Totals (if enabled and has data) */}
        {warTotals && (warTotals.teamA.points > 0 || warTotals.teamB.points > 0 || (warTotals.rounds && warTotals.rounds.length > 0)) && (
          <WarTotalsCard totals={warTotals} className="mb-4" />
        )}

        {/* Format Standings (if any format rounds played) */}
        {hasFormatData && (
          <FormatStandingsCard standings={formatStandings} className="mb-4" />
        )}

        {/* Junk/Side Bet Settlements */}
        {junkSettlements.length > 0 && (
          <JunkSettlementCard settlements={junkSettlements} className="mb-4" />
        )}

        {!hasMoneyData ? (
          <div className="rounded-2xl bg-bg-1 border border-stroke/40 p-8 text-center">
            <div className="mb-4 text-5xl">💰</div>
            <h2 className="mb-2 font-display text-xl font-bold text-text-0">
              No Money Games Yet
            </h2>
            <p className="text-text-2 text-sm mb-6 max-w-[260px] mx-auto">
              Complete some money games and the standings will appear here.
            </p>
            <Link href={`/trip/${tripId}/round/new`}>
              <button className="rounded-xl bg-accent px-6 py-3 font-display font-bold text-bg-0 text-sm active:scale-[0.98] transition-transform">
                Start a Round →
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Standings Table */}
            <div className="mb-4 rounded-xl bg-bg-1 border border-stroke/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-stroke/30">
                <h2 className="font-display font-bold text-text-0">
                  Standings
                </h2>
                <p className="text-[11px] text-text-2 mt-0.5">
                  Tap a player to see round-by-round breakdown
                </p>
              </div>

              <div className="divide-y divide-stroke/20">
                {playerTotals.map((player, index) => {
                  const isExpanded = expandedPlayer === player.playerId
                  const isPositive = player.totalWinnings > 0
                  const isNegative = player.totalWinnings < 0

                  return (
                    <div key={player.playerId}>
                      <button
                        onClick={() => setExpandedPlayer(isExpanded ? null : player.playerId)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
                          isExpanded ? 'bg-accent/5' : 'active:bg-bg-2'
                        )}
                      >
                        {/* Rank badge */}
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          index === 0 && isPositive ? 'bg-gold text-bg-0' : 'bg-bg-2 text-text-2'
                        )}>
                          {index === 0 && isPositive ? '👑' : index + 1}
                        </div>

                        <span className="flex-1 font-medium text-text-0">
                          {player.playerName}
                        </span>

                        <span className={cn(
                          'font-display text-lg font-bold tabular-nums',
                          isPositive && 'text-good',
                          isNegative && 'text-bad',
                          !isPositive && !isNegative && 'text-text-2'
                        )}>
                          {isPositive && '+'}{formatMoney(player.totalWinnings)}
                        </span>

                        {/* Expand indicator */}
                        <svg
                          className={cn(
                            'h-4 w-4 text-text-2/40 transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {/* Expanded round details */}
                      {isExpanded && player.matchResults.length > 0 && (
                        <div className="px-4 pb-3 animate-fadeIn">
                          <div className="ml-11 space-y-1">
                            {player.matchResults.map((result, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-bg-2/50"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-text-1 font-medium">{result.roundName}</span>
                                  <span className="text-text-2/60 ml-1.5">{result.description}</span>
                                </div>
                                <span className={cn(
                                  'font-bold ml-2 tabular-nums',
                                  result.amount > 0 ? 'text-good' : 'text-bad'
                                )}>
                                  {result.amount > 0 && '+'}{formatMoney(result.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Settlement Matrix */}
            <div className="rounded-xl bg-bg-1 border border-stroke/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-stroke/30">
                <h2 className="font-display font-bold text-text-0">
                  Who Pays Who
                </h2>
                <p className="text-[11px] text-text-2 mt-0.5">
                  Simplified payments to square up
                </p>
              </div>
              <div className="p-4">
                <SettlementMatrix playerTotals={playerTotals} />
              </div>
            </div>
          </>
        )}
      </LayoutContainer>
    </div>
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
    <div className={cn('rounded-xl bg-bg-1 border border-stroke/40 p-4', className)}>
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
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs',
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
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs',
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
    </div>
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
      <div className="text-center py-4">
        <div className="text-2xl mb-2">🤝</div>
        <p className="text-sm text-text-2">
          All players are even — no settlements needed!
        </p>
      </div>
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
    <div className="space-y-2.5">
      {settlements.map((s, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 rounded-xl bg-bg-2 p-3.5 animate-fadeIn"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          {/* From */}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-text-0 text-sm">{s.from}</span>
          </div>

          {/* Arrow */}
          <div className="flex items-center gap-2 shrink-0">
            <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>

          {/* To */}
          <div className="flex-1 min-w-0 text-right">
            <span className="font-medium text-text-0 text-sm">{s.to}</span>
          </div>

          {/* Amount */}
          <div className="shrink-0 rounded-lg bg-accent/15 px-3 py-1.5">
            <span className="font-display font-bold text-accent tabular-nums">
              {formatMoney(s.amount)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Junk/Side Bet settlement card showing per-round junk summaries
 */
function JunkSettlementCard({
  settlements,
  className,
}: {
  settlements: RoundJunkSettlement[]
  className?: string
}) {
  // Aggregate across all rounds
  const aggregated: Record<string, { playerName: string; netTotal: number }> = {}

  for (const settlement of settlements) {
    for (const summary of settlement.playerSummaries) {
      const existing = aggregated[summary.playerId]
      if (existing) {
        existing.netTotal += summary.netJunk
      } else {
        aggregated[summary.playerId] = {
          playerName: summary.playerName,
          netTotal: summary.netJunk,
        }
      }
    }
  }

  const sorted = Object.entries(aggregated)
    .map(([playerId, data]) => ({ playerId, ...data }))
    .sort((a, b) => b.netTotal - a.netTotal)

  const totalClaims = settlements.reduce(
    (sum, s) => sum + s.playerSummaries.reduce((ps, p) => ps + p.claims.reduce((cs, c) => cs + c.count, 0), 0),
    0
  )

  return (
    <div className={cn('rounded-xl bg-bg-1 border border-stroke/40 p-4', className)}>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-display font-bold text-text-0">Side Bets</h2>
        <Badge variant="gold">
          {totalClaims} claim{totalClaims !== 1 ? 's' : ''}
        </Badge>
      </div>
      <p className="text-xs text-text-2 mb-4">
        Junk bet totals across {settlements.length} round{settlements.length !== 1 ? 's' : ''}
      </p>

      <div className="space-y-2">
        {sorted.map((player) => {
          const isPositive = player.netTotal > 0
          const isNegative = player.netTotal < 0
          return (
            <div
              key={player.playerId}
              className="flex items-center justify-between bg-bg-2 rounded-lg p-3"
            >
              <span className="font-medium text-text-0 text-sm">
                {player.playerName}
              </span>
              <span className={cn(
                'font-bold text-sm tabular-nums',
                isPositive && 'text-good',
                isNegative && 'text-bad',
                !isPositive && !isNegative && 'text-text-2'
              )}>
                {isPositive && '+'}{formatJunkValue(Math.abs(player.netTotal))}
              </span>
            </div>
          )
        })}
      </div>

      {/* Per-round breakdown */}
      {settlements.length > 1 && (
        <div className="mt-3 pt-3 border-t border-stroke/30">
          <p className="text-xs text-text-2 mb-2">Per Round</p>
          {settlements.map((settlement) => (
            <div key={settlement.roundId} className="mb-2">
              <p className="text-xs font-medium text-text-1 mb-1">
                {settlement.roundName}
              </p>
              <div className="flex flex-wrap gap-1">
                {settlement.playerSummaries
                  .filter((s) => s.netJunk !== 0)
                  .map((s) => (
                    <span
                      key={s.playerId}
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full',
                        s.netJunk > 0 ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'
                      )}
                    >
                      {s.playerName.split(' ')[0]}: {s.netJunk > 0 && '+'}
                      {formatJunkValue(Math.abs(s.netJunk))}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
