/**
 * Golf Course Data Types
 *
 * These types represent the data model for courses, tees, and holes.
 * Designed to support handicap calculation and net scoring.
 */

// ============================================================================
// Core Domain Types (what we store in Supabase)
// ============================================================================

export interface HoleInfo {
  number: number        // 1-18
  par: number           // 3, 4, or 5
  strokeIndex: number   // 1-18 (handicap allocation)
  yards?: number        // optional yardage
}

export interface Tee {
  id: string
  courseId: string
  name: string          // "Blue", "Black", "Gold"
  color?: string        // hex color for display
  rating: number        // course rating (e.g., 72.4)
  slope: number         // slope rating (e.g., 144)
  par: number           // total par (sum of holes)
  yards?: number        // total yardage
  holes: HoleInfo[]     // 18 holes
}

export interface Course {
  id: string
  name: string          // club name or course name
  location: string      // "City, State/Province"
  country: 'US' | 'CA' | 'other'
  externalId?: string   // API provider ID for re-fetching
  createdAt: Date
}

// ============================================================================
// API Response Types (what golfcourseapi.com returns)
// ============================================================================

export interface ApiHole {
  par: number
  yardage: number
  handicap?: number     // stroke index (not always present)
}

export interface ApiTee {
  tee_name: string
  course_rating: number
  slope_rating: number
  bogey_rating?: number
  par_total: number
  total_yards: number
  total_meters?: number
  number_of_holes: number
  front_course_rating?: number
  front_slope_rating?: number
  back_course_rating?: number
  back_slope_rating?: number
  holes: ApiHole[]
}

export interface ApiCourseLocation {
  address?: string
  city?: string
  state?: string
  country?: string
  latitude?: number
  longitude?: number
}

export interface ApiCourse {
  id: number
  club_name: string
  course_name?: string
  location: ApiCourseLocation
  tees: {
    male?: ApiTee[]
    female?: ApiTee[]
  }
}

export interface ApiSearchResult {
  id: number
  club_name?: string
  course_name?: string
  location?: ApiCourseLocation
}

// ============================================================================
// UI State Types
// ============================================================================

export interface CourseSearchState {
  query: string
  results: ApiSearchResult[]
  loading: boolean
  error?: string
}

export interface TeeSelectionState {
  course: ApiCourse | null
  selectedTee: ApiTee | null
  gender: 'male' | 'female'
}

export interface ReviewScorecardState {
  courseName: string
  location: string
  teeName: string
  rating: number
  slope: number
  par: number
  yards?: number
  holes: HoleInfo[]
  isDirty: boolean
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert API tee to our domain Tee type
 */
export function apiTeeToTee(
  apiTee: ApiTee,
  courseId: string,
  teeId: string
): Tee {
  return {
    id: teeId,
    courseId,
    name: apiTee.tee_name,
    rating: apiTee.course_rating,
    slope: apiTee.slope_rating,
    par: apiTee.par_total,
    yards: apiTee.total_yards,
    holes: apiTee.holes.map((h, i) => ({
      number: i + 1,
      par: h.par,
      strokeIndex: h.handicap ?? 0, // 0 means "not set"
      yards: h.yardage,
    })),
  }
}

/**
 * Determine country from API location
 */
export function getCountryFromLocation(
  location?: ApiCourseLocation
): 'US' | 'CA' | 'other' {
  const country = location?.country?.toLowerCase() || ''
  if (country.includes('united states') || country === 'usa' || country === 'us') {
    return 'US'
  }
  if (country.includes('canada') || country === 'ca') {
    return 'CA'
  }
  return 'other'
}

/**
 * Format location string from API location
 */
export function formatLocation(location?: ApiCourseLocation): string {
  if (!location) return ''
  const parts = [location.city, location.state].filter(Boolean)
  return parts.join(', ')
}
