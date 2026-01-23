/**
 * Database types for Supabase tables
 */

export interface DbCourse {
  id: string
  name: string
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
