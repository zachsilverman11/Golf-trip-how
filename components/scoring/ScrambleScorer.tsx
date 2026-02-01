'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { HoleNavigator } from './HoleNavigator'
import { ScoringKeypad } from './ScoringKeypad'

/**
 * ScrambleScorer — scoring component for Scramble format.
 *
 * Scramble: 2 teams, all players hit, pick the best shot, repeat.
 * ONE score per team per hole (not per player).
 *
 * Score storage: We reuse the existing `scores` table. The first player
 * on each team acts as the "team captain" — the team's score for each hole
 * is stored under that player's ID. The scramble format knows to treat
 * these as team scores, not individual scores.
 */

interface HoleInfo {
  number: number
  par: number
  strokeIndex: number
  yards: number | null
}

interface TeamInfo {
  name: string
  captainId: string // first player's ID — scores stored under this player
  players: { id: string; name: string }[]
}

interface ScrambleScorerProps {
  roundId: string
  teamA: TeamInfo
  teamB: TeamInfo
  holes: HoleInfo[]
  scores: { [playerId: string]: { [hole: number]: number | null } }
  onScoreChange: (playerId: string, hole: number, score: number | null) => void
  onComplete?: () => void
  className?: string
}

export function ScrambleScorer({
  roundId,
  teamA,
  teamB,
  holes,
  scores,
  onScoreChange,
  onComplete,
  className,
}: ScrambleScorerProps) {
  const [currentHole, setCurrentHole] = useState(1)
  const [selectedTeam, setSelectedTeam] = useState<'teamA' | 'teamB'>('teamA')
  const [inputValue, setInputValue] = useState<string>('')

  const totalHoles = holes.length || 18

  const currentHoleInfo = holes.find((h) => h.number === currentHole) || {
    number: currentHole,
    par: 4,
    strokeIndex: currentHole,
    yards: null,
  }

  // Get team score for a hole via the captain's player ID
  const getTeamScore = useCallback(
    (team: 'teamA' | 'teamB', hole: number): number | null => {
      const captainId = team === 'teamA' ? teamA.captainId : teamB.captainId
      return scores[captainId]?.[hole] ?? null
    },
    [scores, teamA.captainId, teamB.captainId]
  )

  // Calculate completed holes (where BOTH teams have scores)
  const completedHoles = useMemo(() => {
    return holes
      .filter(
        (hole) =>
          getTeamScore('teamA', hole.number) !== null &&
          getTeamScore('teamB', hole.number) !== null
      )
      .map((h) => h.number)
  }, [holes, getTeamScore])

  // Calculate running totals
  const teamTotals = useMemo(() => {
    let teamAGross = 0
    let teamBGross = 0
    let teamAPar = 0
    let teamBPar = 0

    for (const hole of holes) {
      const aScore = getTeamScore('teamA', hole.number)
      const bScore = getTeamScore('teamB', hole.number)
      if (aScore !== null) {
        teamAGross += aScore
        teamAPar += hole.par
      }
      if (bScore !== null) {
        teamBGross += bScore
        teamBPar += hole.par
      }
    }

    return {
      teamA: { gross: teamAGross, toPar: teamAGross - teamAPar },
      teamB: { gross: teamBGross, toPar: teamBGross - teamBPar },
    }
  }, [holes, getTeamScore])

  // Handle keypad input
  const handleNumber = useCallback(
    (num: number) => {
      const captainId =
        selectedTeam === 'teamA' ? teamA.captainId : teamB.captainId

      const newValue = inputValue + String(num)
      const numValue = parseInt(newValue, 10)

      // Max score of 20 per hole
      if (numValue <= 20) {
        setInputValue(newValue)
        onScoreChange(captainId, currentHole, numValue)
      }
    },
    [selectedTeam, inputValue, currentHole, onScoreChange, teamA.captainId, teamB.captainId]
  )

  const handleClear = useCallback(() => {
    const captainId =
      selectedTeam === 'teamA' ? teamA.captainId : teamB.captainId
    setInputValue('')
    onScoreChange(captainId, currentHole, null)
  }, [selectedTeam, currentHole, onScoreChange, teamA.captainId, teamB.captainId])

  const handleBackspace = useCallback(() => {
    const captainId =
      selectedTeam === 'teamA' ? teamA.captainId : teamB.captainId

    if (inputValue.length > 1) {
      const newValue = inputValue.slice(0, -1)
      setInputValue(newValue)
      onScoreChange(captainId, currentHole, parseInt(newValue, 10))
    } else {
      setInputValue('')
      onScoreChange(captainId, currentHole, null)
    }
  }, [selectedTeam, inputValue, currentHole, onScoreChange, teamA.captainId, teamB.captainId])

  // Handle team selection
  const handleTeamSelect = useCallback(
    (team: 'teamA' | 'teamB') => {
      setSelectedTeam(team)
      const score = getTeamScore(team, currentHole)
      setInputValue(score !== null ? String(score) : '')
    },
    [getTeamScore, currentHole]
  )

  // Handle hole change
  const handleHoleChange = useCallback(
    (hole: number) => {
      setCurrentHole(hole)
      const score = getTeamScore(selectedTeam, hole)
      setInputValue(score !== null ? String(score) : '')
    },
    [selectedTeam, getTeamScore]
  )

  // Check if current hole is complete
  const isCurrentHoleComplete =
    getTeamScore('teamA', currentHole) !== null &&
    getTeamScore('teamB', currentHole) !== null

  // Navigate to next hole
  const goToNextHole = () => {
    if (currentHole < totalHoles) {
      handleHoleChange(currentHole + 1)
    } else if (onComplete) {
      onComplete()
    }
  }

  // Format score to par
  const formatToPar = (toPar: number): string => {
    if (toPar === 0) return 'E'
    return toPar > 0 ? `+${toPar}` : `${toPar}`
  }

  // Determine leading team
  const teamALeading = teamTotals.teamA.toPar < teamTotals.teamB.toPar
  const teamBLeading = teamTotals.teamB.toPar < teamTotals.teamA.toPar
  const isTied = teamTotals.teamA.toPar === teamTotals.teamB.toPar

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Hole info header */}
      <div className="mb-4 text-center">
        <div className="text-text-2 text-sm mb-1">
          Hole {currentHole} of {totalHoles}
        </div>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="font-display text-xl font-bold text-text-0">
            Par {currentHoleInfo.par}
          </span>
          {currentHoleInfo.yards && (
            <span className="text-text-2">{currentHoleInfo.yards} yd</span>
          )}
          <span className="text-text-2" title="Stroke Index">
            SI {currentHoleInfo.strokeIndex}
          </span>
        </div>
      </div>

      {/* Hole navigator */}
      <HoleNavigator
        currentHole={currentHole}
        totalHoles={totalHoles}
        completedHoles={completedHoles}
        onHoleSelect={handleHoleChange}
        className="mb-4"
      />

      {/* Two team score cards side by side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <TeamScoreCard
          team={teamA}
          score={getTeamScore('teamA', currentHole)}
          par={currentHoleInfo.par}
          totalGross={teamTotals.teamA.gross}
          toPar={teamTotals.teamA.toPar}
          isSelected={selectedTeam === 'teamA'}
          isLeading={teamALeading}
          onClick={() => handleTeamSelect('teamA')}
        />
        <TeamScoreCard
          team={teamB}
          score={getTeamScore('teamB', currentHole)}
          par={currentHoleInfo.par}
          totalGross={teamTotals.teamB.gross}
          toPar={teamTotals.teamB.toPar}
          isSelected={selectedTeam === 'teamB'}
          isLeading={teamBLeading}
          onClick={() => handleTeamSelect('teamB')}
        />
      </div>

      {/* Running differential */}
      <div className="mb-4 rounded-card-sm bg-bg-2 p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-sm">
          <span
            className={cn(
              'font-display font-bold',
              teamALeading ? 'text-good' : isTied ? 'text-text-1' : 'text-text-2'
            )}
          >
            {teamA.name}: {teamTotals.teamA.gross}
            {completedHoles.length > 0 && (
              <span className="ml-1 text-xs">
                ({formatToPar(teamTotals.teamA.toPar)})
              </span>
            )}
          </span>
          <span className="text-text-2">—</span>
          <span
            className={cn(
              'font-display font-bold',
              teamBLeading ? 'text-good' : isTied ? 'text-text-1' : 'text-text-2'
            )}
          >
            {teamB.name}: {teamTotals.teamB.gross}
            {completedHoles.length > 0 && (
              <span className="ml-1 text-xs">
                ({formatToPar(teamTotals.teamB.toPar)})
              </span>
            )}
          </span>
        </div>
        {!isTied && completedHoles.length > 0 && (
          <div className="mt-1 text-xs text-good">
            {teamALeading ? teamA.name : teamB.name} leads by{' '}
            {Math.abs(teamTotals.teamA.toPar - teamTotals.teamB.toPar)}
          </div>
        )}
      </div>

      {/* Next hole button */}
      {isCurrentHoleComplete && (
        <Button onClick={goToNextHole} size="large" className="mb-4">
          {currentHole < totalHoles
            ? `Next Hole (${currentHole + 1})`
            : 'Finish Round'}
        </Button>
      )}

      {/* Keypad */}
      <ScoringKeypad
        onNumber={handleNumber}
        onClear={handleClear}
        onBackspace={handleBackspace}
      />
    </div>
  )
}

