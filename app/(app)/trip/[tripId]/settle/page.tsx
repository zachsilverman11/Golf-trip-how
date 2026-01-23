'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { getTripMoneyTotalsAction, type PlayerMoneyTotal } from '@/lib/supabase/match-actions'
import { formatMoney } from '@/lib/match-utils'
import { cn } from '@/lib/utils'

export default function SettlePage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [playerTotals, setPlayerTotals] = useState<PlayerMoneyTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const result = await getTripMoneyTotalsAction(tripId)

      if (!result.success) {
        setError(result.error || 'Failed to load money totals')
      } else {
        setPlayerTotals(result.playerTotals)
      }
      setLoading(false)
    }

    loadData()
  }, [tripId])

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading...</div>
      </LayoutContainer>
    )
  }

  if (error) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-bad">{error}</div>
      </LayoutContainer>
    )
  }

  const hasData = playerTotals.length > 0

  return (
    <LayoutContainer className="py-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-text-0">
        Trip Money
      </h1>

      {!hasData ? (
        <Card className="p-8 text-center">
          <div className="mb-4 text-4xl opacity-50">
            <span role="img" aria-label="money">💰</span>
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-text-0">
            No Completed Matches Yet
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
