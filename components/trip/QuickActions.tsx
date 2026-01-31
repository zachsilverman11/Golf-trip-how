'use client'

import Link from 'next/link'

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/quick-round">
        <div className="flex min-h-button items-center justify-center gap-2 rounded-card border border-stroke bg-bg-1 px-4 py-3 text-text-1 transition-all duration-tap hover:border-accent/50 hover:bg-bg-2 active:scale-[0.98]">
          <span className="text-lg">⚡</span>
          <span className="font-display text-sm font-bold">Quick Round</span>
        </div>
      </Link>

      <Link href="/trips/new">
        <div className="flex min-h-button items-center justify-center gap-2 rounded-card border border-stroke bg-bg-1 px-4 py-3 text-text-1 transition-all duration-tap hover:border-good/50 hover:bg-bg-2 active:scale-[0.98]">
          <span className="text-lg">✈️</span>
          <span className="font-display text-sm font-bold">New Trip</span>
        </div>
      </Link>
    </div>
  )
}
