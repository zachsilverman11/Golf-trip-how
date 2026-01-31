'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { getMatchStateAction } from './match-actions'
import { generateNarratives, type NarrativeEvent } from '../narrative-utils'
import type { MatchState } from './match-types'

// ============================================================================
// TYPES
// ============================================================================

export interface FeedEvent {
  id: string
  type:
    | 'round_started'
    | 'round_completed'
    | 'hole_result'
    | 'press_added'
    | 'match_closed'
    | 'match_status'
  timestamp: string // ISO date string
  roundId: string
  roundName: string
  holeNumber?: number
  players?: string[] // first names involved
  narrative: string // human-readable text
  intensity: 'high' | 'medium' | 'low'
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract first name from a full name */
function firstName(name: string): string {
  return name.split(' ')[0]
}

/** Build team label from TeamInfo */
function teamLabel(teamInfo: MatchState['teamA']): string {
  const names = [firstName(teamInfo.player1.name)]
  if (teamInfo.player2) names.push(firstName(teamInfo.player2.name))
  return names.length > 1 ? `${names[0]} & ${names[1]}` : names[0]
}

/** Get all player first names from a match state */
function allPlayerNames(state: MatchState): string[] {
  const names = [firstName(state.teamA.player1.name)]
  if (state.teamA.player2) names.push(firstName(state.teamA.player2.name))
  names.push(firstName(state.teamB.player1.name))
  if (state.teamB.player2) names.push(firstName(state.teamB.player2.name))
  return names
}

/** Estimate a timestamp for a hole event based on round date and hole number */
function estimateHoleTimestamp(roundCreatedAt: string, holeNumber: number): string {
  const base = new Date(roundCreatedAt)
  // Space holes ~15 minutes apart
  base.setMinutes(base.getMinutes() + (holeNumber - 1) * 15)
  return base.toISOString()
}

// ============================================================================
// MAIN FEED ACTION
// ============================================================================

export async function getTripFeedAction(
  tripId: string,
  maxEvents: number = 50
): Promise<{ events: FeedEvent[]; error?: string }> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { events: [], error: 'Not authenticated' }
  }

  try {
    // 1. Fetch all rounds for the trip
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, name, date, status, created_at')
      .eq('trip_id', tripId)
      .order('date', { ascending: true })

    if (roundsError) {
      return { events: [], error: roundsError.message }
    }

    if (!rounds || rounds.length === 0) {
      return { events: [] }
    }

    const allEvents: FeedEvent[] = []

    // 2. Process each round
    for (const round of rounds) {
      // Round started event
      if (round.status === 'in_progress' || round.status === 'completed') {
        allEvents.push({
          id: `round-started-${round.id}`,
          type: 'round_started',
          timestamp: round.created_at,
          roundId: round.id,
          roundName: round.name,
          narrative: `${round.name} is underway`,
          intensity: 'low',
        })
      }

      // Try to fetch match state for this round
      const matchResult = await getMatchStateAction(round.id)
      if (!matchResult.success || !matchResult.state) {
        // No match for this round — just add round events
        if (round.status === 'completed') {
          allEvents.push({
            id: `round-completed-${round.id}`,
            type: 'round_completed',
            timestamp: new Date(
              new Date(round.created_at).getTime() + 18 * 15 * 60 * 1000
            ).toISOString(),
            roundId: round.id,
            roundName: round.name,
            narrative: `${round.name} complete`,
            intensity: 'low',
          })
        }
        continue
      }

      const state = matchResult.state
      const teamA = teamLabel(state.teamA)
      const teamB = teamLabel(state.teamB)
      const players = allPlayerNames(state)

      // 3. Generate hole_result events from holeResults
      const completedHoles = state.holeResults.filter((r) => r.winner !== null)

      for (const result of completedHoles) {
        const holeTs = estimateHoleTimestamp(round.created_at, result.holeNumber)

        let narrative: string
        let intensity: FeedEvent['intensity'] = 'low'

        if (result.winner === 'team_a') {
          narrative = `${teamA} wins hole ${result.holeNumber}`
          intensity = 'medium'
        } else if (result.winner === 'team_b') {
          narrative = `${teamB} wins hole ${result.holeNumber}`
          intensity = 'medium'
        } else {
          narrative = `Hole ${result.holeNumber} halved`
          intensity = 'low'
        }

        // Add match state context
        const absLead = Math.abs(result.cumulativeLead)
        const holesRemaining = 18 - result.holeNumber
        if (result.cumulativeLead !== 0 && holesRemaining > 0) {
          const leader = result.cumulativeLead > 0 ? teamA : teamB
          narrative += ` — ${leader} ${absLead} UP with ${holesRemaining} to play`
        } else if (result.cumulativeLead === 0) {
          narrative += ' — All Square'
        }

        allEvents.push({
          id: `hole-${round.id}-${result.holeNumber}`,
          type: 'hole_result',
          timestamp: holeTs,
          roundId: round.id,
          roundName: round.name,
          holeNumber: result.holeNumber,
          players,
          narrative,
          intensity,
        })
      }

      // 4. Generate press events
      for (const press of state.presses) {
        const pressTs = estimateHoleTimestamp(round.created_at, press.startingHole)

        // Figure out who pressed (the trailing team)
        const holeBefore = completedHoles.find(
          (r) => r.holeNumber === press.startingHole - 1
        )
        const leadAtPress = holeBefore ? holeBefore.cumulativeLead : 0
        const pressingTeam =
          leadAtPress > 0 ? teamB : leadAtPress < 0 ? teamA : null

        const who = pressingTeam ? `${pressingTeam} presses` : 'Press activated'

        allEvents.push({
          id: `press-${round.id}-${press.pressNumber}`,
          type: 'press_added',
          timestamp: pressTs,
          roundId: round.id,
          roundName: round.name,
          holeNumber: press.startingHole,
          players,
          narrative: `${who} from hole ${press.startingHole}${press.endingHole < 18 ? ` →${press.endingHole}` : ''} — $${press.stakePerMan}/man`,
          intensity: 'medium',
        })
      }

      // 5. Use narrative engine for high-intensity events
      const teamANames = [state.teamA.player1.name]
      if (state.teamA.player2) teamANames.push(state.teamA.player2.name)
      const teamBNames = [state.teamB.player1.name]
      if (state.teamB.player2) teamBNames.push(state.teamB.player2.name)

      const narratives = generateNarratives(
        state.holeResults,
        state,
        teamANames,
        teamBNames
      )

      for (const narr of narratives) {
        // Map narrative type to feed event type
        let eventType: FeedEvent['type'] = 'match_status'
        if (narr.type === 'match_close') eventType = 'match_closed'
        if (narr.type === 'press') continue // Already handled above
        if (narr.type === 'momentum_shift') eventType = 'match_status'

        const narrTs = estimateHoleTimestamp(round.created_at, narr.hole)

        // Deduplicate: skip if we already have a narrative event at this hole
        const existingNarr = allEvents.find(
          (e) =>
            e.roundId === round.id &&
            e.type === eventType &&
            e.holeNumber === narr.hole
        )
        if (existingNarr) continue

        allEvents.push({
          id: `narr-${round.id}-${narr.type}-${narr.hole}`,
          type: eventType,
          timestamp: narrTs,
          roundId: round.id,
          roundName: round.name,
          holeNumber: narr.hole,
          players,
          narrative: narr.text,
          intensity: narr.intensity,
        })
      }

      // 6. Round completed event
      if (round.status === 'completed') {
        let completedNarrative = `${round.name} complete`
        if (state.isMatchClosed && state.winner && state.finalResult) {
          const winner = state.winner === 'team_a' ? teamA : teamB
          completedNarrative = `${round.name} final — ${winner} wins ${state.finalResult}`
        }

        allEvents.push({
          id: `round-completed-${round.id}`,
          type: 'round_completed',
          timestamp: new Date(
            new Date(round.created_at).getTime() + 18 * 15 * 60 * 1000
          ).toISOString(),
          roundId: round.id,
          roundName: round.name,
          players,
          narrative: completedNarrative,
          intensity: state.isMatchClosed ? 'high' : 'low',
        })
      }
    }

    // 7. Sort by timestamp DESC (most recent first)
    allEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // 8. Return max events
    return { events: allEvents.slice(0, maxEvents) }
  } catch (err) {
    console.error('Get trip feed error:', err)
    return {
      events: [],
      error: err instanceof Error ? err.message : 'Failed to load feed',
    }
  }
}
