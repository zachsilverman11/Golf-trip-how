'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, Button, Tabs } from '@/components/ui'
import { ApiCourse, ApiTee, formatLocation } from '@/lib/api/types'
import { getCourseDetailsAction } from '@/lib/api/actions'

interface TeeSelectorProps {
  courseId: number
  courseName: string
  onSelect: (course: ApiCourse, tee: ApiTee) => void
  onBack: () => void
  className?: string
}

export function TeeSelector({
  courseId,
  courseName,
  onSelect,
  onBack,
  className,
}: TeeSelectorProps) {
  const [course, setCourse] = useState<ApiCourse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [selectedTee, setSelectedTee] = useState<ApiTee | null>(null)

  // Load course details
  useEffect(() => {
    async function loadCourse() {
      setLoading(true)
      setError(null)

      try {
        const { course: data, error } = await getCourseDetailsAction(courseId)
        if (error || !data) {
          setError(error || 'Failed to load course')
          return
        }
        setCourse(data)

        // Auto-select first tee
        const tees = data.tees?.male || data.tees?.female || []
        if (tees.length > 0) {
          setSelectedTee(tees[0])
          setGender(data.tees?.male?.length ? 'male' : 'female')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course')
      } finally {
        setLoading(false)
      }
    }

    loadCourse()
  }, [courseId])

  const tees = gender === 'male' ? course?.tees?.male : course?.tees?.female
  const hasBothGenders = course?.tees?.male?.length && course?.tees?.female?.length

  const handleContinue = () => {
    if (course && selectedTee) {
      onSelect(course, selectedTee)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <svg
          className="h-8 w-8 animate-spin text-accent"
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
    )
  }

  if (error) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="rounded-card-sm bg-bad/10 px-4 py-3 text-sm text-bad">
          {error}
        </div>
        <Button variant="secondary" onClick={onBack}>
          ← Back to search
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Course Header */}
      <div>
        <button
          onClick={onBack}
          className="text-sm text-text-2 hover:text-accent transition-colors duration-tap mb-2"
        >
          ← Back to search
        </button>
        <h2 className="font-display text-xl font-semibold text-text-0">
          {course?.club_name || courseName}
        </h2>
        {course?.course_name && course.course_name !== course.club_name && (
          <p className="text-body text-text-1">{course.course_name}</p>
        )}
        <p className="text-sm text-text-2">{formatLocation(course?.location)}</p>
      </div>

      {/* Gender Toggle (if both available) */}
      {hasBothGenders && (
        <div>
          <p className="text-sm text-text-2 mb-2">Tee ratings for:</p>
          <Tabs
            tabs={[
              { id: 'male', label: 'Men' },
              { id: 'female', label: 'Women' },
            ]}
            activeTab={gender}
            onChange={(id) => {
              setGender(id as 'male' | 'female')
              const newTees = id === 'male' ? course?.tees?.male : course?.tees?.female
              if (newTees?.length) {
                setSelectedTee(newTees[0])
              }
            }}
          />
        </div>
      )}

      {/* Tee Selection */}
      <div>
        <p className="text-sm text-text-2 mb-2">Select tee:</p>
        <Card className="overflow-hidden p-0">
          {tees?.map((tee, index) => {
            const isSelected = selectedTee?.tee_name === tee.tee_name
            return (
              <button
                key={tee.tee_name}
                onClick={() => setSelectedTee(tee)}
                className={cn(
                  'flex w-full items-center gap-4 px-4 py-3',
                  'transition-colors duration-tap',
                  isSelected ? 'bg-accent/10' : 'hover:bg-bg-2',
                  index !== (tees?.length || 0) - 1 && 'border-b border-stroke/60'
                )}
              >
                {/* Radio Circle */}
                <div
                  className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                    'transition-colors duration-tap',
                    isSelected ? 'border-accent' : 'border-stroke'
                  )}
                >
                  {isSelected && (
                    <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                  )}
                </div>

                {/* Tee Name */}
                <span
                  className={cn(
                    'flex-1 text-left text-body font-medium',
                    isSelected ? 'text-accent' : 'text-text-0'
                  )}
                >
                  {tee.tee_name}
                </span>

                {/* Rating / Slope */}
                <span className="font-display text-sm tabular-nums text-text-1">
                  {tee.course_rating.toFixed(1)} / {tee.slope_rating}
                </span>

                {/* Yards */}
                <span className="text-sm text-text-2 w-16 text-right">
                  {tee.total_yards.toLocaleString()} yd
                </span>
              </button>
            )
          })}
        </Card>
      </div>

      {/* Continue Button */}
      <Button
        variant="primary"
        size="large"
        onClick={handleContinue}
        disabled={!selectedTee}
        className="mt-2"
      >
        Continue →
      </Button>
    </div>
  )
}
