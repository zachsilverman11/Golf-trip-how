'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  JUNK_TYPES,
  type RoundJunkConfig,
  type DbJunkBet,
  type PlayerJunkSummary,
  type SnakeState,
} from '@/lib/junk-types'
import { calculateJunkSettlement, formatJunkValue } from '@/lib/junk-utils'
import { getJunkBetsAction, getJunkConfigAction } from '@/lib/supabase/junk-actions'

// ============================================================================
// Types
// ============================================================================

interface Player {
  id: string
  name: string
}

interface JunkBetSummaryProps {
  roundId: string
  roundName: string
  players: Player[]
  className?: string
}

interface JunkBetSummaryFromDataProps {
  roundId: string
  roundName: string
  players: Player[]
  bets: DbJunkBet[]
  config: RoundJunkConfig
  className?: string
}

// ============================================================================
// Data-loading wrapper
// ============================================================================

export function JunkBetSummary({
  roundId,
  roundName,
  players,
  className,
}: JunkBetSummaryProps) {
  const [bets, setBets] = useState<DbJunkBet[]>([])
  const [config, setConfig] = useState<RoundJunkConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      const [betsResult, configResult] = await Promise.all([
        getJunkBetsAction(roundId),
        getJunkConfigAction(roundId),
      ])

      if (cancelled) return

      setBets(betsResult.bets || [])
      setConfig(configResult.config || null)
      setLoading(false)
    }

    loadData()
    return () => { cancelled = true }
  }, [roundId])

  if (loading) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-center text-text-2 text-sm">Loading junk bets...</div>
      </Card>
    )
  }

  if (!config?.enabled || bets.length === 0) {
    return null
  }

  return (
    <JunkBetSummaryFromData
      roundId={roundId}
      roundName={roundName}
      players={players}
      bets={bets}
      config={config}
      className={className}
    />
  )
}

// ============================================================================
// Pure display component (when data is already loaded)
// ============================================================================

export function JunkBetSummaryFromData({
  roundId,
  roundName,
  players,
  bets,
  config,
  className,
}: JunkBetSummaryFromDataProps) {
  const settlement = useMemo(() => {
    const playerIds = players.map((p) => p.id)
    const playerNames: Record<string, string> = {}
    for (const p of players) {
      playerNames[p.id] = p.name
    }

    return calculateJunkSettlement(
      roundId,
      roundName,
      bets,
      playerIds,
      playerNames,
      config
    )
  }, [roundId, roundName, players, bets, config])

  if (settlement.playerSummaries.every((s) => s.netJunk === 0)) {
    return null
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display font-bold text-text-0">Side Bets</h3>
        <Badge variant="gold">
          {bets.length} claim{bets.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Player summaries */}
      <div className="space-y-2 mb-3">
        {settlement.playerSummaries.map((summary) => (
          <PlayerJunkRow key={summary.playerId} summary={summary} />
        ))}
      </div>

      {/* Snake indicator */}
      {settlement.snakeState?.currentHolderId && (
        <SnakeIndicator snakeState={settlement.snakeState} playerCount={players.length} />
      )}
    </Card>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function PlayerJunkRow({ summary }: { summary: PlayerJunkSummary }) {
  const isPositive = summary.netJunk > 0
  const isNegative = summary.netJunk < 0
  const hasSnake = summary.snakePenalty < 0

  return (
    <div className="flex items-center justify-between rounded-lg bg-bg-2 p-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-text-0 text-sm truncate">
          {summary.playerName}
        </span>
        {hasSnake && (
          <span className="text-sm" title="Holding the snake">🐍</span>
        )}
        <div className="flex gap-1">
          {summary.claims.map((claim) => {
            const info = JUNK_TYPES[claim.junkType]
            return (
              <span
                key={claim.junkType}
                className="text-xs"
                title={`${info.label} x${claim.count}`}
              >
                {info.emoji}
                {claim.count > 1 && (
                  <span className="text-[10px] text-text-2">×{claim.count}</span>
                )}
              </span>
            )
          })}
        </div>
      </div>
      <span
        className={cn(
          'font-bold text-sm tabular-nums',
          isPositive && 'text-good',
          isNegative && 'text-bad',
          !isPositive && !isNegative && 'text-text-2'
        )}
      >
        {isPositive && '+'}
        {formatJunkValue(Math.abs(summary.netJunk))}
        {isNegative && ' 💸'}
      </span>
    </div>
  )
}

function SnakeIndicator({
  snakeState,
  playerCount,
}: {
  snakeState: SnakeState
  playerCount: number
}) {
  const totalPenalty = snakeState.valuePerPlayer * (playerCount - 1)

  return (
    <div className="rounded-lg border border-bad/30 bg-bad/5 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🐍</span>
        <span className="font-medium text-text-0 text-sm">
          {snakeState.currentHolderName} has the snake
        </span>
      </div>
      <p className="text-xs text-text-2 ml-7">
        Pays {formatJunkValue(snakeState.valuePerPlayer)} to each player
        ({formatJunkValue(totalPenalty)} total) if held at end
      </p>
      {snakeState.transfers.length > 1 && (
        <div className="mt-2 ml-7 flex flex-wrap gap-1">
          {snakeState.transfers.map((t, idx) => (
            <span
              key={idx}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                idx === snakeState.transfers.length - 1
                  ? 'bg-bad/20 text-bad'
                  : 'bg-bg-2 text-text-2'
              )}
            >
              #{t.holeNumber} {t.playerName.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
