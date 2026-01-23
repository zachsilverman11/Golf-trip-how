'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { HoleNavigator } from './HoleNavigator'
import { PlayerScoreRow } from './PlayerScoreRow'
import { ScoringKeypad } from './ScoringKeypad'
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

interface GroupScorerProps {
  roundId: string
  players: Player[]
  holes: HoleInfo[]
  scores: { [playerId: string]: { [hole: number]: number | null } }
  onScoreChange: (playerId: string, hole: number, score: number | null) => void
  onComplete?: () => void
  className?: string
}

export function GroupScorer({
  roundId,
  players,
  holes,
  scores,
  onScoreChange,
  onComplete,
  className,
}: GroupScorerProps) {
  const [currentHole, setCurrentHole] = useState(1)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    players[0]?.id || null
  )
  const [inputValue, setInputValue] = useState<string>('')

  const currentHoleInfo = holes.find((h) => h.number === currentHole) || {
    number: currentHole,
    par: 4,
    strokeIndex: currentHole,
    yards: null,
  }

  // Calculate completed holes (where all players have scores)
  const completedHoles = useMemo(() => {
    return holes
      .filter((hole) =>
        players.every(
          (player) => scores[player.id]?.[hole.number] !== null &&
                      scores[player.id]?.[hole.number] !== undefined
        )
      )
      .map((h) => h.number)
  }, [holes, players, scores])

  // Calculate totals for each player
  const playerTotals = useMemo(() => {
    const totals: { [playerId: string]: { gross: number; net: number } } = {}

    for (const player of players) {
      let gross = 0
      let net = 0

      for (const hole of holes) {
        const score = scores[player.id]?.[hole.number]
        if (score !== null && score !== undefined) {
          gross += score
          const strokes = getStrokesForHole(
            player.playingHandicap || 0,
            hole.strokeIndex
          )
          net += score - strokes
        }
      }

      totals[player.id] = { gross, net }
    }

    return totals
  }, [players, holes, scores])

  // Handle keypad input
  const handleNumber = useCallback((num: number) => {
    if (!selectedPlayerId) return

    const newValue = inputValue + String(num)
    const numValue = parseInt(newValue, 10)

    // Max score of 20 per hole
    if (numValue <= 20) {
      setInputValue(newValue)
      onScoreChange(selectedPlayerId, currentHole, numValue)
    }
  }, [selectedPlayerId, inputValue, currentHole, onScoreChange])

  const handleClear = useCallback(() => {
    if (!selectedPlayerId) return
    setInputValue('')
    onScoreChange(selectedPlayerId, currentHole, null)
  }, [selectedPlayerId, currentHole, onScoreChange])

  const handleBackspace = useCallback(() => {
    if (!selectedPlayerId) return

    if (inputValue.length > 1) {
      const newValue = inputValue.slice(0, -1)
      setInputValue(newValue)
      onScoreChange(selectedPlayerId, currentHole, parseInt(newValue, 10))
    } else {
      setInputValue('')
      onScoreChange(selectedPlayerId, currentHole, null)
    }
  }, [selectedPlayerId, inputValue, currentHole, onScoreChange])

  // Handle player selection
  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId)
    const existingScore = scores[playerId]?.[currentHole]
    setInputValue(existingScore !== null && existingScore !== undefined
      ? String(existingScore)
      : '')
  }, [scores, currentHole])

  // Handle hole change
  const handleHoleChange = useCallback((hole: number) => {
    setCurrentHole(hole)
    if (selectedPlayerId) {
      const existingScore = scores[selectedPlayerId]?.[hole]
      setInputValue(existingScore !== null && existingScore !== undefined
        ? String(existingScore)
        : '')
    }
  }, [selectedPlayerId, scores])

  // Check if current hole is complete
  const isCurrentHoleComplete = players.every(
    (player) => scores[player.id]?.[currentHole] !== null &&
                scores[player.id]?.[currentHole] !== undefined
  )

  // Navigate to next hole
  const goToNextHole = () => {
    if (currentHole < 18) {
      handleHoleChange(currentHole + 1)
    } else if (onComplete) {
      onComplete()
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Hole info header */}
      <div className="mb-4 text-center">
        <div className="text-text-2 text-sm mb-1">
          Hole {currentHole} of {holes.length || 18}
        </div>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="font-display text-xl font-bold text-text-0">
            Par {currentHoleInfo.par}
          </span>
          {currentHoleInfo.yards && (
            <span className="text-text-2">{currentHoleInfo.yards} yd</span>
          )}
          <span className="text-text-2">SI: {currentHoleInfo.strokeIndex}</span>
        </div>
      </div>

      {/* Hole navigator */}
      <HoleNavigator
        currentHole={currentHole}
        completedHoles={completedHoles}
        onHoleSelect={handleHoleChange}
        className="mb-4"
      />

      {/* Player score rows */}
      <div className="space-y-2 mb-4">
        {players.map((player) => {
          const strokes = getStrokesForHole(
            player.playingHandicap || 0,
            currentHoleInfo.strokeIndex
          )

          return (
            <PlayerScoreRow
              key={player.id}
              name={player.name}
              score={scores[player.id]?.[currentHole] ?? null}
              par={currentHoleInfo.par}
              strokes={strokes}
              totalGross={playerTotals[player.id]?.gross || 0}
              totalNet={playerTotals[player.id]?.net || 0}
              isSelected={selectedPlayerId === player.id}
              onClick={() => handlePlayerSelect(player.id)}
            />
          )
        })}
      </div>

      {/* Next hole button */}
      {isCurrentHoleComplete && (
        <Button
          onClick={goToNextHole}
          size="large"
          className="mb-4"
        >
          {currentHole < 18 ? `Next Hole (${currentHole + 1})` : 'Finish Round'}
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
