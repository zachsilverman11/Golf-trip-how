'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getStrokesForHole } from '@/lib/handicap'

interface HoleInfo {
  number: number
  par: number
  strokeIndex: number
  yards: number | null
}

interface Player {
  id: string
  name: string
  playingHandicap: number | null
}

interface ScorecardProps {
  players: Player[]
  holes: HoleInfo[]
  scores: { [playerId: string]: { [hole: number]: number | null } }
  /** Highlight current hole during live scoring */
  currentHole?: number
  className?: string
}

/**
 * Traditional golf scorecard — holes across the top, players down the side.
 * Shows stroke allocation dots (●) on holes where each player gets a pop.
 * Horizontally scrollable on mobile.
 */
export function Scorecard({
  players,
  holes,
  scores,
  currentHole,
  className,
}: ScorecardProps) {
  const frontNine = holes.filter((h) => h.number <= 9).sort((a, b) => a.number - b.number)
  const backNine = holes.filter((h) => h.number > 9).sort((a, b) => a.number - b.number)
  const hasFront = frontNine.length > 0
  const hasBack = backNine.length > 0

  // Pre-compute stroke allocations and totals for each player
  const playerData = useMemo(() => {
    return players.map((player) => {
      const hcp = player.playingHandicap || 0

      // Per-hole data
      const holeData = holes.map((hole) => {
        const strokes = getStrokesForHole(hcp, hole.strokeIndex)
        const gross = scores[player.id]?.[hole.number] ?? null
        const net = gross !== null ? gross - strokes : null
        const delta = gross !== null ? gross - hole.par : null

        return { hole: hole.number, gross, net, delta, strokes }
      })

      // Totals
      const frontHoles = holeData.filter((h) => h.hole <= 9)
      const backHoles = holeData.filter((h) => h.hole > 9)

      const sumGross = (arr: typeof holeData) =>
        arr.reduce((sum, h) => sum + (h.gross ?? 0), 0)
      const sumNet = (arr: typeof holeData) =>
        arr.reduce((sum, h) => sum + (h.net ?? 0), 0)
      const countScored = (arr: typeof holeData) =>
        arr.filter((h) => h.gross !== null).length

      return {
        player,
        holeData,
        frontGross: sumGross(frontHoles),
        frontNet: sumNet(frontHoles),
        frontScored: countScored(frontHoles),
        backGross: sumGross(backHoles),
        backNet: sumNet(backHoles),
        backScored: countScored(backHoles),
        totalGross: sumGross(holeData),
        totalNet: sumNet(holeData),
        totalScored: countScored(holeData),
      }
    })
  }, [players, holes, scores])

  const frontPar = frontNine.reduce((sum, h) => sum + h.par, 0)
  const backPar = backNine.reduce((sum, h) => sum + h.par, 0)
  const totalPar = frontPar + backPar

  // Cell width classes
  const holeW = 'w-[34px] min-w-[34px]'
  const labelW = 'w-[52px] min-w-[52px]'
  const totalW = 'w-[38px] min-w-[38px]'

  const scoreBg = (delta: number | null) => {
    if (delta === null) return ''
    if (delta <= -2) return 'bg-good text-white rounded-full' // Eagle+
    if (delta === -1) return 'bg-good/25 text-good rounded-full' // Birdie
    if (delta === 0) return '' // Par
    if (delta === 1) return 'bg-bad/15 text-bad' // Bogey
    return 'bg-bad/25 text-bad' // Double+
  }

  const renderHalfCard = (
    nineHoles: HoleInfo[],
    label: 'OUT' | 'IN',
    parTotal: number
  ) => (
    <div className="rounded-xl bg-bg-1 border border-stroke/40 overflow-hidden">
      <table className="w-full text-center text-xs tabular-nums">
        <thead>
          {/* Hole numbers */}
          <tr className="border-b border-stroke/30">
            <th className={cn(labelW, 'text-left px-2 py-1.5 text-text-2 font-medium')}>Hole</th>
            {nineHoles.map((h) => (
              <th
                key={h.number}
                className={cn(
                  holeW, 'py-1.5 font-bold',
                  currentHole === h.number ? 'text-accent' : 'text-text-1'
                )}
              >
                {h.number}
              </th>
            ))}
            <th className={cn(totalW, 'py-1.5 font-bold text-text-0 bg-bg-2/50')}>{label}</th>
          </tr>

          {/* Par */}
          <tr className="border-b border-stroke/30">
            <td className={cn(labelW, 'text-left px-2 py-1 text-text-2 font-medium')}>Par</td>
            {nineHoles.map((h) => (
              <td key={h.number} className={cn(holeW, 'py-1 text-text-2')}>{h.par}</td>
            ))}
            <td className={cn(totalW, 'py-1 font-bold text-text-1 bg-bg-2/50')}>{parTotal}</td>
          </tr>

          {/* Stroke Index */}
          <tr className="border-b border-stroke/20">
            <td className={cn(labelW, 'text-left px-2 py-1 text-text-2/60 text-[10px]')}>SI</td>
            {nineHoles.map((h) => (
              <td key={h.number} className={cn(holeW, 'py-1 text-text-2/60 text-[10px]')}>{h.strokeIndex}</td>
            ))}
            <td className={cn(totalW, 'bg-bg-2/50')} />
          </tr>
        </thead>

        <tbody>
          {playerData.map(({ player, holeData, frontGross, frontNet, backGross, backNet }) => {
            const nineData = holeData.filter((h) =>
              label === 'OUT' ? h.hole <= 9 : h.hole > 9
            )
            const nineGross = label === 'OUT' ? frontGross : backGross
            const nineNet = label === 'OUT' ? frontNet : backNet

            return (
              <tr key={player.id} className="border-b border-stroke/15 last:border-0">
                {/* Player name + handicap */}
                <td className={cn(labelW, 'text-left px-2 py-2')}>
                  <div className="font-medium text-text-0 text-[11px] truncate leading-tight">
                    {player.name.split(' ')[0]}
                  </div>
                  {player.playingHandicap !== null && (
                    <div className="text-[9px] text-accent font-medium">
                      ({player.playingHandicap})
                    </div>
                  )}
                </td>

                {/* Scores per hole */}
                {nineData.map((hd) => (
                  <td key={hd.hole} className={cn(holeW, 'py-1.5')}>
                    {hd.gross !== null ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn(
                          'inline-flex h-[22px] w-[22px] items-center justify-center text-[11px] font-bold',
                          scoreBg(hd.delta)
                        )}>
                          {hd.gross}
                        </span>
                        {hd.strokes > 0 && (
                          <span className="text-accent text-[8px] leading-none">
                            {'●'.repeat(Math.min(hd.strokes, 3))}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-text-2/30 text-[11px]">–</span>
                        {hd.strokes > 0 && (
                          <span className="text-accent/40 text-[8px] leading-none">
                            {'●'.repeat(Math.min(hd.strokes, 3))}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                ))}

                {/* Nine total */}
                <td className={cn(totalW, 'py-1.5 bg-bg-2/50')}>
                  <div className="font-bold text-text-0 text-[11px]">
                    {nineGross || '–'}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Horizontally scrollable container */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[400px] space-y-3">
          {/* Front 9 */}
          {hasFront && renderHalfCard(frontNine, 'OUT', frontPar)}

          {/* Back 9 */}
          {hasBack && renderHalfCard(backNine, 'IN', backPar)}

          {/* Totals row */}
          <div className="rounded-xl bg-bg-1 border border-stroke/40 overflow-hidden">
            <table className="w-full text-center text-xs tabular-nums">
              <tbody>
                {playerData.map(({ player, frontGross, backGross, totalGross, totalNet, totalScored }) => {
                  const toPar = totalGross - totalPar
                  const toParStr = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`

                  return (
                    <tr key={player.id} className="border-b border-stroke/15 last:border-0">
                      <td className={cn(labelW, 'text-left px-2 py-2')}>
                        <span className="font-medium text-text-0 text-[11px]">
                          {player.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="py-2 text-text-2 text-[11px]">
                        OUT: <span className="font-bold text-text-1">{frontGross || '–'}</span>
                      </td>
                      <td className="py-2 text-text-2 text-[11px]">
                        IN: <span className="font-bold text-text-1">{backGross || '–'}</span>
                      </td>
                      <td className="py-2">
                        <span className="font-display font-bold text-text-0 text-sm">{totalGross || '–'}</span>
                      </td>
                      <td className="py-2">
                        <span className={cn(
                          'font-display font-bold text-sm',
                          toPar < 0 ? 'text-good' : toPar > 0 ? 'text-bad' : 'text-text-1'
                        )}>
                          {totalScored > 0 ? toParStr : '–'}
                        </span>
                      </td>
                      <td className="py-2 text-text-2 text-[10px]">
                        Net: <span className="font-bold text-accent">{totalNet || '–'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-text-2">
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-good text-[8px] text-white font-bold">3</span>
          Eagle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-good/25 text-[8px] text-good font-bold">3</span>
          Birdie
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center bg-bad/15 text-[8px] text-bad font-bold">5</span>
          Bogey+
        </span>
        <span className="flex items-center gap-1">
          <span className="text-accent">●</span>
          Stroke
        </span>
      </div>
    </div>
  )
}
