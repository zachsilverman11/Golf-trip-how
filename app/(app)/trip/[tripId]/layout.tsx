'use client'

import { useState, useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { BottomNav, NavIcons } from '@/components/ui/BottomNav'
import { getActiveRoundAction } from '@/lib/supabase/round-actions'

export default function TripLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const tripId = params.tripId as string
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)

  // Check for an active (in-progress) round
  useEffect(() => {
    let cancelled = false
    getActiveRoundAction(tripId).then((result) => {
      if (!cancelled) {
        setActiveRoundId(result.roundId)
      }
    })
    return () => { cancelled = true }
  }, [tripId, pathname]) // re-check when navigating

  // Determine active nav item from pathname
  const getActiveItem = () => {
    if (pathname.includes('/leaderboard')) return 'leaderboard'
    if (pathname.includes('/matches')) return 'matches'
    if (pathname.includes('/settle')) return 'settle'
    if (pathname.includes('/round')) return 'round'
    if (pathname === `/trip/${tripId}`) return 'trip'
    return 'trip'
  }

  const roundHref = activeRoundId
    ? `/trip/${tripId}/round/${activeRoundId}/score`
    : `/trip/${tripId}/round/new`

  const navItems = [
    { id: 'home', label: 'Home', icon: NavIcons.Trip, href: '/trips' },
    { id: 'trip', label: 'Trip', icon: NavIcons.Feed, href: `/trip/${tripId}` },
    { id: 'round', label: 'Round', icon: NavIcons.Round, href: roundHref },
    { id: 'leaderboard', label: 'Board', icon: NavIcons.Leaderboard, href: `/trip/${tripId}/leaderboard` },
    { id: 'matches', label: 'Matches', icon: NavIcons.Matches, href: `/trip/${tripId}/matches` },
    { id: 'settle', label: 'Settle', icon: NavIcons.Settle, href: `/trip/${tripId}/settle` },
  ]

  return (
    <>
      {children}
      <BottomNav items={navItems} activeItem={getActiveItem()} />
    </>
  )
}
