'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RoundFormat } from '@/components/round/RoundFormatSelector'

export interface QuickRoundPlayer {
  id: string
  name: string
  handicap: number | null
}

export interface QuickRoundDraft {
  players: QuickRoundPlayer[]
  format: RoundFormat
  scoringBasis: 'gross' | 'net'
  courseId: string | null
  teeId: string | null
  courseDisplayName: string | null
  teeName: string | null
  teeTime: string | null
  startImmediately: boolean
}

const STORAGE_KEY = 'golf_trip_hq_quick_round_draft'

const defaultDraft: QuickRoundDraft = {
  players: [],
  format: 'stroke_play',
  scoringBasis: 'net',
  courseId: null,
  teeId: null,
  courseDisplayName: null,
  teeName: null,
  teeTime: null,
  startImmediately: true,
}

export function useQuickRoundDraft() {
  const [draft, setDraft] = useState<QuickRoundDraft>(defaultDraft)
  const [isHydrated, setIsHydrated] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to ensure all fields exist
        setDraft(prev => ({ ...prev, ...parsed }))
      }
    } catch (err) {
      console.error('Failed to parse draft:', err)
    }
    setIsHydrated(true)
  }, [])

  // Debounced save (500ms)
  const updateDraft = useCallback((updates: Partial<QuickRoundDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...updates }

      // Debounced localStorage write
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch (err) {
          console.error('Failed to save draft:', err)
        }
      }, 500)

      return next
    })
  }, [])

  const clearDraft = useCallback(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    localStorage.removeItem(STORAGE_KEY)
    setDraft(defaultDraft)
  }, [])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return { draft, isHydrated, updateDraft, clearDraft }
}
