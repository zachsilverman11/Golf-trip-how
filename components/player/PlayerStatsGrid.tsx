import { Card } from '@/components/ui/Card'
import type { PlayerStats, MatchRecord } from '@/lib/supabase/player-profile-actions'

interface PlayerStatsGridProps {
  stats: PlayerStats
  matchRecord: MatchRecord
}

function StatCard({
  label,
  value,
  subValue,
  accent,
}: {
  label: string
  value: string | number
  subValue?: string
  accent?: 'gold' | 'good' | 'bad' | 'default'
}) {
  const accentColors = {
    gold: 'text-accent',
    good: 'text-good',
    bad: 'text-bad',
    default: 'text-text-0',
  }

  return (
    <Card variant="secondary" className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-text-2">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${accentColors[accent || 'default']}`}>
        {value}
      </p>
      {subValue && (
        <p className="mt-0.5 text-xs text-text-2">{subValue}</p>
      )}
    </Card>
  )
}

export function PlayerStatsGrid({ stats, matchRecord }: PlayerStatsGridProps) {
  const totalMatchesPlayed = matchRecord.wins + matchRecord.losses + matchRecord.ties

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <StatCard
        label="Rounds Played"
        value={stats.totalRounds}
      />
      <StatCard
        label="Scoring Avg"
        value={stats.grossAverage ?? '—'}
        subValue={stats.netAverage ? `Net ${stats.netAverage}` : undefined}
        accent="gold"
      />
      <StatCard
        label="Best Round"
        value={stats.bestGrossRound ?? '—'}
        accent="good"
      />
      <StatCard
        label="Birdies"
        value={stats.birdies}
        subValue={`${stats.pars} pars`}
        accent="good"
      />
      <StatCard
        label="Bogeys"
        value={stats.bogeys}
        subValue={`${stats.doubleBogeyPlus} double+`}
        accent="bad"
      />
      {totalMatchesPlayed > 0 ? (
        <StatCard
          label="Match Play"
          value={`${matchRecord.wins}-${matchRecord.losses}-${matchRecord.ties}`}
          subValue={`${totalMatchesPlayed} played`}
          accent="gold"
        />
      ) : (
        <StatCard
          label="Match Play"
          value="—"
          subValue="No matches"
        />
      )}
      {stats.totalSkinsWon > 0 && (
        <StatCard
          label="Skins Won"
          value={stats.totalSkinsWon}
          accent="gold"
        />
      )}
    </div>
  )
}
