'use server'

import { createClient } from './server'
import type { DbTrip, DbTripWithMembers, DbTripWithCounts, DbTripInsert, DbTripMember, DbRoundSummary } from './types'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Types
// ============================================================================

export interface CreateTripInput {
  name: string
  description?: string
  start_date?: string
  end_date?: string
}

export interface UpdateTripInput {
  name?: string
  description?: string
  start_date?: string
  end_date?: string
}

export interface TripActionResult {
  success: boolean
  tripId?: string
  error?: string
}

// ============================================================================
// Create Trip
// ============================================================================

export async function createTripAction(input: CreateTripInput): Promise<TripActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Create the trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        name: input.name,
        description: input.description || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (tripError) {
      console.error('Trip insert error:', tripError)
      return { success: false, error: tripError.message }
    }

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) {
      console.error('Member insert error:', memberError)
      // Still return success since trip was created
    }

    revalidatePath('/trips')
    return { success: true, tripId: trip.id }
  } catch (err) {
    console.error('Create trip error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create trip',
    }
  }
}

// ============================================================================
// Get User's Trips
// ============================================================================

export async function getTripsAction(): Promise<{
  trips: DbTripWithMembers[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { trips: [], error: 'Not authenticated' }
  }

  try {
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members!inner (*)
      `)
      .eq('trip_members.user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get trips error:', error)
      return { trips: [], error: error.message }
    }

    return { trips: trips as DbTripWithMembers[] }
  } catch (err) {
    console.error('Get trips error:', err)
    return {
      trips: [],
      error: err instanceof Error ? err.message : 'Failed to load trips',
    }
  }
}

// ============================================================================
// Get Single Trip
// ============================================================================

export async function getTripAction(tripId: string): Promise<{
  trip?: DbTripWithCounts
  userRole?: 'admin' | 'member'
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    // Fetch trip with members, player count, and minimal round data
    const { data: trip, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members (*),
        players (id),
        rounds (id, name, date, tee_time, status, format)
      `)
      .eq('id', tripId)
      .single()

    if (error) {
      console.error('Get trip error:', error)
      return { error: error.message }
    }

    // Check if user is a member
    const membership = trip.trip_members?.find((m: DbTripMember) => m.user_id === user.id)
    if (!membership) {
      return { error: 'Not a member of this trip' }
    }

    // Extract counts and minimal round data
    const players = trip.players as { id: string }[] | null
    const rounds = trip.rounds as DbRoundSummary[] | null
    const playerCount = players?.length || 0
    const roundCount = rounds?.length || 0

    // Get recent rounds (sorted by date desc, limit 5)
    const recentRounds = (rounds || [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)

    // Remove the raw arrays and add computed fields
    const { players: _p, rounds: _r, ...tripBase } = trip

    return {
      trip: {
        ...tripBase,
        trip_members: trip.trip_members,
        playerCount,
        roundCount,
        recentRounds,
      } as DbTripWithCounts,
      userRole: membership.role,
    }
  } catch (err) {
    console.error('Get trip error:', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to load trip',
    }
  }
}

// ============================================================================
// Update Trip
// ============================================================================

export async function updateTripAction(
  tripId: string,
  input: UpdateTripInput
): Promise<TripActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('trips')
      .update({
        name: input.name,
        description: input.description,
        start_date: input.start_date,
        end_date: input.end_date,
      })
      .eq('id', tripId)

    if (error) {
      console.error('Update trip error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true, tripId }
  } catch (err) {
    console.error('Update trip error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update trip',
    }
  }
}

// ============================================================================
// Delete Trip
// ============================================================================

export async function deleteTripAction(tripId: string): Promise<TripActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId)

    if (error) {
      console.error('Delete trip error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/trips')
    return { success: true }
  } catch (err) {
    console.error('Delete trip error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete trip',
    }
  }
}

// ============================================================================
// Add Member to Trip
// ============================================================================

export async function addTripMemberAction(
  tripId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<TripActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Look up user by email
    // Note: This requires a lookup - in production you might want to use invites
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      // For now, just return error - in production, send invite
      return { success: false, error: 'User not found. They need to sign up first.' }
    }

    const { error } = await supabase
      .from('trip_members')
      .insert({
        trip_id: tripId,
        user_id: userData.id,
        role,
      })

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'User is already a member' }
      }
      console.error('Add member error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true }
  } catch (err) {
    console.error('Add member error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add member',
    }
  }
}

// ============================================================================
// Remove Member from Trip
// ============================================================================

export async function removeTripMemberAction(
  tripId: string,
  memberId: string
): Promise<TripActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      console.error('Remove member error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true }
  } catch (err) {
    console.error('Remove member error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove member',
    }
  }
}

// ============================================================================
// Regenerate Spectator Token
// ============================================================================

export async function regenerateSpectatorTokenAction(tripId: string): Promise<{
  success: boolean
  token?: string
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Generate new token using raw SQL for crypto function
    const { data, error } = await supabase.rpc('gen_random_uuid')

    if (error) {
      // Fallback to JS-generated token
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const { error: updateError } = await supabase
        .from('trips')
        .update({ spectator_token: token })
        .eq('id', tripId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      revalidatePath(`/trip/${tripId}`)
      return { success: true, token }
    }

    // Use the UUID without hyphens as token
    const token = (data as string).replace(/-/g, '')

    const { error: updateError } = await supabase
      .from('trips')
      .update({ spectator_token: token })
      .eq('id', tripId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath(`/trip/${tripId}`)
    return { success: true, token }
  } catch (err) {
    console.error('Regenerate token error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to regenerate token',
    }
  }
}
