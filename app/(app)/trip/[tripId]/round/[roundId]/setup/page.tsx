'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getRoundAction, updateRoundAction } from '@/lib/supabase/round-actions'
import { getCoursesAction } from '@/lib/supabase/actions'
import type { DbCourseWithTees } from '@/lib/supabase/types'

export default function RoundSetupPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const roundId = params.roundId as string

  const [courses, setCourses] = useState<DbCourseWithTees[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [selectedTeeId, setSelectedTeeId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roundName, setRoundName] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const [roundResult, coursesResult] = await Promise.all([
        getRoundAction(roundId),
        getCoursesAction(),
      ])

      if (roundResult.round) {
        setRoundName(roundResult.round.name)
        if (roundResult.round.tee_id) {
          setSelectedTeeId(roundResult.round.tee_id)
          // Find the course that contains this tee
          const tee = roundResult.round.tees
          if (tee && (tee as any).courses) {
            setSelectedCourseId((tee as any).courses.id)
          }
        }
      }

      if (coursesResult.courses) {
        setCourses(coursesResult.courses)
      }

      setLoading(false)
    }

    loadData()
  }, [roundId])

  const selectedCourse = courses.find((c) => c.id === selectedCourseId)
  const availableTees = selectedCourse?.tees || []

  const handleSave = async () => {
    if (!selectedTeeId) {
      setError('Please select a tee')
      return
    }

    setSaving(true)
    setError(null)

    const result = await updateRoundAction(roundId, tripId, {
      tee_id: selectedTeeId,
    })

    if (result.success) {
      router.push(`/trip/${tripId}/round/${roundId}`)
    } else {
      setError(result.error || 'Failed to update round')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <LayoutContainer className="py-6">
        <div className="text-center text-text-2">Loading...</div>
      </LayoutContainer>
    )
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/trip/${tripId}/round/${roundId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to round
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">
          Round Setup
        </h1>
        {roundName && (
          <p className="mt-1 text-text-2">{roundName}</p>
        )}
      </div>

      <Card className="p-4 mb-4">
        <h2 className="mb-4 font-display text-lg font-bold text-text-0">
          Course & Tees
        </h2>

        {courses.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-text-2 mb-3">No courses added yet</p>
            <Link href="/course/new">
              <Button type="button" variant="secondary">
                Add Course
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-1">
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value)
                  setSelectedTeeId('')
                }}
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCourseId && availableTees.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Select Tees
                </label>
                <select
                  value={selectedTeeId}
                  onChange={(e) => setSelectedTeeId(e.target.value)}
                  className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select tees...</option>
                  {availableTees.map((tee) => (
                    <option key={tee.id} value={tee.id}>
                      {tee.name} ({tee.rating}/{tee.slope}, {tee.yards} yds)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedCourseId && availableTees.length === 0 && (
              <p className="text-sm text-text-2">
                No tees available for this course. Add tees to the course first.
              </p>
            )}
          </div>
        )}
      </Card>

      {error && (
        <div className="mb-4 rounded-card bg-bad/10 p-4 text-bad">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Link href={`/trip/${tripId}/round/${roundId}`} className="flex-1">
          <Button type="button" variant="secondary" className="w-full">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!selectedTeeId || saving}
          className="flex-1"
        >
          Save Setup
        </Button>
      </div>
    </LayoutContainer>
  )
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
