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
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 scrollbar-hide',
        className
      )}
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
              'flex h-10 min-w-[40px] items-center justify-center rounded-button font-display text-sm font-bold transition-all duration-tap',
              isActive
                ? 'bg-accent text-bg-0'
                : isCompleted
                ? 'bg-good/20 text-good'
                : 'bg-bg-2 text-text-2 hover:bg-stroke hover:text-text-1'
            )}
          >
            {hole}
          </button>
        )
      })}
    </div>
  )
}
