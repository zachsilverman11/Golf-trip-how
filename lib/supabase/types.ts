/**
 * Database types for Supabase tables
 */

// ============================================================================
// COURSE TYPES
// ============================================================================

export interface DbCourse {
  id: string
  name: string                      // Course name (e.g., "Pacific Dunes")
  club_name: string | null          // Facility/resort name (e.g., "Bandon Dunes")
  location: string | null
  country: 'US' | 'CA' | 'other'
  external_provider: string | null  // e.g., 'golfcourseapi'
  external_id: string | null        // provider's course ID
  created_at: string
  updated_at: string
}

export interface DbTee {
  id: string
  course_id: string
  name: string
  color: string | null
  rating: number
  slope: number
  par: number
  yards: number | null
  gender: 'male' | 'female' | 'unisex'
  created_at: string
  updated_at: string
}

export interface DbHole {
  id: string
  tee_id: string
  hole_number: number  // 1-18
  par: number          // 3, 4, or 5
  stroke_index: number // 1-18, 0 if unknown
  yards: number | null
  created_at: string
}

// Insert types (without generated fields)
export type DbCourseInsert = Omit<DbCourse, 'id' | 'created_at' | 'updated_at'>
export type DbTeeInsert = Omit<DbTee, 'id' | 'created_at' | 'updated_at'>
export type DbHoleInsert = Omit<DbHole, 'id' | 'created_at'>

// Join types for queries
export interface DbTeeWithHoles extends DbTee {
  holes: DbHole[]
}

export interface DbCourseWithTees extends DbCourse {
  tees: DbTeeWithHoles[]
}

// ============================================================================
// TRIP TYPES
// ============================================================================

export interface DbTrip {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  created_by: string | null
  spectator_token: string | null
  war_enabled: boolean
  competition_name: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// WAR TYPES
// ============================================================================

export interface DbTripTeamAssignment {
  id: string
  trip_id: string
  player_id: string
  team: 'A' | 'B'
  created_at: string
}

export type DbTripTeamAssignmentInsert = Omit<DbTripTeamAssignment, 'id' | 'created_at'>

export interface DbTripMember {
  id: string
  trip_id: string
  user_id: string
  role: 'admin' | 'member'
  created_at: string
  updated_at: string
}

export interface DbPlayer {
  id: string
  trip_id: string
  name: string
  handicap_index: number | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface DbRound {
  id: string
  trip_id: string
  tee_id: string | null
  name: string
  date: string
  tee_time: string | null
  status: 'upcoming' | 'in_progress' | 'completed'
  format: 'stroke_play' | 'match_play' | 'points_hilo' | 'stableford'
  scoring_basis: 'gross' | 'net'
  created_at: string
  updated_at: string
}

export interface DbGroup {
  id: string
  round_id: string
  group_number: number
  scorer_player_id: string | null
  tee_time: string | null
  created_at: string
  updated_at: string
}

export interface DbGroupPlayer {
  id: string
  group_id: string
  player_id: string
  playing_handicap: number | null
  team_number: 1 | 2 | null
  created_at: string
  updated_at: string
}

export interface DbScore {
  id: string
  round_id: string
  player_id: string
  hole_number: number
  gross_strokes: number | null
  created_at: string
  updated_at: string
}

// Insert types
export type DbTripInsert = Omit<DbTrip, 'id' | 'created_at' | 'updated_at' | 'spectator_token'>
export type DbTripMemberInsert = Omit<DbTripMember, 'id' | 'created_at' | 'updated_at'>
export type DbPlayerInsert = Omit<DbPlayer, 'id' | 'created_at' | 'updated_at'>
export type DbRoundInsert = Omit<DbRound, 'id' | 'created_at' | 'updated_at'>
export type DbGroupInsert = Omit<DbGroup, 'id' | 'created_at' | 'updated_at'>
export type DbGroupPlayerInsert = Omit<DbGroupPlayer, 'id' | 'created_at' | 'updated_at'>
export type DbScoreInsert = Omit<DbScore, 'id' | 'created_at' | 'updated_at'>

// Join types for queries
export interface DbTripWithMembers extends DbTrip {
  trip_members: DbTripMember[]
}

export interface DbRoundWithTee extends DbRound {
  tees: DbTeeWithHoles | null
}

export interface DbRoundWithGroups extends DbRound {
  groups: DbGroupWithPlayers[]
  tees: DbTeeWithHoles | null
}

export interface DbGroupWithPlayers extends DbGroup {
  group_players: (DbGroupPlayer & { players: DbPlayer })[]
}

export interface DbPlayerWithScores extends DbPlayer {
  scores: DbScore[]
}

// ============================================================================
// TRIP MEDIA TYPES
// ============================================================================

export interface DbTripMedia {
  id: string
  trip_id: string
  uploaded_by: string
  player_name: string | null
  storage_path: string
  thumbnail_path: string | null
  media_type: 'image' | 'video'
  caption: string | null
  round_id: string | null
  hole_number: number | null
  created_at: string
}

export type DbTripMediaInsert = Omit<DbTripMedia, 'id' | 'created_at'>

// Minimal round data for Trip HQ display
export interface DbRoundSummary {
  id: string
  name: string
  date: string
  tee_time: string | null
  status: 'upcoming' | 'in_progress' | 'completed'
  format: 'stroke_play' | 'match_play' | 'points_hilo' | 'stableford'
  scoring_basis?: 'gross' | 'net'
}

// Extended trip type with counts for Trip HQ
export interface DbTripWithCounts extends DbTrip {
  trip_members: DbTripMember[]
  playerCount: number
  roundCount: number
  recentRounds: DbRoundSummary[]
}
