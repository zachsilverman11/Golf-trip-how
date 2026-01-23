'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { updateRoundAction } from '@/lib/supabase/round-actions'

interface StartRoundButtonProps {
  roundId: string
  tripId: string
}

export function StartRoundButton({ roundId, tripId }: StartRoundButtonProps) {
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
