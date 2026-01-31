'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeScoresOptions {
  roundId: string
  onScoreChange: () => void
  onMatchChange?: () => void
  enabled?: boolean
}

interface UseRealtimeScoresReturn {
  isConnected: boolean
  /** Call when the local user saves a score, to suppress the realtime echo */
  markLocalSave: () => void
}

/**
 * Subscribe to realtime score, match, and press changes for a round.
 *
 * Callbacks trigger a parent-level data refresh (server actions).
 * Uses refs so the subscription channel is never torn down when
 * callbacks change identity — only when roundId or enabled changes.
 */
export function useRealtimeScores({
  roundId,
  onScoreChange,
  onMatchChange,
  enabled = true,
}: UseRealtimeScoresOptions): UseRealtimeScoresReturn {
  const [isConnected, setIsConnected] = useState(false)

  // Stable refs for callbacks to avoid re-subscribing
  const onScoreChangeRef = useRef(onScoreChange)
  onScoreChangeRef.current = onScoreChange

  const onMatchChangeRef = useRef(onMatchChange)
  onMatchChangeRef.current = onMatchChange

  // Track last save timestamp so we can suppress self-triggered events
  const lastSaveTimestamp = useRef<number>(0)

  const markLocalSave = useCallback(() => {
    lastSaveTimestamp.current = Date.now()
  }, [])

  useEffect(() => {
    if (!enabled || !roundId) return

    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const shouldHandle = () => {
      // Ignore realtime events within 2s of our own save
      return Date.now() - lastSaveTimestamp.current > 2000
    }

    channel = supabase
      .channel(`round-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          if (shouldHandle()) {
            onScoreChangeRef.current()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          if (shouldHandle()) {
            onMatchChangeRef.current?.()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presses',
        },
        () => {
          if (shouldHandle()) {
            onMatchChangeRef.current?.()
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      setIsConnected(false)
    }
  }, [roundId, enabled])

  return { isConnected, markLocalSave }
}
