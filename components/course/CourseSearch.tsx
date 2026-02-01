'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, Button } from '@/components/ui'
import { Tabs } from '@/components/ui/Tabs'
import { ApiSearchResult, ApiCourse, ApiTee, formatLocation } from '@/lib/api/types'
import { searchCoursesAction, getCourseDetailsAction } from '@/lib/api/actions'

// ============================================================================
// Types & Constants
// ============================================================================

interface RecentCourse {
  id: number
  courseName: string
  clubName: string
  location: string
  selectedAt: number
}

const RECENT_COURSES_KEY = 'press-recent-courses'
const MAX_RECENT = 5

/** Tee color mapping by name keyword */
const TEE_COLOR_MAP: Record<string, string> = {
  black: '#1C1C1E',
  blue: '#3B82F6',
  white: '#F5F5F4',
  gold: '#EAB308',
  red: '#EF4444',
  green: '#22C55E',
  silver: '#9CA3AF',
  purple: '#8B5CF6',
  orange: '#F97316',
  championship: '#1C1C1E',
  tips: '#1C1C1E',
  tournament: '#3B82F6',
  forward: '#EF4444',
  senior: '#EAB308',
}

function getTeeColor(teeName: string): string {
  const lower = teeName.toLowerCase()
  for (const [key, color] of Object.entries(TEE_COLOR_MAP)) {
    if (lower.includes(key)) return color
  }
  return '#F59E0B' // accent gold default
}

function needsBorder(color: string): boolean {
  return color === '#F5F5F4' || color === '#1C1C1E'
}

// ============================================================================
// localStorage helpers
// ============================================================================

function getRecentCourses(): RecentCourse[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_COURSES_KEY)
    if (!stored) return []
    return JSON.parse(stored) as RecentCourse[]
  } catch {
    return []
  }
}

function saveRecentCourse(course: ApiCourse): void {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentCourses()
    const entry: RecentCourse = {
      id: course.id,
      courseName: course.course_name || course.club_name,
      clubName: course.club_name,
      location: formatLocation(course.location),
      selectedAt: Date.now(),
    }
    const filtered = recent.filter((r) => r.id !== course.id)
    const updated = [entry, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_COURSES_KEY, JSON.stringify(updated))
  } catch {
    // localStorage might be full or unavailable
  }
}

// ============================================================================
// Grouping logic
// ============================================================================

interface CourseGroup {
  clubName: string
  location: string
  courses: ApiSearchResult[]
}

function groupByClub(results: ApiSearchResult[]): CourseGroup[] {
  const groups = new Map<string, ApiSearchResult[]>()
  const order: string[] = []

  for (const course of results) {
    const key = course.club_name || course.course_name || 'Unknown'
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(course)
  }

  return order.map((key) => ({
    clubName: key,
    location: formatLocation(groups.get(key)![0].location),
    courses: groups.get(key)!,
  }))
}

// ============================================================================
// Props
// ============================================================================

interface CourseSearchProps {
  /** Called when user selects a course + tee inline */
  onSelect: (course: ApiCourse, tee: ApiTee) => void
  onManualEntry: () => void
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function CourseSearch({
  onSelect,
  onManualEntry,
  className,
}: CourseSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApiSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Inline tee selection state
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null)
  const [courseDetails, setCourseDetails] = useState<ApiCourse | null>(null)
  const [loadingTees, setLoadingTees] = useState(false)
  const [teeError, setTeeError] = useState<string | null>(null)
  const [teeGender, setTeeGender] = useState<'male' | 'female'>('male')

  // Recent courses
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([])

  // Load recent courses on mount
  useEffect(() => {
    setRecentCourses(getRecentCourses())
  }, [])

