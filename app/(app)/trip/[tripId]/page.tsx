import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTripAction } from '@/lib/supabase/trip-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SpectatorLinkCopyButton } from '@/components/trip/SpectatorLinkCopyButton'
import { SetupChecklist } from '@/components/trip/SetupChecklist'

export const dynamic = 'force-dynamic'

interface TripPageProps {
  params: { tripId: string }
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRoundDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default async function TripPage({ params }: TripPageProps) {
  const { trip, userRole, error } = await getTripAction(params.tripId)

  if (error || !trip) {
    notFound()
  }

  const isAdmin = userRole === 'admin'
  const hasPlayers = trip.playerCount > 0
  const hasRounds = trip.roundCount > 0

  return (
    <LayoutContainer className="py-6">
      {/* Back link */}
      <Link
        href="/trips"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
      >
        <BackIcon />
        All trips
      </Link>

      {/* Section A: Trip Overview (compact header) */}
      <section className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-0">
              {trip.name}
            </h1>
            {trip.description && (
              <p className="mt-1 text-text-2">{trip.description}</p>
            )}
          </div>
          {isAdmin && <Badge variant="gold">Admin</Badge>}
        </div>

        {(trip.start_date || trip.end_date) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-text-2">
            <CalendarIcon />
            {trip.start_date && formatDate(trip.start_date)}
            {trip.start_date && trip.end_date && trip.start_date !== trip.end_date && (
              <> - {formatDate(trip.end_date)}</>
            )}
          </div>
        )}
      </section>

      {/* Section B: Setup Checklist (prominent when trip is new) */}
      <SetupChecklist
        tripId={params.tripId}
        playerCount={trip.playerCount}
        roundCount={trip.roundCount}
        rounds={trip.recentRounds}
      />

      {/* Section C: Trip Configuration */}
      <section className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold text-text-0">
          Trip Configuration
        </h2>
        <div className="space-y-3">
          {/* Players Card */}
          <Link href={`/trip/${params.tripId}/players`}>
            <Card className="p-4 transition-all hover:border-accent/50 active:scale-[0.99]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-good/10 text-good">
                    <UsersIcon />
                  </div>
                  <div>
                    <p className="font-medium text-text-0">Players</p>
                    <p className="text-xs text-text-2">
                      {trip.playerCount === 0
                        ? 'No players added yet'
                        : `${trip.playerCount} player${trip.playerCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <ChevronRightIcon />
              </div>
            </Card>
          </Link>

          {/* Courses Card (optional, soft framing) */}
          <Link href="/courses">
            <Card className="p-4 transition-all hover:border-accent/50 active:scale-[0.99]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <MapIcon />
                  </div>
                  <div>
                    <p className="font-medium text-text-0">Trip Courses</p>
                    <p className="text-xs text-text-2">
                      Add courses for quick round setup
                    </p>
                  </div>
                </div>
                <ChevronRightIcon />
              </div>
            </Card>
          </Link>

          {/* Spectator Link (admin only, secondary style) */}
          {isAdmin && trip.spectator_token && (
            <Card variant="secondary" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-1 text-text-2">
                    <EyeIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-1">Spectator Link</p>
                    <p className="text-xs text-text-2">Share for read-only leaderboard access</p>
                  </div>
                </div>
                <SpectatorLinkCopyButton token={trip.spectator_token} />
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Section D: Rounds on this Trip */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text-0">
            Rounds on this Trip
          </h2>
          {hasPlayers && hasRounds && (
            <Link href={`/trip/${params.tripId}/round/new`}>
              <Button variant="secondary">
                <PlusIcon />
                New Round
              </Button>
            </Link>
          )}
        </div>

        {trip.recentRounds.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-2">
              {hasPlayers
                ? 'No rounds yet. Create your first round to start scoring.'
                : 'Add players first, then create your first round.'}
            </p>
            {hasPlayers && (
              <Link href={`/trip/${params.tripId}/round/new`}>
                <Button variant="secondary" className="mt-4">
                  Create First Round
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {trip.recentRounds.map((round) => (
              <Link
                key={round.id}
                href={`/trip/${params.tripId}/round/${round.id}`}
              >
                <Card className="p-4 transition-all hover:border-accent/50 active:scale-[0.99]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-0">{round.name}</p>
                      <p className="text-xs text-text-2">
                        {formatRoundDate(round.date)}
                      </p>
                    </div>
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
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </LayoutContainer>
  )
}

// Icons

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5 text-text-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}
