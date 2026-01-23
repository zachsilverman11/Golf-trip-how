'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  Badge,
  Divider,
  LeaderboardRow,
  ScoreDelta,
  LayoutContainer,
  Tabs,
  BottomNav,
  NavIcons,
  NumberPill,
} from '@/components/ui'

const navItems = [
  { id: 'trip', label: 'Trip', icon: NavIcons.Trip },
  { id: 'round', label: 'Round', icon: NavIcons.Round },
  { id: 'leaderboard', label: 'Leaderboard', icon: NavIcons.Leaderboard },
  { id: 'matches', label: 'Matches', icon: NavIcons.Matches },
  { id: 'settle', label: 'Settle', icon: NavIcons.Settle },
  { id: 'feed', label: 'Feed', icon: NavIcons.Feed },
]

const scoreTabs = [
  { id: 'gross', label: 'Gross' },
  { id: 'net', label: 'Net' },
]

const holeTabs = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'total', label: 'Total' },
]

const leaderboardData = [
  {
    rank: 1,
    name: 'Tiger Woods',
    score: 68,
    delta: -4,
    thru: 18,
    badges: [{ text: 'LEADER', variant: 'gold' as const }],
  },
  {
    rank: 2,
    name: 'Rory McIlroy',
    score: 70,
    delta: -2,
    thru: 18,
    badges: [{ text: 'PRESS', variant: 'press' as const }],
  },
  {
    rank: 3,
    name: 'You',
    score: 72,
    delta: 0,
    thru: 16,
    isCurrentUser: true,
    badges: [{ text: 'LIVE', variant: 'live' as const }],
  },
  {
    rank: 4,
    name: 'Jordan Spieth',
    score: 73,
    delta: 1,
    thru: 17,
    badges: [{ text: '2 DOWN', variant: 'negative' as const }],
  },
  {
    rank: 5,
    name: 'Scottie Scheffler',
    score: 75,
    delta: 3,
    thru: 18,
    badges: [],
  },
]

