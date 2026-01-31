import Link from 'next/link'
import { getTripsAction } from '@/lib/supabase/trip-actions'
import { getCurrentUser } from '@/lib/supabase/auth-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Button } from '@/components/ui/Button'
import { TripCard } from '@/components/trip/TripCard'
import { getTripStatus } from '@/lib/trip-utils'
import { NextUpHero } from '@/components/trip/NextUpHero'
import { QuickActions } from '@/components/trip/QuickActions'
import { DashboardHeader } from '@/components/trip/DashboardHeader'

export const dynamic = 'force-dynamic'

export default async function TripsPage() {
  const [user, { trips, error }] = await Promise.all([
    getCurrentUser(),
    getTripsAction(),
  ])

  // Sort trips: active first, then upcoming, then past
  const sortedTrips = [...trips].sort((a, b) => {
    const statusOrder = { active: 0, upcoming: 1, past: 2 }
    const aStatus = getTripStatus(a.start_date, a.end_date) || 'past'
    const bStatus = getTripStatus(b.start_date, b.end_date) || 'past'
    const aOrder = statusOrder[aStatus] ?? 2
    const bOrder = statusOrder[bStatus] ?? 2
    if (aOrder !== bOrder) return aOrder - bOrder
    // Within same status, sort by start date desc
    return new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime()
  })

  // Find the hero trip: active > soonest upcoming
  const heroTrip = sortedTrips.find((t) => {
    const s = getTripStatus(t.start_date, t.end_date)
    return s === 'active'
  }) || sortedTrips.find((t) => {
    const s = getTripStatus(t.start_date, t.end_date)
    return s === 'upcoming'
  })

  // Remaining trips (exclude hero trip)
  const remainingTrips = sortedTrips.filter((t) => t.id !== heroTrip?.id)
  const pastTrips = remainingTrips.filter((t) => getTripStatus(t.start_date, t.end_date) === 'past')
  const activeOrUpcomingTrips = remainingTrips.filter((t) => getTripStatus(t.start_date, t.end_date) !== 'past')

  return (
    <LayoutContainer className="py-6 space-y-6">
      {/* Header */}
      <DashboardHeader userEmail={user?.email} />

      {/* Error state */}
      {error && (
        <div className="rounded-card bg-bad/10 p-4 text-bad">
          {error}
        </div>
      )}

      {/* Empty state */}
      {trips.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <span className="text-4xl" role="img" aria-label="golf flag">⛳</span>
            </div>
            <h2 className="mb-2 font-display text-2xl font-bold text-text-0">
              Welcome to Golf Trip HQ
            </h2>
            <p className="text-text-2 max-w-xs mx-auto">
              Track scores, manage trips, and settle the bragging rights. Create your first trip to get started.
            </p>
          </div>

          <div className="space-y-3 max-w-xs mx-auto">
            <Link href="/trips/new">
              <Button size="large" className="w-full">
                <PlusIcon />
                Create Your First Trip
              </Button>
            </Link>
            <Link href="/quick-round">
              <Button variant="secondary" className="w-full">
                <BoltIcon />
                Or Start a Quick Round
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Hero — Next Up / Active Trip */}
          {heroTrip && (
            <NextUpHero
              tripId={heroTrip.id}
              tripName={heroTrip.name}
              startDate={heroTrip.start_date}
              endDate={heroTrip.end_date}
              memberCount={heroTrip.trip_members?.length ?? 0}
              description={heroTrip.description}
            />
          )}

          {/* Quick Actions */}
          <QuickActions />

          {/* Active & Upcoming Trips */}
          {activeOrUpcomingTrips.length > 0 && (
            <section>
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-3">
                Your Trips
              </h2>
              <div className="space-y-3">
                {activeOrUpcomingTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    id={trip.id}
                    name={trip.name}
                    description={trip.description}
                    startDate={trip.start_date}
                    endDate={trip.end_date}
                    memberCount={trip.trip_members?.length}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past Trips */}
          {pastTrips.length > 0 && (
            <section>
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-2 mb-3">
                Past Trips
              </h2>
              <div className="space-y-3">
                {pastTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    id={trip.id}
                    name={trip.name}
                    description={trip.description}
                    startDate={trip.start_date}
                    endDate={trip.end_date}
                    memberCount={trip.trip_members?.length}
                    isPast
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Bottom spacer for safe area */}
      <div className="h-6" />
    </LayoutContainer>
  )
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}
