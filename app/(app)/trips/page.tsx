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
        <div className="-mx-4 -mt-6 flex min-h-[calc(100dvh-80px)] flex-col">
          {/* Hero image section */}
          <div className="relative h-[55dvh] min-h-[320px] w-full overflow-hidden">
            {/* Background image */}
            <img
              src="/hero-golf.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Gradient overlay — dark at bottom for text */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg-0 via-bg-0/60 to-transparent" />
            {/* Content overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-8">
              <h1 className="font-display text-5xl font-extrabold tracking-wider text-text-0 mb-1">
                PRESS
              </h1>
              <p className="text-accent text-sm font-semibold uppercase tracking-widest mb-4">
                Always pressing.
              </p>
              <p className="text-text-1/80 text-[15px] leading-relaxed max-w-[300px]">
                The press on 14 that changed everything. The three-putt that cost someone $50.
              </p>
            </div>
          </div>

          {/* CTAs — right below the fold */}
          <div className="flex-1 flex flex-col justify-center px-4 py-6 space-y-3">
            <Link href="/trips/new">
              <Button size="large" className="w-full">
                Start a Trip
              </Button>
            </Link>
            <Link href="/quick-round">
              <Button variant="secondary" className="w-full">
                <BoltIcon />
                Quick Round
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-6 pt-3">
              <span className="text-text-2 text-xs flex items-center gap-1.5">
                <ScoreIcon /> Match Play
              </span>
              <span className="text-text-2 text-xs flex items-center gap-1.5">
                <MoneyIcon /> Settlement
              </span>
              <span className="text-text-2 text-xs flex items-center gap-1.5">
                <TrophyIcon /> Team Wars
              </span>
            </div>
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

    </LayoutContainer>
  )
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}

function ScoreIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  )
}

function MoneyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.853m0 0l-.5 4.169m.5-4.169a6.023 6.023 0 01-2.77-.853m2.77.853l.5 4.169" />
    </svg>
  )
}