export default function Demo() {
  const [activeNav, setActiveNav] = useState('leaderboard')
  const [activeScoreTab, setActiveScoreTab] = useState('gross')
  const [activeHoleTab, setActiveHoleTab] = useState('total')
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-bg-0 pb-20">
      <LayoutContainer className="py-8">
        <h1 className="mb-8 font-display text-3xl font-bold text-text-0">
          Trip Caddie Component Demo
        </h1>

        {/* Buttons Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Buttons
          </h2>
          <Card className="p-6">
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="primary" size="large">
                Large Primary
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button
                variant="primary"
                loading={loading}
                onClick={() => {
                  setLoading(true)
                  setTimeout(() => setLoading(false), 2000)
                }}
              >
                Click for Loading
              </Button>
            </div>
          </Card>
        </section>

        {/* Cards Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Cards
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-2 font-display font-semibold text-text-0">
                Primary Card
              </h3>
              <p className="text-body text-text-1">
                This is a primary card with bg-1 background and stroke border.
              </p>
            </Card>
            <Card variant="secondary" className="p-6">
              <h3 className="mb-2 font-display font-semibold text-text-0">
                Secondary Card
              </h3>
              <p className="text-body text-text-1">
                This is a secondary card with bg-2 background.
              </p>
            </Card>
            <Card elevated className="p-6">
              <h3 className="mb-2 font-display font-semibold text-text-0">
                Elevated Card
              </h3>
              <p className="text-body text-text-1">
                This card has a subtle shadow for elevation.
              </p>
            </Card>
          </div>
        </section>

        {/* Badges Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Badges
          </h2>
          <Card className="p-6">
            <p className="mb-3 text-xs text-text-2 uppercase tracking-wide">High Priority</p>
            <div className="flex flex-wrap gap-3 mb-4">
              <Badge variant="live">LIVE</Badge>
              <Badge variant="press">PRESS</Badge>
            </div>
            <p className="mb-3 text-xs text-text-2 uppercase tracking-wide">Status</p>
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="positive">2 UP</Badge>
              <Badge variant="negative">DORMIE</Badge>
              <Badge variant="gold">LEADER</Badge>
            </div>
          </Card>
        </section>

        {/* Number Pills Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Number Pills
          </h2>
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <NumberPill value={72} />
              <NumberPill value={-3} variant="positive" />
              <NumberPill value={+5} variant="negative" />
              <NumberPill value={68} size="lg" />
              <NumberPill value="E" size="sm" />
            </div>
          </Card>
        </section>

        {/* Score Deltas Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Score Deltas
          </h2>
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <ScoreDelta value={-4} />
                <p className="mt-1 text-sm text-text-2">Under par</p>
              </div>
              <div className="text-center">
                <ScoreDelta value={0} />
                <p className="mt-1 text-sm text-text-2">Even</p>
              </div>
              <div className="text-center">
                <ScoreDelta value={3} />
                <p className="mt-1 text-sm text-text-2">Over par</p>
              </div>
              <div className="text-center">
                <ScoreDelta value={-2} size="sm" />
                <p className="mt-1 text-sm text-text-2">Small</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Divider Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Divider
          </h2>
          <Card className="p-6">
            <p className="text-body text-text-1">Content above the divider</p>
            <Divider spacing="sm" />
            <p className="text-sm text-text-2">Small spacing (8px)</p>
            <Divider spacing="md" />
            <p className="text-sm text-text-2">Medium spacing (16px) - default</p>
            <Divider spacing="lg" />
            <p className="text-sm text-text-2">Large spacing (24px)</p>
          </Card>
        </section>

        {/* Tabs Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Tabs
          </h2>
          <Card className="p-6">
            <div className="flex flex-col gap-6">
              <div>
                <p className="mb-2 text-sm text-text-2">Score Type Toggle</p>
                <Tabs
                  tabs={scoreTabs}
                  activeTab={activeScoreTab}
                  onChange={setActiveScoreTab}
                />
              </div>
              <div>
                <p className="mb-2 text-sm text-text-2">Hole Selection</p>
                <Tabs
                  tabs={holeTabs}
                  activeTab={activeHoleTab}
                  onChange={setActiveHoleTab}
                />
              </div>
            </div>
          </Card>
        </section>

        {/* Leaderboard Section */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Leaderboard
          </h2>
          <Card className="overflow-hidden p-0">
            {leaderboardData.map((player) => (
              <LeaderboardRow
                key={player.rank}
                rank={player.rank}
                name={player.name}
                score={player.score}
                delta={player.delta}
                thru={player.thru}
                isCurrentUser={player.isCurrentUser}
                badges={player.badges}
              />
            ))}
          </Card>
        </section>

        {/* Colors Reference */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Color Palette
          </h2>
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-bg-0 border border-stroke" />
                <p className="text-sm text-text-2">bg-0</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-bg-1" />
                <p className="text-sm text-text-2">bg-1</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-bg-2" />
                <p className="text-sm text-text-2">bg-2</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-stroke" />
                <p className="text-sm text-text-2">stroke</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-accent" />
                <p className="text-sm text-text-2">accent</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-good" />
                <p className="text-sm text-text-2">good</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-bad" />
                <p className="text-sm text-text-2">bad</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-gold" />
                <p className="text-sm text-text-2">gold</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Typography Reference */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-semibold text-text-0">
            Typography
          </h2>
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <p className="font-display text-score-lg font-bold">
                  Score Display (Space Grotesk) - 68
                </p>
              </div>
              <div>
                <p className="font-display text-score font-bold">
                  Score Medium (Space Grotesk) - 72
                </p>
              </div>
              <div>
                <p className="text-body text-text-0">
                  Body text (Inter) - The quick brown fox jumps over the lazy
                  dog.
                </p>
              </div>
              <div>
                <p className="text-body text-text-1">
                  Secondary text (Inter) - Supporting information and details.
                </p>
              </div>
              <div>
                <p className="text-sm text-text-2">
                  Muted text (Inter) - Labels and hints.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </LayoutContainer>

      <BottomNav
        items={navItems}
        activeItem={activeNav}
        onChange={setActiveNav}
      />
    </div>
  )
}
