'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { updateRoundAction } from '@/lib/supabase/round-actions'

interface StartRoundButtonProps {
  roundId: string
  tripId: string
  hasTeeData?: boolean
}

export function StartRoundButton({ roundId, tripId, hasTeeData = true }: StartRoundButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    const result = await updateRoundAction(roundId, tripId, {
      status: 'in_progress',
    })

    if (result.success) {
      router.push(`/trip/${tripId}/round/${roundId}/score`)
    } else {
      alert(result.error || 'Failed to start round')
      setLoading(false)
    }
  }

  // If no tee data, show setup required message
  if (!hasTeeData) {
    return (
      <Card className="p-4 border-gold/50 bg-gold/5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-text-0">Course setup required</p>
            <p className="mt-1 text-sm text-text-2">
              Select a course and tees to enable scoring with accurate pars and handicap strokes.
            </p>
            <Link href={`/trip/${tripId}/round/${roundId}/setup`}>
              <Button size="default" className="mt-3">
                Complete Setup
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Button
      size="large"
      className="w-full"
      onClick={handleStart}
      loading={loading}
    >
      Start Round
    </Button>
  )
}
