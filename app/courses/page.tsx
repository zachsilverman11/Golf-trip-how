'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BackButton } from '@/components/ui/BackButton'
import { ApiSearchResult, ApiCourse, ApiTee, formatLocation } from '@/lib/api/types'
import { searchCoursesAction, getCourseDetailsAction } from '@/lib/api/actions'

export default function CoursesPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApiSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search courses with debounce
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

  return (
    <div className="py-8">
      <LayoutContainer>
        {/* Back button */}
        <div className="mb-4">
          <BackButton href="/trips" label="Back" />
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text-0 mb-2">
            Find a Course
          </h1>
          <p className="text-sm text-text-2">
            Search for any golf course to add to your trip
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses by name…"
            autoFocus
            className="w-full rounded-card border border-stroke bg-bg-2 py-4 pl-12 pr-4 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card className="p-4 mb-4">
            <p className="text-sm text-bad">{error}</p>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <Card className="overflow-hidden p-0">
            {results.slice(0, 10).map((course, index) => (
              <Link
                key={course.id}
                href={`/course/new?courseId=${course.id}`}
                className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-bg-2 active:scale-[0.99] ${
                  index !== Math.min(results.length, 10) - 1
                    ? 'border-b border-stroke/60'
                    : ''
                }`}
              >
                <span className="font-medium text-text-0">
                  {course.course_name || course.club_name}
                </span>
                {course.course_name &&
                  course.club_name &&
                  course.course_name !== course.club_name && (
                    <span className="text-sm text-text-1">
                      at {course.club_name}
                    </span>
                  )}
                <span className="text-sm text-text-2">
                  {formatLocation(course.location)}
                </span>
              </Link>
            ))}
          </Card>
        )}

        {/* Empty state before search */}
        {query.length < 2 && results.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-2">
              <svg className="h-8 w-8 text-text-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
            </div>
            <p className="text-text-2 mb-1">Type to search for a course</p>
            <p className="text-xs text-text-2">
              e.g., &quot;Bandon Dunes&quot; or &quot;Pebble Beach&quot;
            </p>
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && !loading && results.length === 0 && !error && (
          <div className="py-8 text-center">
            <p className="text-sm text-text-2 mb-2">
              No courses found for &quot;{query}&quot;
            </p>
            <p className="text-xs text-text-2 mb-4">
              Try searching by facility name (e.g., &quot;Bandon Dunes&quot; instead of &quot;Sheep Ranch&quot;)
            </p>
            <Link href="/course/new">
              <Button variant="secondary">Add Course Manually</Button>
            </Link>
          </div>
        )}
      </LayoutContainer>
    </div>
  )
}
