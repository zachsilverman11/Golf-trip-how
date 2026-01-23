'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface RoundCardProps {
  id: string
  tripId: string
  name: string
  date: string
  status: 'upcoming' | 'in_progress' | 'completed'
  format: string
  courseName?: string | null
  teeName?: string | null
  groupCount?: number
  playerCount?: number
  className?: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const statusVariants: Record<string, 'default' | 'live' | 'positive'> = {
  upcoming: 'default',
  in_progress: 'live',
  completed: 'positive',
}

const statusLabels: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const formatLabels: Record<string, string> = {
  stroke_play: 'Stroke Play',
  best_ball: 'Best Ball',
  scramble: 'Scramble',
  match_play: 'Match Play',
}

export function RoundCard({
  id,
  tripId,
  name,
  date,
  status,
  format,
  courseName,
  teeName,
  groupCount,
  playerCount,
  className,
}: RoundCardProps) {
  const href = status === 'in_progress'
    ? `/trip/${tripId}/round/${id}/score`
    : `/trip/${tripId}/round/${id}`

  return (
    <Link href={href}>
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
              <Badge variant={statusVariants[status]}>
                {statusLabels[status]}
              </Badge>
            </div>

            {courseName && (
              <p className="text-sm text-text-1 truncate">
                {courseName}
                {teeName && ` - ${teeName}`}
              </p>
            )}

            <div className="mt-2 flex items-center gap-4 text-xs text-text-2">
              <span className="flex items-center gap-1">
                <CalendarIcon />
                {formatDate(date)}
              </span>
              <span className="flex items-center gap-1">
                <FlagIcon />
                {formatLabels[format] || format}
              </span>
              {groupCount !== undefined && groupCount > 0 && (
                <span>{groupCount} {groupCount === 1 ? 'group' : 'groups'}</span>
              )}
              {playerCount !== undefined && playerCount > 0 && (
                <span>{playerCount} players</span>
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
