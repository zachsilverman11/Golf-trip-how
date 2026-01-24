'use server'

/**
 * Server Actions for Course persistence in Supabase
 */

import { createClient } from './server'
import type { DbCourse, DbTee, DbHole, DbCourseWithTees } from './types'
import type { HoleInfo, ApiCourse, ApiTee } from '@/lib/api/types'

// ============================================================================
// Types for action parameters
// ============================================================================

export interface SaveCourseInput {
  courseName: string
  location: string
  country: 'US' | 'CA' | 'other'
  externalProvider?: string  // e.g., 'golfcourseapi'
  externalId?: string
  teeName: string
  teeColor?: string
  rating: number
  slope: number
  par: number
  yards?: number
  gender?: 'male' | 'female' | 'unisex'
  holes: HoleInfo[]
}

export interface SaveCourseResult {
  success: boolean
  courseId?: string
  teeId?: string
  error?: string
}

// ============================================================================
// Save Course (transaction-like: course + tee + holes)
// ============================================================================

export async function saveCourseAction(input: SaveCourseInput): Promise<SaveCourseResult> {
  const supabase = createClient()

  try {
    // 1. Check if course already exists (by external ID)
    let courseId: string | undefined

    if (input.externalProvider && input.externalId) {
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('external_provider', input.externalProvider)
        .eq('external_id', input.externalId)
        .single()

      if (existingCourse) {
        courseId = existingCourse.id
      }
    }

    // 2. Insert course if it doesn't exist
    if (!courseId) {
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          name: input.courseName,
          location: input.location || null,
          country: input.country,
          external_provider: input.externalProvider || null,
          external_id: input.externalId || null,
        })
        .select('id')
        .single()

      if (courseError) {
        console.error('Course insert error:', courseError)
        return { success: false, error: `Failed to save course: ${courseError.message}` }
      }

      courseId = newCourse.id
    }

    // 3. Check if this tee already exists for this course
    const { data: existingTee } = await supabase
      .from('tees')
      .select('id')
      .eq('course_id', courseId)
      .eq('name', input.teeName)
      .eq('gender', input.gender || 'unisex')
      .single()

    let teeId: string

    if (existingTee) {
      // Update existing tee
      const { error: teeUpdateError } = await supabase
        .from('tees')
        .update({
          color: input.teeColor || null,
          rating: input.rating,
          slope: input.slope,
          par: input.par,
          yards: input.yards || null,
        })
        .eq('id', existingTee.id)

      if (teeUpdateError) {
        console.error('Tee update error:', teeUpdateError)
        return { success: false, error: `Failed to update tee: ${teeUpdateError.message}` }
      }

      teeId = existingTee.id

      // Delete existing holes to replace with new ones
      await supabase.from('holes').delete().eq('tee_id', teeId)
    } else {
      // Insert new tee
      const { data: newTee, error: teeError } = await supabase
        .from('tees')
        .insert({
          course_id: courseId,
          name: input.teeName,
          color: input.teeColor || null,
          rating: input.rating,
          slope: input.slope,
          par: input.par,
          yards: input.yards || null,
          gender: input.gender || 'unisex',
        })
        .select('id')
        .single()

      if (teeError) {
        console.error('Tee insert error:', teeError)
        return { success: false, error: `Failed to save tee: ${teeError.message}` }
      }

      teeId = newTee.id
    }

    // 4. Insert all 18 holes
    const holesData = input.holes.map((hole) => ({
      tee_id: teeId,
      hole_number: hole.number,
      par: hole.par,
      stroke_index: hole.strokeIndex,
      yards: hole.yards || null,
    }))

    const { error: holesError } = await supabase.from('holes').insert(holesData)

    if (holesError) {
      console.error('Holes insert error:', holesError)
      return { success: false, error: `Failed to save holes: ${holesError.message}` }
    }

    return { success: true, courseId, teeId }
  } catch (err) {
    console.error('Save course error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error saving course',
    }
  }
}

// ============================================================================
// Get all courses with tees
// ============================================================================

export async function getCoursesAction(): Promise<{
  courses: DbCourseWithTees[]
  error?: string
}> {
  const supabase = createClient()

  try {
    // Get courses with their tees
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        *,
        tees (
          *,
          holes (*)
        )
      `)
      .order('updated_at', { ascending: false })

    if (coursesError) {
      return { courses: [], error: coursesError.message }
    }

    return { courses: courses as DbCourseWithTees[] }
  } catch (err) {
    return {
      courses: [],
      error: err instanceof Error ? err.message : 'Failed to load courses',
    }
  }
}

// ============================================================================
// Get single course by ID
// ============================================================================

export async function getCourseByIdAction(courseId: string): Promise<{
  course?: DbCourseWithTees
  error?: string
}> {
  const supabase = createClient()

  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        *,
        tees (
          *,
          holes (*)
        )
      `)
      .eq('id', courseId)
      .single()

    if (error) {
      return { error: error.message }
    }

    return { course: course as DbCourseWithTees }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to load course',
    }
  }
}

// ============================================================================
// Search courses by name
// ============================================================================

export async function searchSavedCoursesAction(query: string): Promise<{
  courses: DbCourse[]
  error?: string
}> {
  const supabase = createClient()

  if (!query || query.trim().length < 2) {
    return { courses: [] }
  }

  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (error) {
      return { courses: [], error: error.message }
    }

    return { courses: courses || [] }
  } catch (err) {
    return {
      courses: [],
      error: err instanceof Error ? err.message : 'Search failed',
    }
  }
}

// ============================================================================
// Import Course from API (convenience wrapper around saveCourseAction)
// ============================================================================

export async function importCourseAction(
  course: ApiCourse,
  tee: ApiTee
): Promise<SaveCourseResult> {
  // Build hole info from the API tee data
  const holes: HoleInfo[] = tee.holes.map((hole, index) => ({
    number: index + 1,
    par: hole.par,
    strokeIndex: hole.handicap || (index + 1), // Use handicap as stroke index, or default to hole number
    yards: hole.yardage,
  }))

  // Calculate total par from holes
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0)

  // Build location string
  const location = [
    course.location?.city,
    course.location?.state,
    course.location?.country,
  ]
    .filter(Boolean)
    .join(', ')

  // Use existing saveCourseAction
  // Prefer course_name (specific course like "Pacific Dunes") over club_name for disambiguation
  return saveCourseAction({
    courseName: course.course_name || course.club_name || 'Unknown Course',
    location,
    country: course.location?.country === 'Canada' ? 'CA' : 'US',
    externalProvider: 'golfcourseapi',
    externalId: String(course.id),
    teeName: tee.tee_name,
    rating: tee.course_rating,
    slope: tee.slope_rating,
    par: totalPar,
    yards: tee.total_yards,
    gender: 'male', // API tees are already gender-filtered
    holes,
  })
}
