'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getStrokesForHole } from '@/lib/handicap'
import type { NassauState, NassauSubMatchState } from '@/lib/nassau-utils'

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

interface NassauBoardProps {
  nassauState: NassauState
  holes: HoleInfo[]
  players: Player[]
  scores: { [playerId: string]: { [hole: number]: number | null } }
  className?: string
}

/**
 * Nassau match board — shows the 3 sub-match statuses,
 * hole-by-hole results with team net scores, and stroke allocation.
 * This is the "Board" view for a Nassau round.
 */
export function NassauBoard({
  nassauState,
  holes,
  players,
  scores,
  className,
}: NassauBoardProps) {
  const { front, back, overall, teams, stakePerMan, autoPresses } = nassauState

  const teamANames = teams.teamA.map((p) => p.name.split(' ')[0]).join(' & ')
  const teamBNames = teams.teamB.map((p) => p.name.split(' ')[0]).join(' & ')

  // Compute hole-by-hole match results
  const holeResults = useMemo(() => {
    return holes.map((hole) => {
      // Team A best ball net
      const teamANets = teams.teamA.map((p) => {
        const gross = scores[p.id]?.[hole.number] ?? null
        if (gross === null || p.playingHandicap === null) return null
        const strokes = getStrokesForHole(p.playingHandicap, hole.strokeIndex)
        return gross - strokes
      }).filter((n): n is number => n !== null)

      // Team B best ball net
      const teamBNets = teams.teamB.map((p) => {
        const gross = scores[p.id]?.[hole.number] ?? null
        if (gross === null || p.playingHandicap === null) return null
        const strokes = getStrokesForHole(p.playingHandicap, hole.strokeIndex)
        return gross - strokes
      }).filter((n): n is number => n !== null)

      const teamABest = teamANets.length > 0 ? Math.min(...teamANets) : null
      const teamBBest = teamBNets.length > 0 ? Math.min(...teamBNets) : null

      const complete = teamABest !== null && teamBBest !== null
      let winner: 'a' | 'b' | 'halved' | null = null
      if (complete) {
        if (teamABest! < teamBBest!) winner = 'a'
        else if (teamBBest! < teamABest!) winner = 'b'
        else winner = 'halved'
      }

      return {
        hole: hole.number,
        par: hole.par,
        teamABest,
        teamBBest,
        winner,
        complete,
      }
    })
  }, [holes, teams, scores])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Match header */}
      <div className="rounded-xl bg-bg-1 border border-stroke/40 p-4">
        <div className="text-center mb-3">
          <div className="text-xs text-text-2 uppercase tracking-wider mb-1">
            Nassau · ${stakePerMan}/man per bet
          </div>
          <div className="font-display text-lg font-bold text-text-0">
            {teamANames}
            <span className="text-text-2 font-normal mx-2">vs</span>
            {teamBNames}
          </div>
        </div>

        {/* 3 sub-match status cards */}
        <div className="grid grid-cols-3 gap-2">
          <SubMatchCard match={front} teamAName={teamANames} teamBName={teamBNames} />
          <SubMatchCard match={back} teamAName={teamANames} teamBName={teamBNames} />
          <SubMatchCard match={overall} teamAName={teamANames} teamBName={teamBNames} />
        </div>

        {/* Auto-press indicators */}
        {autoPresses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {autoPresses.map((press, idx) => (
              <span
                key={idx}
                className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-accent"
              >
                Press: {press.segment} from #{press.startingHole}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hole-by-hole results */}
      <div className="rounded-xl bg-bg-1 border border-stroke/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-stroke/30">
          <h3 className="font-display font-bold text-text-0 text-sm">Hole by Hole</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs tabular-nums">
            <thead>
              {/* Hole numbers row */}
              <tr className="border-b border-stroke/30">
                <th className="w-[60px] min-w-[60px] text-left px-3 py-1.5 text-text-2 text-[10px]">Hole</th>
                {holes.filter(h => h.number <= 9).map((h) => (
                  <th key={h.number} className="w-[30px] min-w-[30px] py-1.5 text-text-1 font-bold">{h.number}</th>
                ))}
                <th className="w-[34px] min-w-[34px] py-1.5 font-bold text-text-0 bg-bg-2/50">F</th>
                {holes.filter(h => h.number > 9).map((h) => (
                  <th key={h.number} className="w-[30px] min-w-[30px] py-1.5 text-text-1 font-bold">{h.number}</th>
                ))}
                <th className="w-[34px] min-w-[34px] py-1.5 font-bold text-text-0 bg-bg-2/50">B</th>
                <th className="w-[34px] min-w-[34px] py-1.5 font-bold text-accent bg-bg-2/50">T</th>
              </tr>

              {/* Par row */}
              <tr className="border-b border-stroke/20">
                <td className="text-left px-3 py-1 text-text-2/60 text-[10px]">Par</td>
                {holes.filter(h => h.number <= 9).map((h) => (
                  <td key={h.number} className="py-1 text-text-2/60">{h.par}</td>
                ))}
                <td className="py-1 text-text-2/60 bg-bg-2/50 font-bold">
                  {holes.filter(h => h.number <= 9).reduce((s, h) => s + h.par, 0)}
                </td>
                {holes.filter(h => h.number > 9).map((h) => (
                  <td key={h.number} className="py-1 text-text-2/60">{h.par}</td>
                ))}
                <td className="py-1 text-text-2/60 bg-bg-2/50 font-bold">
                  {holes.filter(h => h.number > 9).reduce((s, h) => s + h.par, 0)}
                </td>
                <td className="py-1 text-text-2/60 bg-bg-2/50 font-bold">
                  {holes.reduce((s, h) => s + h.par, 0)}
                </td>
              </tr>
            </thead>

            <tbody>
              {/* Team A net scores */}
              <tr className="border-b border-stroke/15">
                <td className="text-left px-3 py-2 text-[10px] font-medium text-good">{teamANames}</td>
                {holeResults.filter(r => r.hole <= 9).map((r) => (
                  <td key={r.hole} className="py-1.5">
                    <HoleResultCell net={r.teamABest} winner={r.winner === 'a'} />
                  </td>
                ))}
                <td className="py-1.5 bg-bg-2/50 font-bold text-text-1">
                  {holeResults.filter(r => r.hole <= 9 && r.teamABest !== null)
                    .reduce((s, r) => s + r.teamABest!, 0) || '–'}
                </td>
                {holeResults.filter(r => r.hole > 9).map((r) => (
                  <td key={r.hole} className="py-1.5">
                    <HoleResultCell net={r.teamABest} winner={r.winner === 'a'} />
                  </td>
                ))}
                <td className="py-1.5 bg-bg-2/50 font-bold text-text-1">
                  {holeResults.filter(r => r.hole > 9 && r.teamABest !== null)
                    .reduce((s, r) => s + r.teamABest!, 0) || '–'}
                </td>
                <td className="py-1.5 bg-bg-2/50 font-bold text-text-0">
                  {holeResults.filter(r => r.teamABest !== null)
                    .reduce((s, r) => s + r.teamABest!, 0) || '–'}
                </td>
              </tr>

              {/* Team B net scores */}
              <tr className="border-b border-stroke/15">
                <td className="text-left px-3 py-2 text-[10px] font-medium text-gold">{teamBNames}</td>
                {holeResults.filter(r => r.hole <= 9).map((r) => (
                  <td key={r.hole} className="py-1.5">
                    <HoleResultCell net={r.teamBBest} winner={r.winner === 'b'} />
                  </td>
                ))}
                <td className="py-1.5 bg-bg-2/50 font-bold text-text-1">
                  {holeResults.filter(r => r.hole <= 9 && r.teamBBest !== null)
                    .reduce((s, r) => s + r.teamBBest!, 0) || '–'}
                </td>
                {holeResults.filter(r => r.hole > 9).map((r) => (
                  <td key={r.hole} className="py-1.5">
                    <HoleResultCell net={r.teamBBest} winner={r.winner === 'b'} />
                  </td>
                ))}
                <td className="py-1.5 bg-bg-2/50 font-bold text-text-1">
                  {holeResults.filter(r => r.hole > 9 && r.teamBBest !== null)
                    .reduce((s, r) => s + r.teamBBest!, 0) || '–'}
                </td>
                <td className="py-1.5 bg-bg-2/50 font-bold text-text-0">
                  {holeResults.filter(r => r.teamBBest !== null)
                    .reduce((s, r) => s + r.teamBBest!, 0) || '–'}
                </td>
              </tr>

              {/* Match result row — who won each hole */}
              <tr>
                <td className="text-left px-3 py-1.5 text-[10px] text-text-2">Result</td>
                {holeResults.filter(r => r.hole <= 9).map((r) => (
                  <td key={r.hole} className="py-1.5">
                    <MatchResultDot winner={r.winner} />
                  </td>
                ))}
                <td className="py-1.5 bg-bg-2/50">
                  <MatchStatusMini lead={front.lead} />
                </td>
                {holeResults.filter(r => r.hole > 9).map((r) => (
                  <td key={r.hole} className="py-1.5">
                    <MatchResultDot winner={r.winner} />
                  </td>
                ))}
                <td className="py-1.5 bg-bg-2/50">
                  <MatchStatusMini lead={back.lead} />
                </td>
                <td className="py-1.5 bg-bg-2/50">
                  <MatchStatusMini lead={overall.lead} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual player scorecard with stroke allocation */}
      <div className="rounded-xl bg-bg-1 border border-stroke/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-stroke/30">
          <h3 className="font-display font-bold text-text-0 text-sm">Individual Scores</h3>
          <p className="text-[10px] text-text-2">
            <span className="text-accent">●</span> = gets a stroke on this hole
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs tabular-nums">
            <thead>
              <tr className="border-b border-stroke/30">
                <th className="w-[60px] min-w-[60px] text-left px-3 py-1.5 text-text-2 text-[10px]">Player</th>
                {holes.map((h) => (
                  <th key={h.number} className="w-[28px] min-w-[28px] py-1.5 text-text-1 font-bold text-[10px]">
                    {h.number}
                  </th>
                ))}
                <th className="w-[32px] min-w-[32px] py-1.5 font-bold text-text-0 bg-bg-2/50 text-[10px]">TOT</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const hcp = player.playingHandicap || 0
                let totalGross = 0
                let scored = 0

                return (
                  <tr key={player.id} className="border-b border-stroke/10 last:border-0">
                    <td className="text-left px-3 py-2">
                      <div className="text-[10px] font-medium text-text-0 truncate leading-tight">
                        {player.name.split(' ')[0]}
                      </div>
                      <div className="text-[8px] text-accent">HCP {hcp}</div>
                    </td>
                    {holes.map((hole) => {
                      const gross = scores[player.id]?.[hole.number] ?? null
                      const strokes = getStrokesForHole(hcp, hole.strokeIndex)
                      const delta = gross !== null ? gross - hole.par : null

                      if (gross !== null) { totalGross += gross; scored++ }

                      return (
                        <td key={hole.number} className="py-1">
                          <div className="flex flex-col items-center">
                            {gross !== null ? (
                              <span className={cn(
                                'inline-flex h-[18px] w-[18px] items-center justify-center text-[9px] font-bold',
                                delta !== null && delta <= -2 && 'bg-good text-white rounded-full',
                                delta === -1 && 'bg-good/25 text-good rounded-full',
                                delta === 0 && 'text-text-1',
                                delta === 1 && 'text-bad',
                                delta !== null && delta >= 2 && 'bg-bad/20 text-bad',
                              )}>
                                {gross}
                              </span>
                            ) : (
                              <span className="h-[18px] text-text-2/20 text-[9px]">–</span>
                            )}
                            {strokes > 0 && (
                              <span className="text-accent text-[7px] leading-none mt-px">●</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td className="py-1 bg-bg-2/50">
                      <span className="font-bold text-text-0 text-[10px]">
                        {scored > 0 ? totalGross : '–'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SubMatchCard({ match, teamAName, teamBName }: {
  match: NassauSubMatchState
  teamAName: string
  teamBName: string
}) {
  const isActive = match.holesRemaining > 0 && !match.isClosed
  const leadColor = match.lead > 0 ? 'text-good' : match.lead < 0 ? 'text-gold' : 'text-text-1'

  // Who's leading?
  const leader = match.lead > 0 ? teamAName : match.lead < 0 ? teamBName : null

  return (
    <div className={cn(
      'text-center rounded-xl border p-2.5',
      isActive ? 'border-stroke bg-bg-2' : 'border-stroke/50 bg-bg-2/50'
    )}>
      <div className="text-[10px] uppercase tracking-wider text-text-2 mb-1">
        {match.label}
      </div>
      <div className={cn('font-display text-xl font-bold', leadColor)}>
        {match.status}
      </div>
      {leader && (
        <div className="text-[9px] text-text-2 mt-0.5 truncate">{leader}</div>
      )}
      {match.isClosed && (
        <div className="text-[9px] text-accent font-medium mt-0.5">Closed</div>
      )}
      {match.isHalved && (
        <div className="text-[9px] text-text-2 mt-0.5">Halved</div>
      )}
    </div>
  )
}

function HoleResultCell({ net, winner }: { net: number | null; winner: boolean }) {
  if (net === null) return <span className="text-text-2/20">–</span>
  return (
    <span className={cn(
      'text-[11px] font-bold',
      winner ? 'text-good' : 'text-text-2'
    )}>
      {net}
    </span>
  )
}

function MatchResultDot({ winner }: { winner: 'a' | 'b' | 'halved' | null }) {
  if (winner === null) return <span className="text-text-2/20">·</span>
  if (winner === 'halved') return <span className="text-text-2 text-[10px]">—</span>
  return (
    <span className={cn(
      'inline-block h-2.5 w-2.5 rounded-full',
      winner === 'a' ? 'bg-good' : 'bg-gold'
    )} />
  )
}

function MatchStatusMini({ lead }: { lead: number }) {
  if (lead === 0) return <span className="text-[9px] text-text-2 font-bold">A/S</span>
  const absLead = Math.abs(lead)
  const color = lead > 0 ? 'text-good' : 'text-gold'
  return <span className={cn('text-[9px] font-bold', color)}>{absLead}UP</span>
}