  // Debounced search with optimistic loading
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setHasSearched(false)
      setLoading(false)
      setExpandedCourseId(null)
      setCourseDetails(null)
      return
    }

    // Show loading immediately for perceived performance
    setLoading(true)

    const timer = setTimeout(async () => {
      setError(null)
      setHasSearched(true)
      setExpandedCourseId(null)
      setCourseDetails(null)

      try {
        const { courses, error: searchError } = await searchCoursesAction(query)
        if (searchError) {
          setError(searchError)
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

  // Load tees when a course is expanded
  const handleExpand = useCallback(
    async (courseId: number) => {
      if (expandedCourseId === courseId) {
        setExpandedCourseId(null)
        setCourseDetails(null)
        return
      }

      setExpandedCourseId(courseId)
      setLoadingTees(true)
      setTeeError(null)
      setCourseDetails(null)
      setTeeGender('male')

      try {
        const { course, error: detailError } = await getCourseDetailsAction(courseId)
        if (detailError || !course) {
          setTeeError(detailError || 'Failed to load tee data')
        } else {
          setCourseDetails(course)
          if (!course.tees?.male?.length && course.tees?.female?.length) {
            setTeeGender('female')
          }
        }
      } catch (err) {
        setTeeError(err instanceof Error ? err.message : 'Failed to load tees')
      } finally {
        setLoadingTees(false)
      }
    },
    [expandedCourseId]
  )

  // Handle tee selection
  const handleTeeSelect = useCallback(
    (tee: ApiTee) => {
      if (!courseDetails) return
      saveRecentCourse(courseDetails)
      onSelect(courseDetails, tee)
    },
    [courseDetails, onSelect]
  )

  // Handle clicking a recent course
  const handleRecentClick = useCallback(async (recent: RecentCourse) => {
    setExpandedCourseId(recent.id)
    setLoadingTees(true)
    setTeeError(null)
    setCourseDetails(null)
    setTeeGender('male')
    setQuery(recent.courseName)

    try {
      const { course, error: detailError } = await getCourseDetailsAction(recent.id)
      if (detailError || !course) {
        setTeeError(detailError || 'Failed to load tee data')
      } else {
        setCourseDetails(course)
        setResults([
          {
            id: course.id,
            club_name: course.club_name,
            course_name: course.course_name,
            location: course.location,
          },
        ])
        setHasSearched(true)
        if (!course.tees?.male?.length && course.tees?.female?.length) {
          setTeeGender('female')
        }
      }
    } catch (err) {
      setTeeError(err instanceof Error ? err.message : 'Failed to load tees')
    } finally {
      setLoadingTees(false)
    }
  }, [])

  const groups = groupByClub(results.slice(0, 15))
  const tees = courseDetails
    ? (teeGender === 'male' ? courseDetails.tees?.male : courseDetails.tees?.female) || []
    : []
  const hasBothGenders =
    !!courseDetails &&
    (courseDetails.tees?.male?.length ?? 0) > 0 &&
    (courseDetails.tees?.female?.length ?? 0) > 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-2">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses or resorts..."
          className={cn(
            'w-full min-h-button rounded-button border border-stroke bg-bg-1 pl-12 pr-4 py-3',
            'text-body text-text-0 placeholder:text-text-2',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            'transition-colors duration-tap'
          )}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
      </div>

      {/* Recent Courses (show when no query) */}
      {!hasSearched && recentCourses.length > 0 && (
        <div>
          <p className="text-xs text-text-2 uppercase tracking-wider mb-2 px-1">
            Recent Courses
          </p>
          <Card className="overflow-hidden p-0">
            {recentCourses.map((recent, index) => (
              <button
                key={recent.id}
                onClick={() => handleRecentClick(recent)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left',
                  'transition-colors duration-tap hover:bg-bg-2',
                  index !== recentCourses.length - 1 && 'border-b border-stroke/60'
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent flex-shrink-0">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-text-0 block truncate">
                    {recent.courseName}
                  </span>
                  {recent.clubName && recent.clubName !== recent.courseName && (
                    <span className="text-xs text-text-2 block truncate">
                      at {recent.clubName}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-2 flex-shrink-0">
                  {recent.location}
                </span>
              </button>
            ))}
          </Card>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-card-sm bg-bad/10 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && results.length === 0 && query.length >= 2 && (
        <Card className="overflow-hidden p-0">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn('px-4 py-3', i !== 3 && 'border-b border-stroke/60')}
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-bg-2 mb-1.5" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-bg-2" />
            </div>
          ))}
        </Card>
      )}

      {/* Results List (grouped by club) */}
      {!loading && groups.length > 0 && (
        <Card className="overflow-hidden p-0">
          {groups.map((group, groupIdx) => {
            const isMultiCourse = group.courses.length > 1

            return (
              <div key={`${group.clubName}-${groupIdx}`}>
                {/* Club/resort header for multi-course facilities */}
                {isMultiCourse && (
                  <div
                    className={cn(
                      'px-4 py-2 bg-bg-2/50',
                      groupIdx !== 0 && 'border-t border-stroke/60'
                    )}
                  >
                    <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                      {group.clubName}
                    </span>
                    {group.location && (
                      <span className="text-xs text-text-2 ml-2">{group.location}</span>
                    )}
                  </div>
                )}

                {group.courses.map((course, courseIdx) => {
                  const isExpanded = expandedCourseId === course.id
                  const showTopBorder =
                    !isMultiCourse && (groupIdx !== 0 || courseIdx !== 0)

                  return (
                    <div key={course.id}>
                      {/* Course row */}
                      <button
                        onClick={() => handleExpand(course.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left',
                          'transition-colors duration-tap hover:bg-bg-2',
                          'focus:outline-none focus:bg-bg-2',
                          showTopBorder && 'border-t border-stroke/60',
                          isMultiCourse && courseIdx !== 0 && 'border-t border-stroke/60',
                          isExpanded && 'bg-bg-2/30'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-body font-medium text-text-0 block">
                            {course.course_name || course.club_name}
                          </span>
                          {/* Show club subtitle only for single-course results */}
                          {!isMultiCourse &&
                            course.course_name &&
                            course.club_name &&
                            course.course_name !== course.club_name && (
                              <span className="text-sm text-text-1 block">
                                at {course.club_name}
                              </span>
                            )}
                          {!isMultiCourse && (
                            <span className="text-sm text-text-2 block">
                              {formatLocation(course.location)}
                            </span>
                          )}
                        </div>

                        {/* Expand chevron */}
                        <svg
                          className={cn(
                            'h-4 w-4 text-text-2 transition-transform duration-200 flex-shrink-0',
                            isExpanded && 'rotate-180'
                          )}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </button>

                      {/* Inline Tee Selector (expanded) */}
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-bg-2/20 border-t border-stroke/30">
                          {/* Loading tees */}
                          {loadingTees && (
                            <div className="py-4 space-y-2">
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 rounded-card-sm border border-stroke/30 px-3 py-2.5"
                                >
                                  <div className="h-4 w-4 rounded-full animate-pulse bg-bg-2" />
                                  <div className="h-3 w-16 animate-pulse rounded bg-bg-2" />
                                  <div className="flex-1" />
                                  <div className="h-3 w-20 animate-pulse rounded bg-bg-2" />
                                  <div className="h-3 w-14 animate-pulse rounded bg-bg-2" />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Tee error */}
                          {teeError && (
                            <div className="py-3 text-sm text-bad">{teeError}</div>
                          )}

                          {/* Gender toggle */}
                          {hasBothGenders && !loadingTees && (
                            <div className="pt-3 mb-3">
                              <Tabs
                                tabs={[
                                  { id: 'male', label: 'Men' },
                                  { id: 'female', label: 'Women' },
                                ]}
                                activeTab={teeGender}
                                onChange={(id) => setTeeGender(id as 'male' | 'female')}
                              />
                            </div>
                          )}

                          {/* Tee list with color-coded pills */}
                          {!loadingTees && !teeError && tees.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                              <p className="text-xs text-text-2 mb-2">Select tee:</p>
                              {tees.map((tee) => {
                                const color = getTeeColor(tee.tee_name)
                                return (
                                  <button
                                    key={tee.tee_name}
                                    onClick={() => handleTeeSelect(tee)}
                                    className={cn(
                                      'flex w-full items-center gap-3 rounded-card-sm border border-stroke/60 px-3 py-2.5',
                                      'transition-all duration-tap hover:border-accent/60 hover:bg-accent/5',
                                      'active:scale-[0.98]'
                                    )}
                                  >
                                    {/* Color pill */}
                                    <div
                                      className={cn(
                                        'h-4 w-4 rounded-full flex-shrink-0',
                                        needsBorder(color) ? 'border border-stroke' : ''
                                      )}
                                      style={{ backgroundColor: color }}
                                    />

                                    {/* Tee name */}
                                    <span className="flex-1 text-left text-sm font-medium text-text-0">
                                      {tee.tee_name}
                                    </span>

                                    {/* Rating / Slope */}
                                    <span className="font-display text-xs tabular-nums text-text-1">
                                      {tee.course_rating.toFixed(1)} / {tee.slope_rating}
                                    </span>

                                    {/* Yards */}
                                    <span className="text-xs text-text-2 w-16 text-right tabular-nums">
                                      {tee.total_yards.toLocaleString()} yd
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {/* No tees available */}
                          {!loadingTees && !teeError && tees.length === 0 && courseDetails && (
                            <div className="py-4 text-center">
                              <p className="text-sm text-text-2 mb-2">
                                No tee data available
                              </p>
                              <Button
                                variant="secondary"
                                onClick={onManualEntry}
                              >
                                Enter manually
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Card>
      )}

      {/* No Results */}
      {hasSearched && !loading && results.length === 0 && query.length >= 2 && !error && (
        <div className="text-center py-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-2">
            <svg
              className="h-6 w-6 text-text-2"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <p className="text-text-1 font-medium mb-1">No courses found</p>
          <p className="text-sm text-text-2 mb-1">
            No results for &quot;{query}&quot;
          </p>
          <p className="text-xs text-text-2 mb-4">
            Try the resort name (e.g., &quot;Bandon Dunes&quot;) or city name
          </p>
          <Button variant="secondary" onClick={onManualEntry}>
            Add course manually
          </Button>
        </div>
      )}

      {/* Manual Entry Link */}
      {!hasSearched && (
        <button
          onClick={onManualEntry}
          className="text-sm text-text-2 hover:text-accent transition-colors duration-tap"
        >
          Can&apos;t find your course? Add manually →
        </button>
      )}
    </div>
  )
}
