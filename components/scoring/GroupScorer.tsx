'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
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
  /** Called when hole or selected player changes (for junk bets overlay) */
  onStateChange?: (state: { currentHole: number; selectedPlayerId: string | null; par: number }) => void
  /** Extra content to render between player rows and the keypad */
  extraContent?: React.ReactNode
  className?: string
}

export function GroupScorer({
  roundId,
  players,
  holes,
  scores,
  onScoreChange,
  onComplete,
  onStateChange,
  extraContent,
  className,
}: GroupScorerProps) {
  const [currentHole, setCurrentHole] = useState(1)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    players[0]?.id || null
  )
  const [inputValue, setInputValue] = useState<string>('')
  const [showNextHole, setShowNextHole] = useState(false)

  const currentHoleInfo = holes.find((h) => h.number === currentHole) || {
    number: currentHole,
    par: 4,
    strokeIndex: currentHole,
    yards: null,
  }

  // Notify parent of state changes (for junk bets overlay)
  useEffect(() => {
    onStateChange?.({
      currentHole,
      selectedPlayerId,
      par: currentHoleInfo.par,
    })
  }, [currentHole, selectedPlayerId, currentHoleInfo.par])

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
    setShowNextHole(false)
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

  // Auto-show next hole button with animation
  useEffect(() => {
    if (isCurrentHoleComplete) {
      const timer = setTimeout(() => setShowNextHole(true), 200)
      return () => clearTimeout(timer)
    } else {
      setShowNextHole(false)
    }
  }, [isCurrentHoleComplete])

  // Auto-advance to next player after score entry
  useEffect(() => {
    if (!selectedPlayerId || !inputValue) return

    const score = scores[selectedPlayerId]?.[currentHole]
    if (score !== null && score !== undefined && score >= 1 && score <= 9) {
      // Single digit score entered — auto-advance to next unscored player
      const currentIdx = players.findIndex((p) => p.id === selectedPlayerId)
      for (let i = 1; i <= players.length; i++) {
        const nextIdx = (currentIdx + i) % players.length
        const nextPlayer = players[nextIdx]
        const nextScore = scores[nextPlayer.id]?.[currentHole]
        if (nextScore === null || nextScore === undefined) {
          // Small delay so user sees their entry
          const timer = setTimeout(() => {
            setSelectedPlayerId(nextPlayer.id)
            setInputValue('')
          }, 150)
          return () => clearTimeout(timer)
        }
      }
    }
  }, [scores, selectedPlayerId, currentHole])

  // Navigate to next hole
  const goToNextHole = () => {
    if (currentHole < (holes.length || 18)) {
      handleHoleChange(currentHole + 1)
      // Select first player on next hole
      if (players[0]) {
        setSelectedPlayerId(players[0].id)
        const existingScore = scores[players[0].id]?.[currentHole + 1]
        setInputValue(existingScore !== null && existingScore !== undefined
          ? String(existingScore) : '')
      }
    } else if (onComplete) {
      onComplete()
    }
  }

  // Progress indicator
  const totalHoles = holes.length || 18
  const completedCount = completedHoles.length
  const progressPercent = Math.round((completedCount / totalHoles) * 100)

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Hole info header — premium feel */}
      <div className="mb-3 rounded-xl bg-bg-1 border border-stroke/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-text-0">
              Hole {currentHole}
            </span>
            <span className="text-sm text-text-2">of {totalHoles}</span>
          </div>
          <div className="text-right">
            <span className="font-display text-2xl font-bold text-accent">
              Par {currentHoleInfo.par}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-2">
          {currentHoleInfo.yards && (
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              {currentHoleInfo.yards} yd
            </span>
          )}
          <span className="flex items-center gap-1">
            SI {currentHoleInfo.strokeIndex}
          </span>
          <span className="ml-auto text-text-2/60 tabular-nums">
            {completedCount}/{totalHoles} holes
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2.5 h-1 rounded-full bg-bg-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
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

      {/* Extra content (e.g., junk bet buttons) */}
      {extraContent}

      {/* Next hole button — animated entrance */}
      {showNextHole && (
        <div className="mb-4 animate-slideIn">
          <button
            onClick={goToNextHole}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-good py-4 font-display font-bold text-white text-base active:scale-[0.98] transition-transform shadow-lg shadow-good/20"
          >
            {currentHole < totalHoles ? (
              <>
                Next Hole →  Hole {currentHole + 1}
              </>
            ) : (
              <>
                🏁 Finish Round
              </>
            )}
          </button>
        </div>
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
