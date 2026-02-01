'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { SkinsState } from '@/lib/skins-utils'
import { formatSkinCount } from '@/lib/skins-utils'

interface SkinsStripProps {
  skinsState: SkinsState
  currentHole: number
  tripId: string
  roundId: string
  className?: string
}

/**
 * Live status strip for Skins format on the scoring screen.
 * Shows skin count per player, carryover pot, and alerts.
 */
export function SkinsStrip({
  skinsState,
  currentHole,
  tripId,
  roundId,
  className,
}: SkinsStripProps) {
  const {
    skinValue,
    players,
    skinCounts,
    skinValues,
    currentCarryCount,
    currentCarryValue,
    holesPlayed,
  } = skinsState

  // Sort players by skins won (descending)
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => (skinCounts[b.id] || 0) - (skinCounts[a.id] || 0))
  }, [players, skinCounts])

  const hasCarryover = currentCarryCount > 0
  const nextHolePotValue = (currentCarryCount + 1) * skinValue

  return (
    <Link
      href={`/trip/${tripId}/round/${roundId}`}
      className={cn(
        'block bg-bg-1 border border-stroke rounded-card p-4',
        'hover:border-accent/50 transition-colors',
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-3">
        <div className="text-text-2 text-xs uppercase tracking-wider mb-1">
          Skins · ${skinValue}/skin
        </div>

        {/* Carryover alert */}
        {hasCarryover ? (
          <div className="font-display text-lg font-bold text-gold animate-pulse">
            🔥 {currentCarryCount} skin{currentCarryCount > 1 ? 's' : ''} carried!
            <span className="block text-sm font-medium text-accent mt-0.5">
              Next hole worth ${nextHolePotValue}
            </span>
          </div>
        ) : (
          <div className="font-display text-lg font-bold text-accent">
            Hole {currentHole}: ${skinValue} skin
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-stroke/50 my-3" />

      {/* Player skin counts */}
      <div className="space-y-2">
        {sortedPlayers.map((player, idx) => {
          const count = skinCounts[player.id] || 0
          const value = skinValues[player.id] || 0
          const isLeader = idx === 0 && count > 0

          return (
            <div
              key={player.id}
              className={cn(
                'flex items-center justify-between px-2 py-1.5 rounded-card-sm',
                isLeader && 'bg-gold/10 border border-gold/20'
              )}
            >
              <div className="flex items-center gap-2">
                {isLeader && <span className="text-sm">👑</span>}
                <span className={cn(
                  'text-sm font-medium',
                  isLeader ? 'text-gold' : 'text-text-1'
                )}>
                  {player.name.split(' ')[0]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-xs',
                  count > 0 ? 'text-good' : 'text-text-2'
                )}>
                  {formatSkinCount(count)}
                </span>
                {value > 0 && (
                  <span className="text-xs font-bold text-good">
                    +${value}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent results (last 3 completed holes) */}
      <RecentHoles skinsState={skinsState} />

      {/* Progress */}
      <div className="mt-3 text-center text-xs text-text-2">
        {holesPlayed} of 18 holes · {skinsState.totalSkinsAwarded} skins awarded
      </div>
    </Link>
  )
}

function RecentHoles({ skinsState }: { skinsState: SkinsState }) {
  const recentCompleted = useMemo(() => {
    return skinsState.holeResults
      .filter(h => h.complete)
      .slice(-3)
  }, [skinsState.holeResults])

  if (recentCompleted.length === 0) return null

  return (
    <>
      <div className="border-t border-stroke/50 my-3" />
      <div className="flex items-center justify-center gap-2">
        {recentCompleted.map(hole => (
          <div
            key={hole.holeNumber}
            className={cn(
              'text-center px-2 py-1 rounded-card-sm text-xs',
              hole.winnerId ? 'bg-good/10 text-good' : hole.carried ? 'bg-gold/10 text-gold' : 'bg-bg-2 text-text-2'
            )}
          >
            <div className="font-bold">#{hole.holeNumber}</div>
            <div className="text-[10px]">
              {hole.winnerId
                ? hole.winnerName?.split(' ')[0]
                : hole.carried
                  ? 'Carry'
                  : '—'}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Compact version for smaller spaces.
 */
export function SkinsStripCompact({
  skinsState,
  className,
}: { skinsState: SkinsState; className?: string }) {
  const { currentCarryCount, skinValue, totalSkinsAwarded } = skinsState
  const hasCarry = currentCarryCount > 0

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span className="text-text-2">
        Skins: <span className="font-medium text-accent">${skinValue}/skin</span>
        {hasCarry && (
          <span className="ml-2 text-gold font-bold animate-pulse">
            🔥 {currentCarryCount} carried
          </span>
        )}
      </span>
      <span className="text-text-2">
        {totalSkinsAwarded} won
      </span>
    </div>
  )
}
