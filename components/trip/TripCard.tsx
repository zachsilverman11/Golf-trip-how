'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface TripCardProps {
  id: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  memberCount?: number
  roundCount?: number
  isActive?: boolean
  className?: string
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null

  const startDate = new Date(start)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (!end || start === end) {
    return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  }

  const endDate = new Date(end)
  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const sameMonth = startDate.getMonth() === endDate.getMonth()

  if (sameYear && sameMonth) {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.getDate()}, ${endDate.getFullYear()}`
  }

  if (sameYear) {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}, ${endDate.getFullYear()}`
  }

  return `${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
}

function getTripStatus(startDate?: string | null, endDate?: string | null): 'upcoming' | 'active' | 'past' | null {
  if (!startDate) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = endDate ? new Date(endDate) : start
  end.setHours(23, 59, 59, 999)

  if (now < start) return 'upcoming'
  if (now > end) return 'past'
  return 'active'
}

export function TripCard({
  id,
  name,
  description,
  startDate,
  endDate,
  memberCount,
  roundCount,
  className,
}: TripCardProps) {
  const dateRange = formatDateRange(startDate, endDate)
  const status = getTripStatus(startDate, endDate)

  return (
    <Link href={`/trip/${id}`}>
      <Card
        className={cn(
          'p-4 transition-all duration-tap hover:border-accent/50 active:scale-[0.99]',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-lg font-bold text-text-0 truncate">
                {name}
              </h3>
              {status === 'active' && (
                <Badge variant="live">Active</Badge>
              )}
            </div>

            {description && (
              <p className="text-sm text-text-2 line-clamp-2 mb-2">
                {description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-text-2">
              {dateRange && (
                <span className="flex items-center gap-1">
                  <CalendarIcon />
                  {dateRange}
                </span>
              )}
              {memberCount !== undefined && (
                <span className="flex items-center gap-1">
                  <UsersIcon />
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              )}
              {roundCount !== undefined && roundCount > 0 && (
                <span className="flex items-center gap-1">
                  <FlagIcon />
                  {roundCount} {roundCount === 1 ? 'round' : 'rounds'}
                </span>
              )}
            </div>
          </div>

          <ChevronRightIcon />
        </div>
      </Card>
    </Link>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5 text-text-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}
