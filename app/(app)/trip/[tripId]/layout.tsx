'use client'

import { useParams, usePathname } from 'next/navigation'
import { BottomNav, NavIcons } from '@/components/ui/BottomNav'

export default function TripLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const tripId = params.tripId as string

  // Determine active nav item from pathname
  const getActiveItem = () => {
    if (pathname.includes('/leaderboard')) return 'leaderboard'
    if (pathname.includes('/matches')) return 'matches'
    if (pathname.includes('/settle')) return 'settle'
    if (pathname.includes('/feed')) return 'feed'
    if (pathname.includes('/round')) return 'round'
    return 'trip'
  }

  const navItems = [
    { id: 'trip', label: 'Trip', icon: NavIcons.Trip, href: `/trip/${tripId}` },
    { id: 'round', label: 'Round', icon: NavIcons.Round, href: `/trip/${tripId}/round/new` },
    { id: 'leaderboard', label: 'Board', icon: NavIcons.Leaderboard, href: `/trip/${tripId}/leaderboard` },
    { id: 'matches', label: 'Matches', icon: NavIcons.Matches, href: `/trip/${tripId}/matches` },
    { id: 'settle', label: 'Settle', icon: NavIcons.Settle, href: `/trip/${tripId}/settle` },
    { id: 'feed', label: 'Feed', icon: NavIcons.Feed, href: `/trip/${tripId}/feed` },
  ]

  return (
    <>
      {children}
      <BottomNav items={navItems} activeItem={getActiveItem()} />
    </>
  )
}
