/**
 * Golf Course API Client
 *
 * Wrapper for golfcourseapi.com REST API.
 * Handles search, course details, and error handling.
 */

import { ApiCourse, ApiSearchResult } from './types'

const API_BASE = 'https://api.golfcourseapi.com/v1'

class CourseApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'CourseApiError'
  }
}

/**
 * Get API key from environment
 * In Next.js, server-side code uses process.env directly
 * Client-side code needs NEXT_PUBLIC_ prefix
 */
function getApiKey(): string {
  const key = process.env.GOLF_COURSE_API_KEY || process.env.NEXT_PUBLIC_GOLF_COURSE_API_KEY
  if (!key) {
    throw new CourseApiError(
      'Golf Course API key not configured. Set GOLF_COURSE_API_KEY in .env.local',
      500,
      'MISSING_API_KEY'
    )
  }
  return key
}

/**
 * Make authenticated request to the Golf Course API
 */
async function apiRequest<T>(endpoint: string): Promise<T> {
  const apiKey = getApiKey()

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new CourseApiError(
        'API rate limit exceeded. Free tier allows 300 requests/day.',
        429,
        'RATE_LIMIT'
      )
    }

    const text = await response.text()
    throw new CourseApiError(
      `API request failed: ${text}`,
      response.status
    )
  }

  return response.json()
}

/**
 * Search for golf courses by name
 *
 * @param query - Search term (course name, city, etc.)
 * @returns Array of matching courses
 */
export async function searchCourses(query: string): Promise<ApiSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const data = await apiRequest<{ courses?: ApiSearchResult[] }>(
    `/search?search_query=${encodeURIComponent(query.trim())}`
  )

  return data.courses || []
}

/**
 * Get full course details including tees and holes
 *
 * @param courseId - The course ID from search results
 * @returns Full course data with tees
 */
export async function getCourseDetails(courseId: number | string): Promise<ApiCourse> {
  const data = await apiRequest<{ course: ApiCourse }>(
    `/courses/${courseId}`
  )

  if (!data.course) {
    throw new CourseApiError(
      `Course not found: ${courseId}`,
      404,
      'NOT_FOUND'
    )
  }

  return data.course
}

/**
 * Check if API is reachable
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await apiRequest('/healthcheck')
    return true
  } catch {
    return false
  }
}

export { CourseApiError }
