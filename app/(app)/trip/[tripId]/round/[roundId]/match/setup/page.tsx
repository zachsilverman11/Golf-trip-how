'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Button } from '@/components/ui/Button'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { MatchSetupForm } from '@/components/match'
import { getRoundAction } from '@/lib/supabase/round-actions'
import { createMatchAction, getMatchForRoundAction } from '@/lib/supabase/match-actions'
import type { CreateMatchInput } from '@/lib/supabase/match-types'

interface Player {
  id: string
  name: string
}

export default function MatchSetupPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const roundId = params.roundId as string

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      // Check if match already exists
      const matchResult = await getMatchForRoundAction(roundId)
      if (matchResult.match) {
        // Match already exists, redirect to match details
        router.replace(`/trip/${tripId}/round/${roundId}/match`)
        return
      }

      // Load round to get players
      const roundResult = await getRoundAction(roundId)
      if (roundResult.error || !roundResult.round) {
        setError(roundResult.error || 'Round not found')
        setLoading(false)
        return
      }

      // Extract players from groups
      const roundPlayers: Player[] = []
      roundResult.round.groups?.forEach((group) => {
        group.group_players?.forEach((gp) => {
          const player = (gp as any).players
          if (player?.id && player?.name) {
            // Deduplicate in case a player is in multiple groups
            if (!roundPlayers.find((p) => p.id === player.id)) {
              roundPlayers.push({ id: player.id, name: player.name })
            }
          }
        })
      })

      if (roundPlayers.length < 2) {
        setError('At least 2 players are needed to set up a money game. Add players to the round first.')
        setLoading(false)
        return
      }

      setPlayers(roundPlayers)
      setLoading(false)
    }

    loadData()
  }, [roundId, tripId, router])

  const handleMatchConfigured = async (
    config: Omit<CreateMatchInput, 'roundId'>
  ) => {
    setSaving(true)
    setError(null)

    const result = await createMatchAction({
      ...config,
      roundId,
    })

    if (result.success) {
      // Redirect back to round page which will now show the match
      router.push(`/trip/${tripId}/round/${roundId}`)
    } else {
      setError(result.error || 'Failed to create match')
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push(`/trip/${tripId}/round/${roundId}`)
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading...</div>
      </LayoutContainer>
    )
  }

  if (error && players.length === 0) {
    return (
      <LayoutContainer className="py-6">
        <ErrorCard
          title="Can't Set Up Money Game"
          message={error}
          backHref={`/trip/${tripId}/round/${roundId}`}
          backLabel="Back to Round"
        />
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/trip/${tripId}/round/${roundId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to round
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">
          Set Up Money Game
        </h1>
        <p className="mt-1 text-text-2">
          Choose teams, match type, and stakes
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-card bg-bad/10 p-4 text-bad text-sm">
          {error}
        </div>
      )}

      {/* Setup Form */}
      <MatchSetupForm
        players={players}
        onMatchConfigured={handleMatchConfigured}
        onCancel={handleCancel}
      />

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 bg-bg-0/50 flex items-center justify-center z-50">
          <div className="bg-bg-1 rounded-card p-6 text-center shadow-lg">
            <div className="text-text-2 mb-2">Creating match...</div>
            <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}
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
