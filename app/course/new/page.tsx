'use client'

import { useState } from 'react'
import { LayoutContainer } from '@/components/ui'
import {
  CourseSearch,
  TeeSelector,
  ReviewScorecard,
  ManualEntry,
  SavedCourseData,
} from '@/components/course'
import { ApiSearchResult, ApiCourse, ApiTee } from '@/lib/api/types'

type Step = 'search' | 'tee' | 'review' | 'manual' | 'done'

export default function NewCoursePage() {
  const [step, setStep] = useState<Step>('search')
  const [selectedSearch, setSelectedSearch] = useState<ApiSearchResult | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<ApiCourse | null>(null)
  const [selectedTee, setSelectedTee] = useState<ApiTee | null>(null)
  const [savedData, setSavedData] = useState<SavedCourseData | null>(null)

  const handleSearchSelect = (course: ApiSearchResult) => {
    setSelectedSearch(course)
    setStep('tee')
  }

  const handleTeeSelect = (course: ApiCourse, tee: ApiTee) => {
    setSelectedCourse(course)
    setSelectedTee(tee)
    setStep('review')
  }

  const handleSave = (data: SavedCourseData) => {
    setSavedData(data)
    setStep('done')
    // TODO: Save to Supabase
    console.log('Course data to save:', data)
  }

  const handleReset = () => {
    setStep('search')
    setSelectedSearch(null)
    setSelectedCourse(null)
    setSelectedTee(null)
    setSavedData(null)
  }

  return (
    <div className="min-h-screen bg-bg-0 py-8">
      <LayoutContainer>
        {/* Search Step */}
        {step === 'search' && (
          <div>
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
            courseName={selectedSearch.club_name || selectedSearch.course_name || 'Course'}
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

            <div className="bg-bg-1 rounded-card p-4 w-full max-w-sm text-left mb-6">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-2">
                Saved Data (Debug)
              </p>
              <pre className="text-xs text-text-1 overflow-auto">
                {JSON.stringify(savedData, null, 2)}
              </pre>
            </div>

            <button
              onClick={handleReset}
              className="text-accent hover:underline"
            >
              Add another course →
            </button>
          </div>
        )}
      </LayoutContainer>
    </div>
  )
}
