import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTripAction } from '@/lib/supabase/trip-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Divider } from '@/components/ui/Divider'
import { SpectatorLinkCopyButton } from '@/components/trip/SpectatorLinkCopyButton'

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

export default async function TripPage({ params }: TripPageProps) {
  const { trip, userRole, error } = await getTripAction(params.tripId)

  if (error || !trip) {
    notFound()
  }

  const isAdmin = userRole === 'admin'

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

      {/* Trip header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-0">
              {trip.name}
            </h1>
            {trip.description && (
              <p className="mt-1 text-text-2">{trip.description}</p>
            )}
          </div>
          {isAdmin && (
            <Badge variant="gold">Admin</Badge>
          )}
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
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <Link href={`/trip/${params.tripId}/round/new`}>
          <Card className="p-4 transition-all hover:border-accent/50 active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <FlagIcon />
              </div>
              <div>
                <p className="font-medium text-text-0">Start Round</p>
                <p className="text-xs text-text-2">Begin scoring a round</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href={`/trip/${params.tripId}/players`}>
          <Card className="p-4 transition-all hover:border-accent/50 active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-good/10 text-good">
                <UsersIcon />
              </div>
              <div>
                <p className="font-medium text-text-0">Manage Players</p>
                <p className="text-xs text-text-2">Add or edit players</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Divider />

      {/* Members section */}
      <div className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold text-text-0">
          Trip Members
        </h2>
        <Card>
          {trip.trip_members?.map((member, idx) => (
            <div
              key={member.id}
              className={`flex items-center justify-between px-4 py-3 ${
                idx < trip.trip_members.length - 1 ? 'border-b border-stroke/60' : ''
              }`}
            >
              <span className="text-text-0">
                {member.user_id}
              </span>
              <Badge variant={member.role === 'admin' ? 'gold' : 'default'}>
                {member.role}
              </Badge>
            </div>
          ))}
        </Card>
      </div>

      {/* Spectator link */}
      {isAdmin && trip.spectator_token && (
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-bold text-text-0">
            Spectator Link
          </h2>
          <Card className="p-4">
            <p className="mb-2 text-sm text-text-2">
              Share this link for read-only access to the leaderboard:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded bg-bg-2 px-3 py-2 text-sm text-accent">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/spectator/${trip.spectator_token}`
                  : `/spectator/${trip.spectator_token}`}
              </code>
              <CopyButton token={trip.spectator_token} />
            </div>
          </Card>
        </div>
      )}

      {/* Recent rounds placeholder */}
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-text-0">
          Recent Rounds
        </h2>
        <Card className="p-8 text-center">
          <p className="text-text-2">No rounds yet</p>
          <Link href={`/trip/${params.tripId}/round/new`}>
            <Button variant="secondary" className="mt-4">
              Create First Round
            </Button>
          </Link>
        </Card>
      </div>
    </LayoutContainer>
  )
}

const CopyButton = SpectatorLinkCopyButton

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

function FlagIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
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
