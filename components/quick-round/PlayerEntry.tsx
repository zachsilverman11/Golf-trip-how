'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

interface Player {
  id: string
  name: string
  handicap: number | null
}

interface PlayerEntryProps {
  players: Player[]
  onAddPlayer: (name: string, handicap: number | null) => void
  onRemovePlayer: (id: string) => void
  className?: string
}

export function PlayerEntry({
  players,
  onAddPlayer,
  onRemovePlayer,
  className,
}: PlayerEntryProps) {
  const handleAddPlayer = () => {
    const nameInput = document.getElementById('playerName') as HTMLInputElement
    const handicapInput = document.getElementById('playerHandicap') as HTMLInputElement

    if (!nameInput) return

    const name = nameInput.value.trim()
    if (!name) return

    let handicap: number | null = null
    if (handicapInput?.value) {
      const trimmed = handicapInput.value.trim()
      if (trimmed.startsWith('+')) {
        const num = parseFloat(trimmed.slice(1))
        handicap = isNaN(num) ? null : -num // Plus handicaps stored as negative
      } else {
        const num = parseFloat(trimmed)
        handicap = isNaN(num) ? null : num
      }
    }

    onAddPlayer(name, handicap)

    // Reset inputs
    nameInput.value = ''
    if (handicapInput) handicapInput.value = ''
    nameInput.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddPlayer()
    }
  }

  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-text-1">
        Players
      </label>

      {/* Current players */}
      {players.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {players.map((player) => (
            <Badge
              key={player.id}
              variant="default"
              className="pr-1"
            >
              {player.name}
              {player.handicap !== null && (
                <span className="ml-1 opacity-70">({player.handicap})</span>
              )}
              <button
                type="button"
                onClick={() => onRemovePlayer(player.id)}
                className="ml-1 p-0.5 hover:text-bad"
              >
                <XIcon />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add player inputs (no nested form to prevent parent form submission) */}
      <div className="flex gap-2">
        <input
          id="playerName"
          type="text"
          placeholder="Player name"
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 min-w-0 rounded-button border border-stroke bg-bg-2 px-3 py-2 text-sm text-text-0',
            'placeholder:text-text-2 focus:border-accent focus:outline-none'
          )}
        />
        <input
          id="playerHandicap"
          type="text"
          inputMode="text"
          placeholder="Hdcp"
          onKeyDown={handleKeyDown}
          className={cn(
            'w-16 rounded-button border border-stroke bg-bg-2 px-3 py-2 text-sm text-text-0 text-center',
            'placeholder:text-text-2 focus:border-accent focus:outline-none'
          )}
        />
        <button
          type="button"
          onClick={handleAddPlayer}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-button',
            'bg-accent text-bg-0 hover:brightness-110 transition-all',
            'active:scale-[0.98]'
          )}
        >
          <PlusIcon />
        </button>
      </div>

      {players.length === 0 && (
        <p className="mt-2 text-xs text-text-2">
          Add at least one player to start
        </p>
      )}
    </div>
  )
}

function XIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}
