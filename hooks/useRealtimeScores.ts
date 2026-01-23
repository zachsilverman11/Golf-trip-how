'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Score {
  id: string
  round_id: string
  player_id: string
  hole_number: number
  gross_strokes: number | null
}

interface UseRealtimeScoresOptions {
  roundId: string
  onScoreChange?: (score: Score) => void
  pollingInterval?: number // Fallback polling interval in ms
}

interface UseRealtimeScoresReturn {
  scores: Map<string, Map<number, number | null>> // playerId -> holeNumber -> score
  isConnected: boolean
  lastUpdate: Date | null
  refetch: () => Promise<void>
}

export function useRealtimeScores({
  roundId,
  onScoreChange,
  pollingInterval = 10000, // 10 second fallback polling
}: UseRealtimeScoresOptions): UseRealtimeScoresReturn {
  const [scores, setScores] = useState<Map<string, Map<number, number | null>>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  // Fetch all scores for the round
  const fetchScores = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from('scores')
      .select('*')
      .eq('round_id', roundId)

    if (error) {
      console.error('Error fetching scores:', error)
      return
    }

    const newScores = new Map<string, Map<number, number | null>>()

    for (const score of data || []) {
      if (!newScores.has(score.player_id)) {
        newScores.set(score.player_id, new Map())
      }
      newScores.get(score.player_id)!.set(score.hole_number, score.gross_strokes)
    }

    setScores(newScores)
    setLastUpdate(new Date())
  }, [roundId])

  // Handle realtime score change
  const handleScoreChange = useCallback((payload: any) => {
    const score = payload.new as Score

    setScores((prev) => {
      const next = new Map(prev)
      if (!next.has(score.player_id)) {
        next.set(score.player_id, new Map())
      }
      next.get(score.player_id)!.set(score.hole_number, score.gross_strokes)
      return next
    })

    setLastUpdate(new Date())

    if (onScoreChange) {
      onScoreChange(score)
    }
  }, [onScoreChange])

  // Set up realtime subscription
  useEffect(() => {
    const supabase = supabaseRef.current

    // Initial fetch
    fetchScores()

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`scores:${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `round_id=eq.${roundId}`,
        },
        (payload) => {
          handleScoreChange(payload)
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    // Fallback polling in case realtime is not available
    const pollInterval = setInterval(() => {
      if (!isConnected) {
        fetchScores()
      }
    }, pollingInterval)

    return () => {
      clearInterval(pollInterval)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [roundId, fetchScores, handleScoreChange, pollingInterval, isConnected])

  return {
    scores,
    isConnected,
    lastUpdate,
    refetch: fetchScores,
  }
}

// Helper to convert Map to plain object for easier use
export function scoresToObject(
  scores: Map<string, Map<number, number | null>>
): { [playerId: string]: { [hole: number]: number | null } } {
  const result: { [playerId: string]: { [hole: number]: number | null } } = {}

  scores.forEach((holes, playerId) => {
    result[playerId] = {}
    holes.forEach((score, hole) => {
      result[playerId][hole] = score
    })
  })

  return result
}
