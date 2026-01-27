'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, Button } from '@/components/ui'
import { ApiSearchResult, formatLocation } from '@/lib/api/types'
import { searchCoursesAction } from '@/lib/api/actions'

interface CourseSearchProps {
  onSelect: (course: ApiSearchResult) => void
  onManualEntry: () => void
  className?: string
}

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

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      setHasSearched(true)

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
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback(
    (course: ApiSearchResult) => {
      onSelect(course)
    },
    [onSelect]
  )

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses..."
          className={cn(
            'w-full min-h-button rounded-button border border-stroke bg-bg-1 px-4 py-3',
            'text-body text-text-0 placeholder:text-text-2',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            'transition-colors duration-tap'
          )}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg
              className="h-5 w-5 animate-spin text-text-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-card-sm bg-bad/10 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {/* Results List */}
      {results.length > 0 && (
        <Card className="overflow-hidden p-0">
          {results.slice(0, 10).map((course, index) => (
            <button
              key={course.id}
              onClick={() => handleSelect(course)}
              className={cn(
                'flex w-full flex-col gap-0.5 px-4 py-3 text-left',
                'transition-colors duration-tap hover:bg-bg-2',
                'focus:outline-none focus:bg-bg-2',
                index !== results.length - 1 && index !== 9 && 'border-b border-stroke/60'
              )}
            >
              <span className="text-body font-medium text-text-0">
                {course.course_name || course.club_name}
              </span>
              {course.course_name && course.club_name && course.course_name !== course.club_name && (
                <span className="text-sm text-text-1">at {course.club_name}</span>
              )}
              <span className="text-sm text-text-2">
                {formatLocation(course.location)}
              </span>
            </button>
          ))}
        </Card>
      )}

      {/* No Results */}
      {hasSearched && !loading && results.length === 0 && query.length >= 2 && (
        <div className="text-center py-6">
          <p className="text-text-2 mb-2">No courses found for &quot;{query}&quot;</p>
          <p className="text-sm text-text-2 mb-4">
            Try searching by facility name (e.g., &quot;Bandon Dunes&quot; instead of &quot;Sheep Ranch&quot;)
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
