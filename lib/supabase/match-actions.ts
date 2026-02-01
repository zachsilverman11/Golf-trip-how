'use server'

import { createClient, createAdminClient } from './server'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'
import { generatePressEvent } from './feed-actions'
import type {
  DbMatch,
  DbPress,
  DbMatchWithPresses,
  CreateMatchInput,
  AddPressInput,
  UpdateMatchStakesInput,
  MatchActionResult,
  PressActionResult,
  MatchStateResult,
  HoleMatchInfoResult,
  MatchState,
  TeamInfo,
  HoleMatchInfo,
} from './match-types'
import type { DbPlayer, DbHole, DbGroupPlayer } from './types'
import {
  computeHoleResults,
  computeMatchState,
  getHoleMatchInfo,
  buildScoreMap,
  buildHandicapMap,
} from '../match-utils'

// ============================================================================
// CREATE MATCH
// ============================================================================

export async function createMatchAction(input: CreateMatchInput): Promise<MatchActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate 2v2 has both players
  if (input.matchType === '2v2' && (!input.teamAPlayer2Id || !input.teamBPlayer2Id)) {
    return { success: false, error: '2v2 matches require 2 players per team' }
  }

  try {
    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        round_id: input.roundId,
        match_type: input.matchType,
        stake_per_man: input.stakePerMan,
        team_a_player1_id: input.teamAPlayer1Id,
        team_a_player2_id: input.teamAPlayer2Id || null,
        team_b_player1_id: input.teamBPlayer1Id,
        team_b_player2_id: input.teamBPlayer2Id || null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Create match error:', error)
      return { success: false, error: error.message }
    }

    // Get trip ID for revalidation
    const { data: round } = await supabase
      .from('rounds')
      .select('trip_id')
      .eq('id', input.roundId)
      .single()

    if (round) {
      revalidatePath(`/trip/${round.trip_id}`)
    }

    return { success: true, match }
  } catch (err) {
    console.error('Create match error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create match',
    }
  }
}

// ============================================================================
// GET MATCH FOR ROUND
// ============================================================================

export async function getMatchForRoundAction(roundId: string): Promise<{
  match: DbMatchWithPresses | null
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { match: null, error: 'Not authenticated' }
  }

  try {
    const { data: match, error } = await supabase
      .from('matches')
      .select(`
        *,
        presses (*)
      `)
      .eq('round_id', roundId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No match found - this is OK
        return { match: null }
      }
      console.error('Get match error:', error)
      return { match: null, error: error.message }
    }

    return { match: match as DbMatchWithPresses }
  } catch (err) {
    console.error('Get match error:', err)
    return {
      match: null,
      error: err instanceof Error ? err.message : 'Failed to load match',
    }
  }
}

// ============================================================================
// ADD PRESS
// ============================================================================

export async function addPressAction(input: AddPressInput): Promise<PressActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get the current match to copy stake
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('stake_per_man, round_id')
      .eq('id', input.matchId)
      .single()

    if (matchError || !match) {
      return { success: false, error: 'Match not found' }
    }

    const { data: press, error } = await supabase
      .from('presses')
      .insert({
        match_id: input.matchId,
        starting_hole: input.startingHole,
        ending_hole: input.endingHole || 18,
        stake_per_man: match.stake_per_man, // Copy current stake
      })
      .select('*')
      .single()

    if (error) {
      console.error('Add press error:', error)
      return { success: false, error: error.message }
    }

    // Generate feed event (fire and forget)
    const { data: round } = await supabase
      .from('rounds')
      .select('trip_id')
      .eq('id', match.round_id)
      .single()

    if (round) {
      generatePressEvent(
        round.trip_id,
        match.round_id,
        input.startingHole,
        input.endingHole || 18,
        match.stake_per_man
      ).catch(() => {})
    }

    return { success: true, press }
  } catch (err) {
    console.error('Add press error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add press',
    }
  }
}

// ============================================================================
// UPDATE MATCH STAKES
// ============================================================================

