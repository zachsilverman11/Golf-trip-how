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
  teamAssignments: Record<string, 1 | 2>  // playerId -> team (1 or 2)
}

const STORAGE_KEY = 'press_quick_round_draft'

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
  teamAssignments: {},
}

/**
 * Auto-assign teams based on player order (first 2 -> Team 1, next 2 -> Team 2)
 */
function autoAssignTeams(players: QuickRoundPlayer[]): Record<string, 1 | 2> {
  const assignments: Record<string, 1 | 2> = {}
  players.forEach((player, idx) => {
    assignments[player.id] = idx < 2 ? 1 : 2
  })
  return assignments
}

/**
 * Check if current assignments are valid for the given players
 * (all 4 players assigned, 2 per team)
 */
function areTeamAssignmentsValid(
  players: QuickRoundPlayer[],
  assignments: Record<string, 1 | 2>
): boolean {
  if (players.length !== 4) return false

  // Check all players are assigned
  const allAssigned = players.every(p => assignments[p.id] === 1 || assignments[p.id] === 2)
  if (!allAssigned) return false

  // Check 2 per team
  const team1Count = players.filter(p => assignments[p.id] === 1).length
  const team2Count = players.filter(p => assignments[p.id] === 2).length

  return team1Count === 2 && team2Count === 2
}

export function useQuickRoundDraft() {
  const [draft, setDraft] = useState<QuickRoundDraft>(defaultDraft)
  const [isHydrated, setIsHydrated] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clear stale drafts on mount — always start fresh
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      // ignore
    }
    setDraft(defaultDraft)
    setIsHydrated(true)
  }, [])

  // Debounced save (500ms)
  const updateDraft = useCallback((updates: Partial<QuickRoundDraft>) => {
    setDraft(prev => {
      let next = { ...prev, ...updates }

      // Smart team assignment handling when players change
      if (updates.players !== undefined) {
        const newPlayers = updates.players
        const needsTeams = next.format === 'match_play' || next.format === 'points_hilo'

        if (needsTeams && newPlayers.length === 4) {
          // Check if existing assignments are still valid
          const existingValid = areTeamAssignmentsValid(newPlayers, next.teamAssignments)

          if (!existingValid) {
            // Auto-assign teams for the new players
            next = { ...next, teamAssignments: autoAssignTeams(newPlayers) }
          }
        } else if (newPlayers.length !== 4) {
          // Clear team assignments if not exactly 4 players
          next = { ...next, teamAssignments: {} }
        }
      }

      // Auto-assign teams when format changes to one that requires teams
      if (updates.format !== undefined) {
        const needsTeams = updates.format === 'match_play' || updates.format === 'points_hilo'

        if (needsTeams && next.players.length === 4) {
          const existingValid = areTeamAssignmentsValid(next.players, next.teamAssignments)

          if (!existingValid) {
            next = { ...next, teamAssignments: autoAssignTeams(next.players) }
          }
        }
      }

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
