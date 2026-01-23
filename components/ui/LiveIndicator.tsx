'use client'

import { cn } from '@/lib/utils'

interface LiveIndicatorProps {
  isConnected: boolean
  className?: string
}

export function LiveIndicator({ isConnected, className }: LiveIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        isConnected ? 'bg-good/10 text-good' : 'bg-text-2/10 text-text-2',
        className
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          isConnected ? 'bg-good animate-pulse' : 'bg-text-2'
        )}
      />
      {isConnected ? 'Live' : 'Offline'}
    </div>
  )
}