export async function updateMatchStakesAction(
  input: UpdateMatchStakesInput
): Promise<MatchActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { data: match, error } = await supabase
      .from('matches')
      .update({ stake_per_man: input.stakePerMan })
      .eq('id', input.matchId)
      .select('*')
      .single()

    if (error) {
      console.error('Update stakes error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, match }
  } catch (err) {
    console.error('Update stakes error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update stakes',
    }
  }
}

// ============================================================================
// SYNC MATCH STATE (Recompute from scores - idempotent)
// ============================================================================

export async function syncMatchStateAction(matchId: string): Promise<MatchActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get match with presses
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        presses (*)
      `)
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return { success: false, error: 'Match not found' }
    }

    // Get round with tees for hole data
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select(`
        *,
        tees (
          *,
          holes (*)
        ),
        groups (
          *,
          group_players (
            *,
            players (*)
          )
        )
      `)
      .eq('id', match.round_id)
      .single()

    if (roundError || !round) {
      return { success: false, error: 'Round not found' }
    }

    // Get all scores for this round
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .eq('round_id', match.round_id)

    if (scoresError) {
      return { success: false, error: scoresError.message }
    }

    // Build maps
    const scoreMap = buildScoreMap(scores || [])
    const allGroupPlayers = round.groups?.flatMap((g: any) => g.group_players || []) || []
    const handicapMap = buildHandicapMap(allGroupPlayers)

    // Get holes (default to 18 if no tee data)
    const holes = round.tees?.holes || generateDefaultHoles()

    // Compute hole results
    const holeResults = computeHoleResults(match as DbMatch, scoreMap, handicapMap, holes)

    // Get computed state
    const completedResults = holeResults.filter((r) => r.winner !== null)
    const holesPlayed = completedResults.length
    const currentLead = completedResults.length > 0
      ? completedResults[completedResults.length - 1].cumulativeLead
      : 0
    const holesRemaining = 18 - holesPlayed
    const isMatchClosed = Math.abs(currentLead) > holesRemaining

    // Determine status
    let status = match.status
    let winner = match.winner
    let finalResult = match.final_result

    if (isMatchClosed && status !== 'completed') {
      status = 'completed'
      winner = currentLead > 0 ? 'team_a' : 'team_b'
      finalResult = formatFinalResult(currentLead, holesRemaining)
    } else if (holesRemaining === 0 && status !== 'completed') {
      status = 'completed'
      if (currentLead === 0) {
        winner = 'halved'
        finalResult = 'A/S'
      } else {
        winner = currentLead > 0 ? 'team_a' : 'team_b'
        finalResult = `${Math.abs(currentLead)} UP`
      }
    }

    // Update match
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({
        status,
        winner,
        final_result: finalResult,
        current_lead: currentLead,
        holes_played: holesPlayed,
      })
      .eq('id', matchId)
      .select('*')
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Update presses
    for (const press of match.presses || []) {
      const pressEndingHole = press.ending_hole ?? 18
      const pressResults = holeResults.filter(
        (r) => r.holeNumber >= press.starting_hole && r.holeNumber <= pressEndingHole
      )
      const completedPressResults = pressResults.filter((r) => r.winner !== null)

      let pressLead = 0
      for (const r of completedPressResults) {
        if (r.winner === 'team_a') pressLead += 1
        else if (r.winner === 'team_b') pressLead -= 1
      }

      const pressHolesPlayed = completedPressResults.length
      const pressHolesRemaining = pressEndingHole - press.starting_hole + 1 - pressHolesPlayed
      const isPressClosed = Math.abs(pressLead) > pressHolesRemaining

      let pressStatus = press.status
      let pressWinner = press.winner
      let pressFinalResult = press.final_result

      if (isPressClosed && pressStatus !== 'completed') {
        pressStatus = 'completed'
        pressWinner = pressLead > 0 ? 'team_a' : 'team_b'
        pressFinalResult = formatFinalResult(pressLead, pressHolesRemaining)
      } else if (pressHolesRemaining === 0 && pressStatus !== 'completed') {
        pressStatus = 'completed'
        if (pressLead === 0) {
          pressWinner = 'halved'
          pressFinalResult = 'A/S'
        } else {
          pressWinner = pressLead > 0 ? 'team_a' : 'team_b'
          pressFinalResult = `${Math.abs(pressLead)} UP`
        }
      }

      await supabase
        .from('presses')
        .update({
          status: pressStatus,
          winner: pressWinner,
          final_result: pressFinalResult,
          current_lead: pressLead,
          holes_played: pressHolesPlayed,
        })
        .eq('id', press.id)
    }

    return { success: true, match: updatedMatch }
  } catch (err) {
    console.error('Sync match state error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to sync match state',
    }
  }
}

// ============================================================================
// GET FULL MATCH STATE (For UI)
// ============================================================================

export async function getMatchStateAction(roundId: string): Promise<MatchStateResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get match with presses
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        presses (*)
      `)
      .eq('round_id', roundId)
      .single()

    if (matchError) {
      if (matchError.code === 'PGRST116') {
        return { success: false, error: 'No match found for this round' }
      }
      return { success: false, error: matchError.message }
    }

    // Get round with tees and groups
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select(`
        *,
        tees (
          *,
          holes (*)
        ),
        groups (
          *,
          group_players (
            *,
            players (*)
          )
        )
      `)
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      return { success: false, error: 'Round not found' }
    }

    // Get scores
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .eq('round_id', roundId)

    if (scoresError) {
      return { success: false, error: scoresError.message }
    }

    // Build team info
    const allGroupPlayers = round.groups?.flatMap((g: any) => g.group_players || []) || []
    const playersMap: Record<string, DbPlayer> = {}
    const handicapsMap: Record<string, number> = {}

    for (const gp of allGroupPlayers) {
      const player = (gp as any).players
      if (player) {
        playersMap[player.id] = player
        handicapsMap[player.id] = gp.playing_handicap ?? 0
      }
    }

    const teamA: TeamInfo = {
      player1: playersMap[match.team_a_player1_id],
      player2: match.team_a_player2_id ? playersMap[match.team_a_player2_id] : null,
      player1Handicap: handicapsMap[match.team_a_player1_id] ?? 0,
      player2Handicap: match.team_a_player2_id ? handicapsMap[match.team_a_player2_id] ?? 0 : null,
    }

    const teamB: TeamInfo = {
      player1: playersMap[match.team_b_player1_id],
      player2: match.team_b_player2_id ? playersMap[match.team_b_player2_id] : null,
      player1Handicap: handicapsMap[match.team_b_player1_id] ?? 0,
      player2Handicap: match.team_b_player2_id ? handicapsMap[match.team_b_player2_id] ?? 0 : null,
    }

    // Compute hole results
    const scoreMap = buildScoreMap(scores || [])
    const holes = round.tees?.holes || generateDefaultHoles()
    const holeResults = computeHoleResults(match as DbMatch, scoreMap, handicapsMap, holes)

    // Compute full state
    const state = computeMatchState(
      match as DbMatch,
      match.presses || [],
      holeResults,
      teamA,
      teamB,
      18
    )

    return { success: true, state }
  } catch (err) {
    console.error('Get match state error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load match state',
    }
  }
}

