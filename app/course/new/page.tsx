'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutContainer, Button } from '@/components/ui'
import { BackButton } from '@/components/ui/BackButton'
import {
  CourseSearch,
  TeeSelector,
  ReviewScorecard,
  ManualEntry,
  SavedCourseData,
} from '@/components/course'
import { ApiSearchResult, ApiCourse, ApiTee } from '@/lib/api/types'
import { saveCourseAction } from '@/lib/supabase/actions'

type Step = 'search' | 'tee' | 'review' | 'manual' | 'saving' | 'done' | 'error'

interface SaveResult {
  courseId?: string
  teeId?: string
  error?: string
}

export default function NewCoursePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('search')
  const [selectedSearch, setSelectedSearch] = useState<ApiSearchResult | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<ApiCourse | null>(null)
  const [selectedTee, setSelectedTee] = useState<ApiTee | null>(null)
  const [savedData, setSavedData] = useState<SavedCourseData | null>(null)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)

  const handleSearchSelect = (course: ApiSearchResult) => {
    setSelectedSearch(course)
    setStep('tee')
  }

  const handleTeeSelect = (course: ApiCourse, tee: ApiTee) => {
    setSelectedCourse(course)
    setSelectedTee(tee)
    setStep('review')
  }

  const handleSave = async (data: SavedCourseData) => {
    setSavedData(data)
    setStep('saving')

    try {
      const result = await saveCourseAction({
        courseName: data.courseName,
        location: data.location,
        country: data.country,
        externalProvider: data.externalId ? 'golfcourseapi' : undefined,
        externalId: data.externalId || undefined,
        teeName: data.teeName,
        rating: data.rating,
        slope: data.slope,
        par: data.par,
        yards: data.yards,
        holes: data.holes,
      })

      if (result.success) {
        setSaveResult({ courseId: result.courseId, teeId: result.teeId })
        setStep('done')
      } else {
        setSaveResult({ error: result.error })
        setStep('error')
      }
    } catch (err) {
      setSaveResult({
        error: err instanceof Error ? err.message : 'Failed to save course',
      })
      setStep('error')
    }
  }

  const handleReset = () => {
    setStep('search')
    setSelectedSearch(null)
    setSelectedCourse(null)
    setSelectedTee(null)
    setSavedData(null)
    setSaveResult(null)
  }

  return (
    <div className="py-8">
      <LayoutContainer>
        {/* Search Step */}
        {step === 'search' && (
          <div>
            <div className="mb-4">
              <BackButton href="/courses" label="Back to courses" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-0 mb-6">
              Add Course
            </h1>
            <CourseSearch
              onSelect={handleSearchSelect}
              onManualEntry={() => setStep('manual')}
            />
          </div>
        )}

        {/* Tee Selection Step */}
        {step === 'tee' && selectedSearch && (
          <TeeSelector
            courseId={selectedSearch.id}
            courseName={selectedSearch.course_name || selectedSearch.club_name || 'Course'}
            onSelect={handleTeeSelect}
            onBack={() => setStep('search')}
          />
        )}

        {/* Review Scorecard Step */}
        {step === 'review' && selectedCourse && selectedTee && (
          <ReviewScorecard
            course={selectedCourse}
            tee={selectedTee}
            onSave={handleSave}
            onBack={() => setStep('tee')}
          />
        )}

        {/* Manual Entry Step */}
        {step === 'manual' && (
          <ManualEntry
            onSave={handleSave}
            onBack={() => setStep('search')}
          />
        )}

        {/* Saving Step */}
        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="h-12 w-12 animate-spin text-accent mb-4"
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
            <p className="text-body text-text-1">Saving course...</p>
          </div>
        )}

        {/* Success Step */}
        {step === 'done' && savedData && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-good/20 flex items-center justify-center mb-4">
              <svg
                className="h-8 w-8 text-good"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-text-0 mb-2">
              Course Saved!
            </h2>
            <p className="text-body text-text-1 mb-1">
              {savedData.courseName}
            </p>
            <p className="text-sm text-text-2 mb-6">
              {savedData.teeName} Tees — {savedData.rating} / {savedData.slope}
            </p>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleReset}>
                Add Another
              </Button>
              <Button variant="primary" onClick={() => router.push('/courses')}>
                View All Courses
              </Button>
            </div>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-bad/20 flex items-center justify-center mb-4">
              <svg
                className="h-8 w-8 text-bad"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-text-0 mb-2">
              Save Failed
            </h2>
            <p className="text-body text-bad mb-6">
              {saveResult?.error || 'Unknown error'}
            </p>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('review')}>
                Try Again
              </Button>
              <Button variant="primary" onClick={handleReset}>
                Start Over
              </Button>
            </div>
          </div>
        )}
      </LayoutContainer>
    </div>
  )
}
