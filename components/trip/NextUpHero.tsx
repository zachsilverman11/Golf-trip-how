'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TripCardMenu } from './TripCardMenu'
import { EditTripModal } from './EditTripModal'
import { DeleteTripDialog } from './DeleteTripDialog'

interface NextUpHeroProps {
  tripId: string
  tripName: string
  startDate: string | null
  endDate: string | null
  memberCount: number
  description: string | null
}

function getCountdownText(startDate: string | null, endDate: string | null): string {
  if (!startDate) return ''

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = endDate ? new Date(endDate) : start
  end.setHours(0, 0, 0, 0)

  // Active trip
  if (now >= start && now <= end) {
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const currentDay = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return `Day ${currentDay} of ${totalDays}`
  }

  // Upcoming trip
  if (now < start) {
    const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil === 0) return 'Starts today!'
    if (daysUntil === 1) return 'Starts tomorrow!'
    return `Starts in ${daysUntil} days`
  }

  return ''
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'No dates set'

  const startDate = new Date(start)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (!end || start === end) {
    return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  }

  const endDate = new Date(end)
  return `${startDate.toLocaleDateString('en-US', options)} – ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
}

function isActive(startDate: string | null, endDate: string | null): boolean {
  if (!startDate) return false
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = endDate ? new Date(endDate) : start
  end.setHours(23, 59, 59, 999)
  return now >= start && now <= end
}

export function NextUpHero({
  tripId,
  tripName,
  startDate,
  endDate,
  memberCount,
  description,
}: NextUpHeroProps) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const countdown = getCountdownText(startDate, endDate)
  const dateRange = formatDateRange(startDate, endDate)
  const active = isActive(startDate, endDate)

  return (
    <>
    <div className="relative overflow-hidden rounded-card border border-accent/20 bg-gradient-to-br from-accent/10 via-bg-1 to-bg-1">
      {/* Subtle accent glow */}
      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-accent/8 blur-3xl" />
      <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-good/5 blur-3xl" />

      <div className="relative p-5">
        {/* Label + badge + menu */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-accent">
              {active ? '🏌️ Active Trip' : '📍 Next Up'}
            </span>
            {active && <Badge variant="live">Live</Badge>}
          </div>
          <TripCardMenu
            onEdit={() => setShowEdit(true)}
            onDelete={() => setShowDelete(true)}
          />
        </div>

        {/* Trip name */}
        <h2 className="font-display text-2xl font-bold text-text-0 mb-1">
          {tripName}
        </h2>

        {/* Countdown / dates / description */}
        {countdown && (
          <p className="text-lg font-medium text-accent mb-1">
            {countdown}
          </p>
        )}
        <p className="text-sm text-text-2 mb-1">
          {dateRange}
        </p>
        {description && (
          <p className="text-sm text-text-2 line-clamp-1 mb-1">
            {description}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-3 mb-4 flex items-center gap-4 text-xs text-text-2">
          <span className="flex items-center gap-1">
            <UsersIcon />
            {memberCount} {memberCount === 1 ? 'player' : 'players'}
          </span>
        </div>

        {/* CTA */}
        <Link href={`/trip/${tripId}`}>
          <Button size="large" className="w-full">
            {active ? 'Go to Trip' : 'View Trip'}
            <ArrowRightIcon />
          </Button>
        </Link>
      </div>
    </div>

    {showEdit && (
      <EditTripModal
        tripId={tripId}
        initialName={tripName}
        initialDescription={description}
        initialStartDate={startDate}
        initialEndDate={endDate}
        onClose={() => setShowEdit(false)}
      />
    )}

    {showDelete && (
      <DeleteTripDialog
        tripId={tripId}
        tripName={tripName}
        onClose={() => setShowDelete(false)}
      />
    )}
    </>
  )
}

function UsersIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
