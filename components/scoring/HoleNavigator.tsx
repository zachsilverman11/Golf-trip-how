'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface HoleNavigatorProps {
  currentHole: number
  totalHoles?: number
  completedHoles?: number[]
  onHoleSelect: (hole: number) => void
  className?: string
}

export function HoleNavigator({
  currentHole,
  totalHoles = 18,
  completedHoles = [],
  onHoleSelect,
  className,
}: HoleNavigatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentButtonRef = useRef<HTMLButtonElement>(null)

  // Scroll current hole into view
  useEffect(() => {
    if (currentButtonRef.current && scrollRef.current) {
      const container = scrollRef.current
      const button = currentButtonRef.current
      const containerWidth = container.offsetWidth
      const buttonLeft = button.offsetLeft
      const buttonWidth = button.offsetWidth

      // Center the button in the container
      const scrollPosition = buttonLeft - containerWidth / 2 + buttonWidth / 2
      container.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth',
      })
    }
  }, [currentHole])

  const holes = Array.from({ length: totalHoles }, (_, i) => i + 1)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Prev arrow */}
      <button
        onClick={() => currentHole > 1 && onHoleSelect(currentHole - 1)}
        disabled={currentHole <= 1}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
          currentHole > 1
            ? 'bg-bg-1 border border-stroke/60 text-text-1 active:scale-95 active:bg-bg-2'
            : 'text-text-2/30'
        )}
        aria-label="Previous hole"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* Hole pills - scrollable */}
      <div
        ref={scrollRef}
        className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-hide"
      >
        {holes.map((hole) => {
          const isActive = hole === currentHole
          const isCompleted = completedHoles.includes(hole)

          return (
            <button
              key={hole}
              ref={isActive ? currentButtonRef : null}
              onClick={() => onHoleSelect(hole)}
              className={cn(
                'flex h-9 min-w-[36px] items-center justify-center rounded-lg font-display text-sm font-bold transition-all duration-150',
                isActive
                  ? 'bg-accent text-bg-0 shadow-sm shadow-accent/30 scale-105'
                  : isCompleted
                  ? 'bg-good/15 text-good'
                  : 'bg-bg-2 text-text-2/70 active:bg-stroke'
              )}
            >
              {hole}
            </button>
          )
        })}
      </div>

      {/* Next arrow */}
      <button
        onClick={() => currentHole < totalHoles && onHoleSelect(currentHole + 1)}
        disabled={currentHole >= totalHoles}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
          currentHole < totalHoles
            ? 'bg-bg-1 border border-stroke/60 text-text-1 active:scale-95 active:bg-bg-2'
            : 'text-text-2/30'
        )}
        aria-label="Next hole"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  )
}
