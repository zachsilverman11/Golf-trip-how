'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ApiSearchResult, ApiCourse, ApiTee, formatLocation } from '@/lib/api/types'
import { searchCoursesAction, getCourseDetailsAction } from '@/lib/api/actions'
import { getCoursesAction, importCourseAction } from '@/lib/supabase/actions'
import type { DbCourseWithTees } from '@/lib/supabase/types'

interface CourseSelectorProps {
  selectedTeeId: string | null
  onTeeSelected: (teeId: string, courseName: string, teeName: string) => void
  className?: string
  // Optional initial display info for restoring state from persistence
  initialCourseInfo?: {
    name: string
    teeName: string
  } | null
}

type Step = 'search' | 'select-tee' | 'selected'

interface SelectedCourse {
  name: string
  location: string
  teeId: string
  teeName: string
  rating: number
  slope: number
  yards: number
}

export function CourseSelector({
  selectedTeeId,
  onTeeSelected,
  className,
  initialCourseInfo,
}: CourseSelectorProps) {
  const [step, setStep] = useState<Step>(selectedTeeId ? 'selected' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApiSearchResult[]>([])
  const [recentCourses, setRecentCourses] = useState<DbCourseWithTees[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCourse, setLoadingCourse] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedApiCourse, setSelectedApiCourse] = useState<ApiSearchResult | null>(null)
  const [apiCourseDetails, setApiCourseDetails] = useState<ApiCourse | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(
    // Initialize from props if we have a selectedTeeId and initialCourseInfo
    selectedTeeId && initialCourseInfo
      ? {
          name: initialCourseInfo.name,
          location: '',
          teeId: selectedTeeId,
          teeName: initialCourseInfo.teeName,
          rating: 0,
          slope: 0,
          yards: 0,
        }
      : null
  )

  // Load recent/existing courses
  useEffect(() => {
    const loadRecent = async () => {
      const result = await getCoursesAction()
      if (result.courses) {
        setRecentCourses(result.courses.slice(0, 5))
      }
    }
    loadRecent()
  }, [])

  // Search courses
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const { courses, error } = await searchCoursesAction(query)
        if (error) {
          setError(error)
          setResults([])
        } else {
          setResults(courses)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Load course details when API course selected
  const handleSelectApiCourse = useCallback(async (course: ApiSearchResult) => {
    setSelectedApiCourse(course)
    setLoadingCourse(true)
    setError(null)
    setStep('select-tee')

    try {
      const { course: details, error } = await getCourseDetailsAction(course.id)
      if (error || !details) {
        setError(error || 'Failed to load course details')
        return
      }
      setApiCourseDetails(details)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load course')
    } finally {
      setLoadingCourse(false)
    }
  }, [])

  // Handle selecting an existing course tee
  const handleSelectExistingTee = useCallback((course: DbCourseWithTees, tee: any) => {
    setSelectedCourse({
      name: course.name,
      location: course.location || '',
      teeId: tee.id,
      teeName: tee.name,
      rating: tee.rating,
      slope: tee.slope,
      yards: tee.yards,
    })
    setStep('selected')
    onTeeSelected(tee.id, course.name, tee.name)
  }, [onTeeSelected])

  // Handle selecting an API tee (will import the course)
  const handleSelectApiTee = useCallback(async (tee: ApiTee) => {
    if (!apiCourseDetails) return

    setLoadingCourse(true)
    setError(null)

    try {
      // Import the course to our database
      const result = await importCourseAction(apiCourseDetails, tee)

      if (!result.success || !result.teeId) {
        setError(result.error || 'Failed to import course')
        return
      }

      // Use course_name (specific course like "Pacific Dunes") if available, otherwise club_name
      const displayName = apiCourseDetails.course_name || apiCourseDetails.club_name || 'Unknown Course'
      setSelectedCourse({
        name: displayName,
        location: formatLocation(apiCourseDetails.location),
        teeId: result.teeId!,
        teeName: tee.tee_name,
        rating: tee.course_rating,
        slope: tee.slope_rating,
        yards: tee.total_yards,
      })
      setStep('selected')
      onTeeSelected(result.teeId!, displayName, tee.tee_name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import course')
    } finally {
      setLoadingCourse(false)
    }
  }, [apiCourseDetails, onTeeSelected])

  const handleReset = () => {
    setStep('search')
    setQuery('')
    setResults([])
    setSelectedApiCourse(null)
    setApiCourseDetails(null)
    setSelectedCourse(null)
    setError(null)
  }

  // Selected state
  if (step === 'selected' && selectedCourse) {
    return (
      <div className={className}>
        <label className="mb-2 block text-sm font-medium text-text-1">
          Course & Tees
        </label>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-0">{selectedCourse.name}</p>
              <p className="text-sm text-text-2">
                {selectedCourse.teeName} • {selectedCourse.rating}/{selectedCourse.slope} • {selectedCourse.yards} yds
              </p>
            </div>
            <Button variant="secondary" size="default" onClick={handleReset}>
              Change
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Tee selection step
  if (step === 'select-tee') {
    const tees = apiCourseDetails?.tees?.male || apiCourseDetails?.tees?.female || []

    return (
      <div className={className}>
        <label className="mb-2 block text-sm font-medium text-text-1">
          Select Tees
        </label>

        <button
          onClick={() => setStep('search')}
          className="mb-3 text-sm text-text-2 hover:text-accent transition-colors"
        >
          ← Back to search
        </button>

        <Card className="p-4 mb-3">
          <p className="font-medium text-text-0">
            {selectedApiCourse?.course_name || selectedApiCourse?.club_name}
          </p>
          {selectedApiCourse?.course_name && selectedApiCourse?.club_name &&
           selectedApiCourse.course_name !== selectedApiCourse.club_name && (
            <p className="text-sm text-text-1">at {selectedApiCourse.club_name}</p>
          )}
          <p className="text-sm text-text-2">
            {formatLocation(selectedApiCourse?.location)}
          </p>
        </Card>

        {loadingCourse ? (
          <div className="text-center py-8 text-text-2">Loading tees...</div>
        ) : error ? (
          <div className="rounded-card bg-bad/10 p-4 text-bad text-sm">{error}</div>
        ) : tees.length === 0 ? (
          <div className="text-center py-4 text-text-2">No tees available</div>
        ) : (
          <Card className="overflow-hidden p-0">
            {tees.map((tee, index) => (
              <button
                key={tee.tee_name}
                onClick={() => handleSelectApiTee(tee)}
                disabled={loadingCourse}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left',
                  'transition-colors hover:bg-bg-2',
                  index !== tees.length - 1 && 'border-b border-stroke/60'
                )}
              >
                <span className="flex-1 font-medium text-text-0">{tee.tee_name}</span>
                <span className="text-sm text-text-1">
                  {tee.course_rating.toFixed(1)}/{tee.slope_rating}
                </span>
                <span className="text-sm text-text-2">{tee.total_yards} yds</span>
              </button>
            ))}
          </Card>
        )}
      </div>
    )
  }

  // Search step
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-text-1">
        Course & Tees
      </label>

      {/* Search Input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses..."
          className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-card bg-bad/10 p-3 text-sm text-bad">{error}</div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <Card className="overflow-hidden p-0 mb-4">
          {results.slice(0, 8).map((course, index) => (
            <button
              key={course.id}
              onClick={() => handleSelectApiCourse(course)}
              className={cn(
                'flex w-full flex-col gap-0.5 px-4 py-3 text-left',
                'transition-colors hover:bg-bg-2',
                index !== Math.min(results.length, 8) - 1 && 'border-b border-stroke/60'
              )}
            >
              <span className="font-medium text-text-0">
                {course.course_name || course.club_name}
              </span>
              {course.course_name && course.club_name && course.course_name !== course.club_name && (
                <span className="text-sm text-text-1">at {course.club_name}</span>
              )}
              <span className="text-sm text-text-2">{formatLocation(course.location)}</span>
            </button>
          ))}
        </Card>
      )}

      {/* Recent Courses */}
      {query.length < 2 && recentCourses.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-text-2">Recent courses</p>
          <Card className="overflow-hidden p-0">
            {recentCourses.map((course, index) => (
              <div
                key={course.id}
                className={cn(
                  'px-4 py-3',
                  index !== recentCourses.length - 1 && 'border-b border-stroke/60'
                )}
              >
                <p className="font-medium text-text-0 mb-0.5">{course.name}</p>
                {course.club_name && course.club_name !== course.name && (
                  <p className="text-sm text-text-1 mb-1">at {course.club_name}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {course.tees?.map((tee) => (
                    <button
                      key={tee.id}
                      onClick={() => handleSelectExistingTee(course, tee)}
                      className="text-xs px-2 py-1 rounded-full bg-bg-2 text-text-1 hover:bg-accent hover:text-bg-0 transition-colors"
                    >
                      {tee.name} ({tee.rating}/{tee.slope})
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* No results message */}
      {query.length >= 2 && !loading && results.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-text-2 mb-1">
            No courses found for &quot;{query}&quot;
          </p>
          <p className="text-xs text-text-2">
            Try searching by facility name (e.g., &quot;Bandon Dunes&quot; instead of &quot;Sheep Ranch&quot;)
          </p>
        </div>
      )}
    </div>
  )
}
