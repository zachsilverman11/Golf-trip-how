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
        <div className="py-8">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-card border border-accent/20 bg-gradient-to-br from-accent/10 via-bg-1 to-bg-2 p-6 mb-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/8 blur-3xl" />
            <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-good/6 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-text-0 leading-tight mb-3">
                Every hole has<br />a story.
              </h2>
              <p className="text-text-1 text-base leading-relaxed max-w-sm">
                The press on 14 that changed everything. The three-putt 
                that cost someone $50. The shot nobody will ever shut up about.
              </p>
              <p className="text-text-2 text-sm mt-3">
                This is where it all lives.
              </p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <ScoreIcon />
              </div>
              <div>
                <p className="font-display font-bold text-text-0">Live scoring, real stakes</p>
                <p className="text-sm text-text-2">Track every hole across your group. Match play, presses, team games — all wired up.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                <MoneyIcon />
              </div>
              <div>
                <p className="font-display font-bold text-text-0">Know who owes who</p>
                <p className="text-sm text-text-2">Per-person settlement. No napkin math. No arguments. Just pay up.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-good/10 text-good">
                <TrophyIcon />
              </div>
              <div>
                <p className="font-display font-bold text-text-0">Ryder Cup your trip</p>
                <p className="text-sm text-text-2">Split into teams. Every round earns points. Crown a champion at the end.</p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Link href="/trips/new">
              <Button size="large" className="w-full">
                Start Your Trip
              </Button>
            </Link>
            <Link href="/quick-round">
              <Button variant="secondary" className="w-full">
                <BoltIcon />
                Just score a round
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
