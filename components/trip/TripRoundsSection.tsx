'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RoundCardActions } from '@/components/round/RoundCardActions'

interface Round {
  id: string
  name: string
  date: string
  tee_time: string | null
  status: 'upcoming' | 'in_progress' | 'completed'
  format: string
  scoring_basis?: 'gross' | 'net'
}

interface TripRoundsSectionProps {
  tripId: string
  rounds: Round[]
  hasPlayers: boolean
  isAdmin: boolean
}

function formatRoundDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTeeTime(teeTimeStr: string | null): string | null {
  if (!teeTimeStr) return null
  const date = new Date(teeTimeStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

export function TripRoundsSection({
  tripId,
  rounds,
  hasPlayers,
  isAdmin,
}: TripRoundsSectionProps) {
  const hasRounds = rounds.length > 0

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-text-0">
          Rounds on this Trip
        </h2>
        {hasPlayers && hasRounds && (
          <Link href={`/trip/${tripId}/round/new`}>
            <Button variant="secondary">
              <PlusIcon />
              New Round
            </Button>
          </Link>
        )}
      </div>

      {rounds.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-2">
            {hasPlayers
              ? 'No rounds yet. Create your first round to start scoring.'
              : 'Add players first, then create your first round.'}
          </p>
          {hasPlayers && (
            <Link href={`/trip/${tripId}/round/new`}>
              <Button variant="secondary" className="mt-4">
                Create First Round
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <Card
              key={round.id}
              className="p-4 transition-all hover:border-accent/50"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/trip/${tripId}/round/${round.id}`}
                  className="flex-1 min-w-0"
                >
                  <div>
                    <p className="font-medium text-text-0">{round.name}</p>
                    <p className="text-xs text-text-2">
                      {formatRoundDate(round.date)}
                      {round.tee_time && (
                        <span className="ml-1.5 text-text-1">
                          {formatTeeTime(round.tee_time)}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      round.status === 'in_progress'
                        ? 'live'
                        : round.status === 'completed'
                          ? 'positive'
                          : 'default'
                    }
                  >
                    {round.status === 'in_progress'
                      ? 'Live'
                      : round.status === 'completed'
                        ? 'Completed'
                        : 'Upcoming'}
                  </Badge>
                  {isAdmin && (
                    <RoundCardActions
                      roundId={round.id}
                      tripId={tripId}
                      round={{
                        name: round.name,
                        date: round.date,
                        tee_time: round.tee_time,
                        status: round.status,
                        format: round.format,
                        scoring_basis: round.scoring_basis,
                      }}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
