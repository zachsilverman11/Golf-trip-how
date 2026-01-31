import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { RoundHistoryEntry } from '@/lib/supabase/player-profile-actions'

interface RoundHistoryProps {
  rounds: RoundHistoryEntry[]
}

const FORMAT_LABELS: Record<string, string> = {
  stroke_play: 'Stroke',
  match_play: 'Match',
  points_hilo: 'Hi/Lo',
  stableford: 'Stableford',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function RoundHistory({ rounds }: RoundHistoryProps) {
  if (rounds.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-text-2">No rounds recorded yet.</p>
      </Card>
    )
  }

  return (
    <Card>
      {rounds.map((round, idx) => {
        const scoreDiff = round.grossTotal - round.par
        const scoreColor =
          scoreDiff < 0 ? 'text-good' : scoreDiff > 0 ? 'text-bad' : 'text-text-0'
        const scorePrefix = scoreDiff > 0 ? '+' : ''

        return (
          <Link
            key={`${round.roundId}-${idx}`}
            href={`/trip/${round.tripId}/round/${round.roundId}`}
            className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-bg-2/50 ${
              idx < rounds.length - 1 ? 'border-b border-stroke/60' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-0 truncate">
                  {round.roundName}
                </span>
                <Badge variant="default">
                  {FORMAT_LABELS[round.format] || round.format}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-text-2">
                <span>{formatDate(round.date)}</span>
                <span>·</span>
                <span>{round.tripName}</span>
                {round.holesPlayed < 18 && (
                  <>
                    <span>·</span>
                    <span>{round.holesPlayed}H</span>
                  </>
                )}
              </div>
            </div>
            <div className="ml-3 text-right">
              <span className="font-display text-lg font-bold text-text-0">
                {round.grossTotal}
              </span>
              <p className={`text-xs font-medium ${scoreColor}`}>
                {scoreDiff === 0 ? 'E' : `${scorePrefix}${scoreDiff}`}
              </p>
            </div>
          </Link>
        )
      })}
    </Card>
  )
}
