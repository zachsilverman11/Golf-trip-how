/**
 * Narrative Engine for Match Play Drama
 *
 * Generates punchy, contextual text from score data for mobile display.
 * Returns max 3 narratives sorted by importance (high → low) then recency.
 */

import { ComputedHoleResult, MatchState } from './supabase/match-types'

// ============================================================================
// TYPES
// ============================================================================

export interface NarrativeEvent {
  hole: number
  text: string
  type: 'momentum_shift' | 'press' | 'dramatic_hole' | 'match_close' | 'status_update'
  intensity: 'low' | 'medium' | 'high'
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract first name from a full name */
function firstName(name: string): string {
  return name.split(' ')[0]
}

/** Format team label: "Zach" for 1v1, "Zach & Dave" for 2v2 */
function teamLabel(names: string[]): string {
  const firsts = names.map(firstName)
  return firsts.length > 1 ? `${firsts[0]} & ${firsts[1]}` : firsts[0]
}

// ============================================================================
// NARRATIVE GENERATOR
// ============================================================================

export function generateNarratives(
  holeResults: ComputedHoleResult[],
  matchState: MatchState,
  teamANames: string[],
  teamBNames: string[],
): NarrativeEvent[] {
  const teamA = teamLabel(teamANames)
  const teamB = teamLabel(teamBNames)

  // Only completed holes, sorted ascending by hole number
  const completed = holeResults
    .filter((r) => r.winner !== null)
    .sort((a, b) => a.holeNumber - b.holeNumber)

  if (completed.length === 0) return []

  const latest = completed[completed.length - 1]
  const candidates: NarrativeEvent[] = []

  // ── HIGH INTENSITY ──────────────────────────────────────────────

  // Match closing — the match is won
  if (matchState.isMatchClosed && matchState.winner) {
    const winner = matchState.winner === 'team_a' ? teamA : teamB
    candidates.push({
      hole: latest.holeNumber,
      text: `It's over! ${winner} wins ${matchState.finalResult}`,
      type: 'match_close',
      intensity: 'high',
    })
  }

  // Dormie — match can be closed on the next hole
  if (matchState.isDormie && !matchState.isMatchClosed) {
    const trailing = matchState.currentLead > 0 ? teamB : teamA
    const nextHole = latest.holeNumber + 1

    candidates.push({
      hole: latest.holeNumber,
      text:
        matchState.holesRemaining === 1
          ? `DORMIE — ${trailing} must win ${nextHole} to stay alive`
          : `DORMIE — ${trailing} must win out to survive (${matchState.holesRemaining} to play)`,
      type: 'status_update',
      intensity: 'high',
    })
  }

  // Momentum shift — most recent lead direction change
  for (let i = completed.length - 1; i >= 0; i--) {
    const curr = completed[i]
    const prevLead = i > 0 ? completed[i - 1].cumulativeLead : 0
    const currLead = curr.cumulativeLead

    // Same direction → no shift, keep scanning backward
    if (Math.sign(prevLead) === Math.sign(currLead)) continue

    // Lead flipped between teams
    if ((prevLead > 0 && currLead < 0) || (prevLead < 0 && currLead > 0)) {
      const newLeader = currLead > 0 ? teamA : teamB
      candidates.push({
        hole: curr.holeNumber,
        text: `${newLeader} takes the lead on ${curr.holeNumber} — match flipped!`,
        type: 'momentum_shift',
        intensity: 'high',
      })
      break
    }

    // Back to All Square from a lead
    if (prevLead !== 0 && currLead === 0) {
      candidates.push({
        hole: curr.holeNumber,
        text: `Back to All Square after ${curr.holeNumber}`,
        type: 'momentum_shift',
        intensity: 'high',
      })
      break
    }

    // Taking lead from All Square
    if (prevLead === 0 && currLead !== 0) {
      const newLeader = currLead > 0 ? teamA : teamB
      const hasLedBefore = completed
        .slice(0, i)
        .some((r) => (currLead > 0 ? r.cumulativeLead > 0 : r.cumulativeLead < 0))

      candidates.push({
        hole: curr.holeNumber,
        text: hasLedBefore
          ? `${newLeader} retakes the lead after ${curr.holeNumber}`
          : `${newLeader} leads for the first time after ${curr.holeNumber}`,
        type: 'momentum_shift',
        intensity: 'high',
      })
      break
    }

    break
  }

  // ── MEDIUM INTENSITY ────────────────────────────────────────────

  // Presses — most recent first
  const sortedPresses = [...matchState.presses].sort(
    (a, b) => b.startingHole - a.startingHole
  )

  for (const press of sortedPresses) {
    // Only include presses that are relevant to completed play
    if (press.startingHole > latest.holeNumber + 1) continue

    // Determine who pressed (the trailing team at press start)
    const holeBefore = completed.find(
      (r) => r.holeNumber === press.startingHole - 1
    )
    const leadAtPress = holeBefore ? holeBefore.cumulativeLead : 0
    const pressingTeam =
      leadAtPress > 0 ? teamB : leadAtPress < 0 ? teamA : null

    // Total active bets at this press's starting hole (main + all presses up to this one)
    const activeBets =
      1 +
      matchState.presses.filter((p) => p.startingHole <= press.startingHole)
        .length
    const totalPerHole = activeBets * matchState.stakePerMan

    const who = pressingTeam
      ? `${pressingTeam} doubles down`
      : 'New bet'

    candidates.push({
      hole: press.startingHole,
      text: `Press! ${who} from hole ${press.startingHole} — $${totalPerHole}/hole per man`,
      type: 'press',
      intensity: 'medium',
    })
  }

  // Winning streaks — 3+ consecutive holes won by the same team
  let streakTeam: 'team_a' | 'team_b' | null = null
  let streakCount = 0

  for (let i = completed.length - 1; i >= 0; i--) {
    const r = completed[i]

    // Ensure hole numbers are actually consecutive
    if (
      i < completed.length - 1 &&
      completed[i + 1].holeNumber - r.holeNumber !== 1
    ) {
      break
    }

    if (r.winner === 'team_a' || r.winner === 'team_b') {
      if (!streakTeam) {
        streakTeam = r.winner
        streakCount = 1
      } else if (r.winner === streakTeam) {
        streakCount++
      } else {
        break
      }
    } else {
      break // halved breaks the streak
    }
  }

  if (streakCount >= 3 && streakTeam) {
    candidates.push({
      hole: latest.holeNumber,
      text: `${streakTeam === 'team_a' ? teamA : teamB} has won ${streakCount} straight — they're rolling`,
      type: 'status_update',
      intensity: 'medium',
    })
  }

  // Dramatic holes — most recent hole won by a single stroke net
  for (let i = completed.length - 1; i >= 0; i--) {
    const r = completed[i]
    if (
      r.teamANetScore !== null &&
      r.teamBNetScore !== null &&
      r.winner !== 'halved' &&
      r.winner !== null
    ) {
      const margin = Math.abs(r.teamANetScore - r.teamBNetScore)
      if (margin === 1) {
        const winnerLabel = r.winner === 'team_a' ? teamA : teamB
        candidates.push({
          hole: r.holeNumber,
          text: `A tight one on ${r.holeNumber} — ${winnerLabel} takes it by a stroke`,
          type: 'dramatic_hole',
          intensity: 'medium',
        })
        break // only the most recent one
      }
    }
  }

  // ── LOW INTENSITY ───────────────────────────────────────────────

  // All Square status
  if (matchState.currentLead === 0 && !matchState.isMatchClosed) {
    // Skip if we already have a "Back to All Square" momentum shift
    const hasBackToAS = candidates.some(
      (n) => n.type === 'momentum_shift' && n.text.includes('All Square')
    )
    if (!hasBackToAS) {
      candidates.push({
        hole: latest.holeNumber,
        text: `All Square through ${latest.holeNumber}`,
        type: 'status_update',
        intensity: 'low',
      })
    }
  }

  // ── SORT & RETURN TOP 3 ────────────────────────────────────────

  const intensityRank: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  candidates.sort((a, b) => {
    const d = intensityRank[a.intensity] - intensityRank[b.intensity]
    return d !== 0 ? d : b.hole - a.hole
  })

  return candidates.slice(0, 3)
}
