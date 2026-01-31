import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PlayerStatsGrid } from '@/components/player/PlayerStatsGrid'
import { HandicapChart } from '@/components/player/HandicapChart'
import { RoundHistory } from '@/components/player/RoundHistory'
import { getPlayerProfileAction } from '@/lib/supabase/player-profile-actions'

interface PlayerProfilePageProps {
  params: { playerId: string }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { profile, error } = await getPlayerProfileAction(params.playerId)

  if (error || !profile) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-text-0">
            Player Not Found
          </h1>
          <p className="mt-2 text-sm text-text-2">{error || 'This player could not be loaded.'}</p>
        </div>
      </LayoutContainer>
    )
  }

  const { player, stats, roundHistory, tripHistory, handicapHistory, matchRecord } = profile
  const currentHandicap = player.handicap_index

  return (
    <LayoutContainer className="py-6 pb-24">
      {/* Back link */}
      <Link
        href={`/trip/${player.trip_id}/players`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to players
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 ring-2 ring-accent/30">
          <span className="font-display text-xl font-bold text-accent">
            {getInitials(player.name)}
          </span>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-0">
            {player.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            {currentHandicap !== null ? (
              <Badge variant="gold">
                HCP {currentHandicap > 0 ? currentHandicap : currentHandicap < 0 ? `+${Math.abs(currentHandicap)}` : '0'}
              </Badge>
            ) : (
              <Badge variant="default">No HCP</Badge>
            )}
            {tripHistory.length > 1 && (
              <Badge variant="default">
                {tripHistory.length} trips
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="mb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-text-2">
          Career Stats
        </h2>
        <PlayerStatsGrid stats={stats} matchRecord={matchRecord} />
      </section>

      {/* Handicap Chart */}
      {handicapHistory.length >= 2 && (
        <section className="mb-6">
          <HandicapChart data={handicapHistory} />
        </section>
      )}

      {/* Round History */}
      <section className="mb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-text-2">
          Round History
        </h2>
        <RoundHistory rounds={roundHistory} />
      </section>

      {/* Trip History */}
      {tripHistory.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-text-2">
            Trips
          </h2>
          <Card>
            {tripHistory.map((trip, idx) => (
              <Link
                key={trip.tripId}
                href={`/trip/${trip.tripId}`}
                className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-bg-2/50 ${
                  idx < tripHistory.length - 1 ? 'border-b border-stroke/60' : ''
                }`}
              >
                <div>
                  <span className="font-medium text-text-0">{trip.tripName}</span>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-2">
                    {trip.startDate && <span>{formatDate(trip.startDate)}</span>}
                    {trip.roundsPlayed > 0 && (
                      <>
                        <span>·</span>
                        <span>{trip.roundsPlayed} round{trip.roundsPlayed !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {trip.handicapIndex !== null && (
                    <Badge variant="default">
                      {trip.handicapIndex.toFixed(1)}
                    </Badge>
                  )}
                  <svg className="h-4 w-4 text-text-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </LayoutContainer>
  )
}
