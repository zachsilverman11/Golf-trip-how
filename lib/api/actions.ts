'use server'

/**
 * Server Actions for Golf Course API
 *
 * These run on the server, keeping the API key secure.
 */

import { ApiSearchResult, ApiCourse } from './types'

const API_BASE = 'https://api.golfcourseapi.com/v1'

function getApiKey(): string {
  const key = process.env.GOLF_COURSE_API_KEY
  if (!key) {
    throw new Error('GOLF_COURSE_API_KEY not configured')
  }
  return key
}

export async function searchCoursesAction(
  query: string
): Promise<{ courses: ApiSearchResult[]; error?: string }> {
  if (!query || query.trim().length < 2) {
    return { courses: [] }
  }

  try {
    const response = await fetch(
      `${API_BASE}/search?search_query=${encodeURIComponent(query.trim())}`,
      {
        headers: {
          Authorization: `Key ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 429) {
        return { courses: [], error: 'API rate limit exceeded (300/day)' }
      }
      const text = await response.text()
      return { courses: [], error: `API error: ${text}` }
    }

    const data = await response.json()
    return { courses: data.courses || [] }
  } catch (err) {
    return {
      courses: [],
      error: err instanceof Error ? err.message : 'Search failed',
    }
  }
}

export async function getCourseDetailsAction(
  courseId: number | string
): Promise<{ course?: ApiCourse; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/courses/${courseId}`, {
      headers: {
        Authorization: `Key ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        return { error: 'API rate limit exceeded (300/day)' }
      }
      if (response.status === 404) {
        return { error: 'Course not found' }
      }
      const text = await response.text()
      return { error: `API error: ${text}` }
    }

    const data = await response.json()
    return { course: data.course }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to load course',
    }
  }
}
