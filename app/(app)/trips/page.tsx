import Link from 'next/link'
import { getTripsAction } from '@/lib/supabase/trip-actions'
import { getCurrentUser, signOut } from '@/lib/supabase/auth-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Button } from '@/components/ui/Button'
import { TripCard } from '@/components/trip/TripCard'

export const dynamic = 'force-dynamic'

export default async function TripsPage() {
  const [user, { trips, error }] = await Promise.all([
    getCurrentUser(),
    getTripsAction(),
  ])

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-0">
            Your Trips
          </h1>
          <p className="text-sm text-text-2">
            {user?.email}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-card bg-bad/10 p-4 text-bad">
          {error}
        </div>
      )}

      {/* Trip list */}
      {trips.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4 text-4xl opacity-50">
            <span role="img" aria-label="golf flag">⛳</span>
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-text-0">
            No trips yet
          </h2>
          <p className="mb-6 text-text-2">
            Create your first golf trip to get started
          </p>
          <Link href="/trips/new">
            <Button size="large">
              Create Trip
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {trips.map((trip) => (
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

          <Link href="/trips/new">
            <Button variant="secondary" className="w-full">
              <PlusIcon />
              Create New Trip
            </Button>
          </Link>
        </>
      )}
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
