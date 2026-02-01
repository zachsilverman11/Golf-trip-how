import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRoundAction, updateRoundAction } from '@/lib/supabase/round-actions'
import { getMatchForRoundAction } from '@/lib/supabase/match-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Divider } from '@/components/ui/Divider'
import { StartRoundButton } from '@/components/trip/StartRoundButton'
import { RoundTeamAssignment } from '@/components/round/RoundTeamAssignment'
import { RoundManagement } from '@/components/round/RoundManagement'

export const dynamic = 'force-dynamic'

interface RoundPageProps {
  params: { tripId: string; roundId: string }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
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
  match_play: 'Match Play',
  points_hilo: 'Points (Hi/Lo)',
  stableford: 'Stableford',
  scramble: 'Scramble',
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

export default async function RoundPage({ params }: RoundPageProps) {
  const [roundResult, matchResult] = await Promise.all([
    getRoundAction(params.roundId),
    getMatchForRoundAction(params.roundId),
  ])

  const { round, error } = roundResult

  if (error || !round) {
    notFound()
  }

  const tee = round.tees
  const course = (tee as any)?.courses
  const hasTeeData = !!tee && !!(tee as any).holes?.length
  const match = matchResult.match

  // Build player name lookup and team data from groups
  const playerNames: Record<string, string> = {}
  const playersForTeams: Array<{
    id: string
    name: string
    handicap: number | null
    currentTeam: 1 | 2 | null
  }> = []

  round.groups?.forEach((group) => {
    group.group_players?.forEach((gp) => {
      const player = (gp as any).players
      if (player?.id && player?.name) {
        playerNames[player.id] = player.name
        playersForTeams.push({
          id: player.id,
          name: player.name,
          handicap: gp.playing_handicap,
          currentTeam: gp.team_number as 1 | 2 | null,
        })
      }
    })
  })

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/trip/${params.tripId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trip
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-2xl font-bold text-text-0">
                {round.name}
              </h1>
              <Badge variant={statusVariants[round.status]}>
                {statusLabels[round.status]}
              </Badge>
            </div>
            <p className="text-text-2">
              {formatDate(round.date)}
              {round.tee_time && (
                <span className="ml-2 text-text-1">
                  {formatTeeTime(round.tee_time)}
                </span>
              )}
            </p>
          </div>
          <RoundManagement
            roundId={params.roundId}
            tripId={params.tripId}
            round={{
              name: round.name,
              date: round.date,
              tee_time: round.tee_time,
              status: round.status,
              format: round.format,
            }}
          />
        </div>
      </div>

      {/* Course info */}
      {course && (
        <Card className="p-4 mb-4">
          <h2 className="mb-2 font-display text-lg font-bold text-text-0">
            {course.name}
          </h2>
          {tee && (
            <div className="flex items-center gap-4 text-sm text-text-2">
              <span>{tee.name} Tees</span>
              <span>Rating: {tee.rating}</span>
              <span>Slope: {tee.slope}</span>
              <span>{tee.yards} yards</span>
            </div>
          )}
        </Card>
      )}

      {/* Round info */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-text-2">Format: </span>
            <span className="text-text-0">{formatLabels[round.format]}</span>
          </div>
          <div>
            <span className="text-text-2">Scoring: </span>
            <span className="text-text-0">
              {round.scoring_basis === 'net' ? 'Net (Handicap)' : 'Gross'}
            </span>
          </div>
        </div>
      </Card>

      {/* Groups */}
      <div className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold text-text-0">
          Groups
        </h2>

        {round.groups?.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-2">No groups created</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {round.groups
              ?.sort((a, b) => a.group_number - b.group_number)
              .map((group) => (
                <Card key={group.id} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-text-0">
                      Group {group.group_number}
                    </span>
                    {group.tee_time && (
                      <span className="text-sm text-text-2">
                        {formatTime(group.tee_time)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.group_players?.map((gp) => (
                      <Badge key={gp.id} variant="default">
                        {(gp as any).players?.name}
                        {gp.playing_handicap !== null && (
                          <span className="ml-1 opacity-70">
                            ({gp.playing_handicap})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Team Assignment (for Points Hi/Lo format) */}
      {round.format === 'points_hilo' && (
        <div className="mb-6">
          <RoundTeamAssignment
            roundId={params.roundId}
            tripId={params.tripId}
            players={playersForTeams}
            format={round.format}
            status={round.status}
          />
        </div>
      )}

      {/* Money Game */}
      {match ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold text-text-0">
              Money Game
            </h2>
            <Link href={`/trip/${params.tripId}/round/${params.roundId}/match`}>
              <Button variant="secondary" size="default">
                {round.status === 'upcoming' ? 'Edit' : 'View Details'}
              </Button>
            </Link>
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="gold">{match.match_type.toUpperCase()}</Badge>
              <span className="text-sm font-medium text-accent">
                ${match.stake_per_man}/man
              </span>
            </div>
            <div className="text-sm text-text-1">
              <span className="text-text-0 font-medium">
                {playerNames[match.team_a_player1_id] || 'Player'}
                {match.team_a_player2_id && ` & ${playerNames[match.team_a_player2_id] || 'Player'}`}
              </span>
              <span className="text-text-2 mx-2">vs</span>
              <span className="text-text-0 font-medium">
                {playerNames[match.team_b_player1_id] || 'Player'}
                {match.team_b_player2_id && ` & ${playerNames[match.team_b_player2_id] || 'Player'}`}
              </span>
            </div>
          </Card>
        </div>
      ) : round.format === 'match_play' && round.status !== 'completed' && (
        <div className="mb-6">
          <Card className="p-4 border-gold/30 bg-gold/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-text-0">No money game set up yet</p>
                <p className="text-sm text-text-2">Add a money game to track bets for this match play round</p>
              </div>
            </div>
            <Link href={`/trip/${params.tripId}/round/${params.roundId}/match/setup`}>
              <Button variant="secondary" className="w-full">
                Set Up Money Game
              </Button>
            </Link>
          </Card>
        </div>
      )}

      <Divider />

      {/* Actions */}
      <div className="space-y-3">
        {round.status === 'upcoming' && (
          <StartRoundButton
            roundId={params.roundId}
            tripId={params.tripId}
            hasTeeData={hasTeeData}
          />
        )}

        {round.status === 'in_progress' && (
          <Link href={`/trip/${params.tripId}/round/${params.roundId}/score`}>
            <Button size="large" className="w-full">
              Continue Scoring
            </Button>
          </Link>
        )}

        {round.status === 'completed' && (
          <Link href={`/trip/${params.tripId}/leaderboard`}>
            <Button variant="secondary" className="w-full">
              View Leaderboard
            </Button>
          </Link>
        )}
      </div>
    </LayoutContainer>
  )
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