// ============================================================================
// GET HOLE MATCH INFO (For scoring screen hero element)
// ============================================================================

export async function getHoleMatchInfoAction(
  roundId: string,
  currentHole: number
): Promise<HoleMatchInfoResult> {
  const result = await getMatchStateAction(roundId)

  if (!result.success || !result.state) {
    return { success: false, error: result.error || 'No match state' }
  }

  const info = getHoleMatchInfo(result.state, currentHole)
  return { success: true, info }
}

// ============================================================================
// GET MATCHES FOR TRIP (For matches tab)
// ============================================================================

export interface TripMatchSummary {
  matchId: string
  roundId: string
  roundName: string
  roundDate: string
  matchType: string
  stakePerMan: number
  status: string
  winner: string | null
  finalResult: string | null
  currentLead: number
  holesPlayed: number
  teamANames: string
  teamBNames: string
  pressCount: number
}

export async function getMatchesForTripAction(tripId: string): Promise<{
  matches: TripMatchSummary[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { matches: [], error: 'Not authenticated' }
  }

  try {
    // Get all rounds for the trip that have matches
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        id,
        name,
        date,
        matches (
          *,
          presses (id)
        )
      `)
      .eq('trip_id', tripId)
      .order('date', { ascending: false })

    if (roundsError) {
      return { matches: [], error: roundsError.message }
    }

    const matchSummaries: TripMatchSummary[] = []

    for (const round of rounds || []) {
      const match = (round as any).matches?.[0]
      if (!match) continue

      // Get player names
      const playerIds = [
        match.team_a_player1_id,
        match.team_a_player2_id,
        match.team_b_player1_id,
        match.team_b_player2_id,
      ].filter(Boolean)

      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .in('id', playerIds)

      const playerNames: Record<string, string> = {}
      for (const p of players || []) {
        playerNames[p.id] = p.name
      }

      const teamANames = [
        playerNames[match.team_a_player1_id],
        match.team_a_player2_id ? playerNames[match.team_a_player2_id] : null,
      ]
        .filter(Boolean)
        .join('/')

      const teamBNames = [
        playerNames[match.team_b_player1_id],
        match.team_b_player2_id ? playerNames[match.team_b_player2_id] : null,
      ]
        .filter(Boolean)
        .join('/')

      matchSummaries.push({
        matchId: match.id,
        roundId: round.id,
        roundName: round.name,
        roundDate: round.date,
        matchType: match.match_type,
        stakePerMan: match.stake_per_man,
        status: match.status,
        winner: match.winner,
        finalResult: match.final_result,
        currentLead: match.current_lead,
        holesPlayed: match.holes_played,
        teamANames,
        teamBNames,
        pressCount: match.presses?.length || 0,
      })
    }

    // Also get Nassau bets for this trip
    try {
      const { data: nassauRounds } = await supabase
        .from('rounds')
        .select(`
          id,
          name,
          date,
          status,
          nassau_bets (
            id,
            stake_per_man,
            auto_press,
            team_a_player1_id,
            team_a_player2_id,
            team_b_player1_id,
            team_b_player2_id
          )
        `)
        .eq('trip_id', tripId)
        .eq('format', 'nassau')
        .order('date', { ascending: false })

      for (const round of nassauRounds || []) {
        const nassau = (round as any).nassau_bets?.[0]
        if (!nassau) continue

        const playerIds = [
          nassau.team_a_player1_id,
          nassau.team_a_player2_id,
          nassau.team_b_player1_id,
          nassau.team_b_player2_id,
        ].filter(Boolean)

        const { data: players } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds)

        const playerNames: Record<string, string> = {}
        for (const p of players || []) {
          playerNames[p.id] = p.name
        }

        const teamANames = [
          playerNames[nassau.team_a_player1_id],
          nassau.team_a_player2_id ? playerNames[nassau.team_a_player2_id] : null,
        ].filter(Boolean).join('/')

        const teamBNames = [
          playerNames[nassau.team_b_player1_id],
          nassau.team_b_player2_id ? playerNames[nassau.team_b_player2_id] : null,
        ].filter(Boolean).join('/')

        matchSummaries.push({
          matchId: nassau.id,
          roundId: round.id,
          roundName: round.name,
          roundDate: round.date,
          matchType: 'nassau',
          stakePerMan: nassau.stake_per_man,
          status: round.status === 'completed' ? 'completed' : 'in_progress',
          winner: null,
          finalResult: null,
          currentLead: 0,
          holesPlayed: 0,
          teamANames,
          teamBNames,
          pressCount: nassau.auto_press ? 1 : 0,
        })
      }
    } catch {
      // Nassau table might not exist yet — silently continue
    }

    // Also get Skins bets
    try {
      const { data: skinsRounds } = await supabase
        .from('rounds')
        .select(`
          id,
          name,
          date,
          status,
          skins_bets (
            id,
            stake_per_skin
          )
        `)
        .eq('trip_id', tripId)
        .eq('format', 'skins')
        .order('date', { ascending: false })

      for (const round of skinsRounds || []) {
        const skins = (round as any).skins_bets?.[0]
        if (!skins) continue

        matchSummaries.push({
          matchId: skins.id,
          roundId: round.id,
          roundName: round.name,
          roundDate: round.date,
          matchType: 'skins',
          stakePerMan: skins.stake_per_skin,
          status: round.status === 'completed' ? 'completed' : 'in_progress',
          winner: null,
          finalResult: null,
          currentLead: 0,
          holesPlayed: 0,
          teamANames: 'All Players',
          teamBNames: '',
          pressCount: 0,
        })
      }
    } catch {
      // Skins table might not exist yet
    }

    return { matches: matchSummaries }
  } catch (err) {
    console.error('Get matches for trip error:', err)
    return {
      matches: [],
      error: err instanceof Error ? err.message : 'Failed to load matches',
    }
  }
}

// ============================================================================
// SPECTATOR: GET MATCH BY TOKEN
// ============================================================================

export async function getSpectatorMatchAction(
  token: string,
  roundId?: string
): Promise<{
  match: DbMatchWithPresses | null
  teamANames: string
  teamBNames: string
  error?: string
}> {
  const adminClient = createAdminClient()

  try {
    // Use the RPC function for spectator access
    const { data, error } = await adminClient.rpc('get_match_by_spectator_token', {
      p_token: token,
      p_round_id: roundId || null,
    })

    if (error) {
      console.error('Spectator match error:', error)
      return { match: null, teamANames: '', teamBNames: '', error: error.message }
    }

    if (!data || data.length === 0) {
      return { match: null, teamANames: '', teamBNames: '' }
    }

    const matchData = data[0]

    // Get presses for the match
    const { data: presses } = await adminClient
      .from('presses')
      .select('*')
      .eq('match_id', matchData.match_id)
      .order('starting_hole')

    const match: DbMatchWithPresses = {
      id: matchData.match_id,
      round_id: matchData.round_id,
      match_type: matchData.match_type,
      stake_per_man: matchData.stake_per_man,
      team_a_player1_id: matchData.team_a_player1_id,
      team_a_player2_id: matchData.team_a_player2_id,
      team_b_player1_id: matchData.team_b_player1_id,
      team_b_player2_id: matchData.team_b_player2_id,
      status: matchData.status,
      winner: matchData.winner,
      final_result: matchData.final_result,
      current_lead: matchData.current_lead,
      holes_played: matchData.holes_played,
      created_at: '',
      updated_at: '',
      presses: presses || [],
    }

    const teamANames = [
      matchData.team_a_player1_name,
      matchData.team_a_player2_name,
    ]
      .filter(Boolean)
      .join('/')

    const teamBNames = [
      matchData.team_b_player1_name,
      matchData.team_b_player2_name,
    ]
      .filter(Boolean)
      .join('/')

    return { match, teamANames, teamBNames }
  } catch (err) {
    console.error('Spectator match error:', err)
    return {
      match: null,
      teamANames: '',
      teamBNames: '',
      error: err instanceof Error ? err.message : 'Failed to load match',
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatFinalResult(lead: number, holesRemaining: number): string {
  const absLead = Math.abs(lead)
  if (holesRemaining > 0) {
    return `${absLead}&${holesRemaining}`
  }
  return `${absLead} UP`
}

function generateDefaultHoles(): DbHole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    id: `default-${i + 1}`,
    tee_id: 'default',
    hole_number: i + 1,
    par: 4,
    stroke_index: i + 1,
    yards: null,
    created_at: '',
  }))
}

// ============================================================================
// TRIP MONEY TOTALS (For settle tab)
// ============================================================================

export interface PlayerMoneyTotal {
  playerId: string
  playerName: string
  totalWinnings: number // Positive = won, negative = lost (per man)
  matchResults: {
    roundName: string
    amount: number
    description: string // e.g., "Won 2&1" or "Press 1: Lost 3 UP"
  }[]
}

export interface TripMoneyResult {
  success: boolean
  playerTotals: PlayerMoneyTotal[]
  error?: string
}

/**
 * Calculate trip-wide money totals for all players.
 * All values are PER MAN - in a 2v2, each player on the winning side gets the amount,
 * and each player on the losing side loses the amount.
 */
export async function getTripMoneyTotalsAction(tripId: string): Promise<TripMoneyResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, playerTotals: [], error: 'Not authenticated' }
  }

  try {
    // Get all completed matches for the trip with presses
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        id,
        name,
        matches (
          *,
          presses (*)
        )
      `)
      .eq('trip_id', tripId)
      .order('date')

    if (roundsError) {
      return { success: false, playerTotals: [], error: roundsError.message }
    }

    // Collect all player IDs we need names for
    const playerIds = new Set<string>()
    const playerTotals: Record<string, { winnings: number; results: PlayerMoneyTotal['matchResults'] }> = {}

    for (const round of rounds || []) {
      const match = (round as any).matches?.[0]
      if (!match || match.status !== 'completed') continue

      // Collect player IDs
      const teamAIds = [match.team_a_player1_id, match.team_a_player2_id].filter(Boolean)
      const teamBIds = [match.team_b_player1_id, match.team_b_player2_id].filter(Boolean)
      teamAIds.forEach(id => playerIds.add(id))
      teamBIds.forEach(id => playerIds.add(id))

      // Initialize player totals if needed
      for (const id of [...teamAIds, ...teamBIds]) {
        if (!playerTotals[id]) {
          playerTotals[id] = { winnings: 0, results: [] }
        }
      }

      // Calculate main match result
      // lead > 0 means Team A won by that many holes
      // lead < 0 means Team B won by that many holes
      const mainMatchAmount = Math.abs(match.current_lead) * match.stake_per_man

      if (match.winner === 'team_a') {
        // Team A won: each Team A player gets +amount, each Team B player gets -amount
        for (const id of teamAIds) {
          playerTotals[id].winnings += mainMatchAmount
          playerTotals[id].results.push({
            roundName: round.name,
            amount: mainMatchAmount,
            description: `Main: Won ${match.final_result}`,
          })
        }
        for (const id of teamBIds) {
          playerTotals[id].winnings -= mainMatchAmount
          playerTotals[id].results.push({
            roundName: round.name,
            amount: -mainMatchAmount,
            description: `Main: Lost ${match.final_result}`,
          })
        }
      } else if (match.winner === 'team_b') {
        // Team B won
        for (const id of teamAIds) {
          playerTotals[id].winnings -= mainMatchAmount
          playerTotals[id].results.push({
            roundName: round.name,
            amount: -mainMatchAmount,
            description: `Main: Lost ${match.final_result}`,
          })
        }
        for (const id of teamBIds) {
          playerTotals[id].winnings += mainMatchAmount
          playerTotals[id].results.push({
            roundName: round.name,
            amount: mainMatchAmount,
            description: `Main: Won ${match.final_result}`,
          })
        }
      }
      // If halved, no money changes hands

      // Process completed presses
      const presses = (match.presses || []) as DbPress[]
      presses.forEach((press: DbPress, pressIndex: number) => {
        if (press.status !== 'completed') return

        const pressNumber = pressIndex + 1
        const pressAmount = Math.abs(press.current_lead) * press.stake_per_man

        if (press.winner === 'team_a') {
          for (const id of teamAIds) {
            playerTotals[id].winnings += pressAmount
            playerTotals[id].results.push({
              roundName: round.name,
              amount: pressAmount,
              description: `Press ${pressNumber}: Won ${press.final_result}`,
            })
          }
          for (const id of teamBIds) {
            playerTotals[id].winnings -= pressAmount
            playerTotals[id].results.push({
              roundName: round.name,
              amount: -pressAmount,
              description: `Press ${pressNumber}: Lost ${press.final_result}`,
            })
          }
        } else if (press.winner === 'team_b') {
          for (const id of teamAIds) {
            playerTotals[id].winnings -= pressAmount
            playerTotals[id].results.push({
              roundName: round.name,
              amount: -pressAmount,
              description: `Press ${pressNumber}: Lost ${press.final_result}`,
            })
          }
          for (const id of teamBIds) {
            playerTotals[id].winnings += pressAmount
            playerTotals[id].results.push({
              roundName: round.name,
              amount: pressAmount,
              description: `Press ${pressNumber}: Won ${press.final_result}`,
            })
          }
        }
      })
    }

    // Also include Nassau bet settlements
    try {
      const { data: nassauRounds } = await supabase
        .from('rounds')
        .select(`
          id,
          name,
          nassau_bets (
            id,
            stake_per_man,
            team_a_player1_id,
            team_a_player2_id,
            team_b_player1_id,
            team_b_player2_id
          )
        `)
        .eq('trip_id', tripId)
        .eq('format', 'nassau')

      for (const round of nassauRounds || []) {
        const nassau = (round as any).nassau_bets?.[0]
        if (!nassau) continue

        const teamAIds = [nassau.team_a_player1_id, nassau.team_a_player2_id].filter(Boolean) as string[]
        const teamBIds = [nassau.team_b_player1_id, nassau.team_b_player2_id].filter(Boolean) as string[]

        // Add all player IDs
        teamAIds.forEach(id => playerIds.add(id))
        teamBIds.forEach(id => playerIds.add(id))
        for (const id of [...teamAIds, ...teamBIds]) {
          if (!playerTotals[id]) {
            playerTotals[id] = { winnings: 0, results: [] }
          }
        }

        // Get nassau state to compute settlement
        const { getNassauStateAction } = await import('./nassau-actions')
        const nassauResult = await getNassauStateAction(round.id)
        if (!nassauResult.nassauState) continue

        const ns = nassauResult.nassauState
        const stake = ns.stakePerMan

        // Each sub-match: if lead > 0, Team A wins; if lead < 0, Team B wins; 0 = halved
        const subMatches = [
          { label: 'Front 9', lead: ns.front.lead },
          { label: 'Back 9', lead: ns.back.lead },
          { label: 'Overall', lead: ns.overall.lead },
        ]

        for (const sub of subMatches) {
          if (sub.lead === 0) continue // halved, no money

          const winnerIds = sub.lead > 0 ? teamAIds : teamBIds
          const loserIds = sub.lead > 0 ? teamBIds : teamAIds

          for (const id of winnerIds) {
            playerTotals[id].winnings += stake
            playerTotals[id].results.push({
              roundName: round.name,
              amount: stake,
              description: `Nassau ${sub.label}: Won`,
            })
          }
          for (const id of loserIds) {
            playerTotals[id].winnings -= stake
            playerTotals[id].results.push({
              roundName: round.name,
              amount: -stake,
              description: `Nassau ${sub.label}: Lost`,
            })
          }
        }
      }
    } catch {
      // Nassau tables may not exist yet — silently continue
    }

    // Fetch player names
    const playerIdArray = Array.from(playerIds)
    if (playerIdArray.length === 0) {
      return { success: true, playerTotals: [] }
    }

    const { data: players } = await supabase
      .from('players')
      .select('id, name')
      .in('id', playerIdArray)

    const playerNames: Record<string, string> = {}
    for (const p of players || []) {
      playerNames[p.id] = p.name
    }

    // Build final result sorted by total winnings (highest first)
    const result: PlayerMoneyTotal[] = playerIdArray
      .map(id => ({
        playerId: id,
        playerName: playerNames[id] || 'Unknown',
        totalWinnings: playerTotals[id]?.winnings || 0,
        matchResults: playerTotals[id]?.results || [],
      }))
      .sort((a, b) => b.totalWinnings - a.totalWinnings)

    return { success: true, playerTotals: result }
  } catch (err) {
    console.error('Get trip money totals error:', err)
    return {
      success: false,
      playerTotals: [],
      error: err instanceof Error ? err.message : 'Failed to calculate money totals',
    }
  }
}