// ============================================================================
// TeamScoreCard — tappable card for one team's score on current hole
// ============================================================================

interface TeamScoreCardProps {
  team: TeamInfo
  score: number | null
  par: number
  totalGross: number
  toPar: number
  isSelected: boolean
  isLeading: boolean
  onClick: () => void
}

function TeamScoreCard({
  team,
  score,
  par,
  totalGross,
  toPar,
  isSelected,
  isLeading,
  onClick,
}: TeamScoreCardProps) {
  const holeDelta = score !== null ? score - par : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center rounded-card-sm border p-4 text-center transition-all duration-tap active:scale-[0.98]',
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-stroke bg-bg-1 hover:border-accent/50'
      )}
    >
      {/* Team name */}
      <div className="mb-1 font-display text-sm font-bold text-text-0 truncate w-full">
        {team.name}
      </div>

      {/* Player names */}
      <div className="mb-3 text-[11px] text-text-2 truncate w-full">
        {team.players.map((p) => p.name).join(', ')}
      </div>

      {/* Score display */}
      <div
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-card-sm font-display text-score-lg font-bold',
          score !== null
            ? 'bg-bg-2 text-text-0'
            : 'border-2 border-dashed border-stroke text-text-2'
        )}
      >
        {score ?? '-'}
      </div>

      {/* Hole delta */}
      {holeDelta !== null && (
        <div
          className={cn(
            'mt-2 font-display text-xs font-bold',
            holeDelta < 0 ? 'text-good' : holeDelta > 0 ? 'text-bad' : 'text-text-2'
          )}
        >
          {holeDelta === 0 ? 'E' : holeDelta > 0 ? `+${holeDelta}` : holeDelta}
        </div>
      )}
    </button>
  )
}
