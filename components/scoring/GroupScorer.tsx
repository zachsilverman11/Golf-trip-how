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

  // Compute hole result summary when hole is complete
  const holeResult = useMemo(() => {
    if (!isCurrentHoleComplete) return null

    // Compute net scores for this hole
    const results = players.map((player) => {
      const gross = scores[player.id]?.[currentHole] ?? 0
      const strokes = getStrokesForHole(
        player.playingHandicap || 0,
        currentHoleInfo.strokeIndex
      )
      const net = gross - strokes
      const delta = gross - currentHoleInfo.par

      return {
        id: player.id,
        name: player.name,
        gross,
        net,
        delta,
        strokes,
      }
    })

    // Find lowest net score
    const lowestNet = Math.min(...results.map((r) => r.net))
    const winners = results.filter((r) => r.net === lowestNet)
    const isTied = winners.length > 1

    return { results, winners, isTied, lowestNet }
  }, [isCurrentHoleComplete, players, scores, currentHole, currentHoleInfo])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Scrollable content — leaves room for fixed keypad */}
      <div className="pb-[260px]">
        {/* Hole info header — compact */}
        <div className="mb-2 rounded-xl bg-bg-1 border border-stroke/40 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-extrabold text-text-0">
                Hole {currentHole}
              </span>
              <span className="text-xs text-text-2">of {totalHoles}</span>
            </div>
            <div className="flex items-center gap-3">
              {currentHoleInfo.yards && (
                <span className="text-xs text-text-2">{currentHoleInfo.yards}yd</span>
              )}
              <span className="text-xs text-text-2">SI {currentHoleInfo.strokeIndex}</span>
              <span className="font-display text-xl font-bold text-accent">
                Par {currentHoleInfo.par}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 rounded-full bg-bg-2 overflow-hidden">
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
          className="mb-3"
        />

        {/* Player score rows */}
        <div className="space-y-2 mb-3">
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

        {/* Hole result — shows who won after all scores entered */}
        {holeResult && (
          <div className="mb-3 rounded-xl border border-accent/30 bg-accent/5 p-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                {holeResult.isTied ? (
                  <p className="text-sm font-medium text-text-1">
                    🤝 Halved — {holeResult.winners.map(w => w.name.split(' ')[0]).join(' & ')} tied at {holeResult.lowestNet > 0 ? `+${holeResult.lowestNet}` : holeResult.lowestNet === 0 ? 'E' : holeResult.lowestNet} net
                  </p>
                ) : (
                  <p className="text-sm font-medium text-text-1">
                    🏆 <span className="text-accent font-bold">{holeResult.winners[0].name}</span> wins with{' '}
                    {holeResult.winners[0].gross} ({holeResult.winners[0].strokes > 0 ? `${holeResult.winners[0].gross}-${holeResult.winners[0].strokes}=` : ''}{holeResult.winners[0].net} net)
                  </p>
                )}
              </div>
              <button
                onClick={goToNextHole}
                className="shrink-0 ml-3 rounded-lg bg-good px-4 py-2 font-display font-bold text-white text-sm active:scale-[0.96] transition-transform"
              >
                {currentHole < totalHoles ? `→ ${currentHole + 1}` : '🏁 Finish'}
              </button>
            </div>
          </div>
        )}

        {/* Extra content (e.g., junk bet buttons) */}
        {extraContent}
      </div>

      {/* Fixed keypad — always visible above bottom nav */}
      <div className="fixed bottom-16 left-0 right-0 z-20 bg-bg-0 border-t border-stroke/30 px-4 pt-2 pb-2">
        <div className="mx-auto max-w-content">
          <ScoringKeypad
            onNumber={handleNumber}
            onClear={handleClear}
            onBackspace={handleBackspace}
          />
        </div>
      </div>
    </div>
  )
}
