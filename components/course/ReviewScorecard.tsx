'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, Button, Divider } from '@/components/ui'
import { HoleInfo, ApiCourse, ApiTee, apiTeeToTee, formatLocation, getCountryFromLocation } from '@/lib/api/types'
import { PasteHelper } from './PasteHelper'

interface ReviewScorecardProps {
  course: ApiCourse
  tee: ApiTee
  onSave: (data: SavedCourseData) => void
  onBack: () => void
  className?: string
}

export interface SavedCourseData {
  courseName: string
  location: string
  country: 'US' | 'CA' | 'other'
  externalId: string
  teeName: string
  rating: number
  slope: number
  par: number
  yards?: number
  holes: HoleInfo[]
}

export function ReviewScorecard({
  course,
  tee,
  onSave,
  onBack,
  className,
}: ReviewScorecardProps) {
  // Editable state
  const [rating, setRating] = useState(tee.course_rating)
  const [slope, setSlope] = useState(tee.slope_rating)
  const [holes, setHoles] = useState<HoleInfo[]>(
    tee.holes.map((h, i) => ({
      number: i + 1,
      par: h.par,
      strokeIndex: h.handicap ?? 0,
      yards: h.yardage,
    }))
  )
  const [showPasteHelper, setShowPasteHelper] = useState(false)
  const [editingHole, setEditingHole] = useState<number | null>(null)

  const totalPar = holes.reduce((sum, h) => sum + h.par, 0)
  const frontNine = holes.slice(0, 9)
  const backNine = holes.slice(9, 18)
  const frontPar = frontNine.reduce((sum, h) => sum + h.par, 0)
  const backPar = backNine.reduce((sum, h) => sum + h.par, 0)

  // Check if stroke indexes are missing (all zeros)
  const missingStrokeIndexes = holes.every((h) => h.strokeIndex === 0)

  const updateHole = useCallback((holeNumber: number, field: 'par' | 'strokeIndex', value: number) => {
    setHoles((prev) =>
      prev.map((h) =>
        h.number === holeNumber ? { ...h, [field]: value } : h
      )
    )
  }, [])

  const handlePasteApply = useCallback(
    (pars: number[], strokeIndexes: number[]) => {
      setHoles((prev) =>
        prev.map((h, i) => ({
          ...h,
          par: pars[i] ?? h.par,
          strokeIndex: strokeIndexes[i] ?? h.strokeIndex,
        }))
      )
      setShowPasteHelper(false)
    },
    []
  )

  const handleSave = () => {
    onSave({
      courseName: course.club_name,
      location: formatLocation(course.location),
      country: getCountryFromLocation(course.location),
      externalId: String(course.id),
      teeName: tee.tee_name,
      rating,
      slope,
      par: totalPar,
      yards: tee.total_yards,
      holes,
    })
  }

  // Validate data
  const isValid =
    rating > 0 &&
    slope >= 55 &&
    slope <= 155 &&
    holes.every((h) => h.par >= 3 && h.par <= 5)

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="text-sm text-text-2 hover:text-accent transition-colors duration-tap mb-2"
        >
          ← Back to tee selection
        </button>
        <h2 className="font-display text-xl font-semibold text-text-0">
          Review Scorecard
        </h2>
        <p className="text-body text-text-1">
          {course.club_name} — {tee.tee_name} Tees
        </p>
      </div>

      {/* Course Rating & Slope */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-text-2 uppercase tracking-wide">
              Rating
            </label>
            <input
              type="number"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
              className={cn(
                'w-full mt-1 bg-bg-2 border border-stroke rounded-button px-3 py-2',
                'font-display text-lg font-bold tabular-nums text-text-0',
                'focus:outline-none focus:border-accent'
              )}
            />
          </div>
          <div>
            <label className="text-xs text-text-2 uppercase tracking-wide">
              Slope
            </label>
            <input
              type="number"
              value={slope}
              onChange={(e) => setSlope(parseInt(e.target.value) || 0)}
              className={cn(
                'w-full mt-1 bg-bg-2 border border-stroke rounded-button px-3 py-2',
                'font-display text-lg font-bold tabular-nums text-text-0',
                'focus:outline-none focus:border-accent'
              )}
            />
          </div>
          <div>
            <label className="text-xs text-text-2 uppercase tracking-wide">
              Par
            </label>
            <div className="mt-1 px-3 py-2 font-display text-lg font-bold tabular-nums text-text-0">
              {totalPar}
            </div>
          </div>
        </div>
      </Card>

      {/* Missing Stroke Index Warning */}
      {missingStrokeIndexes && (
        <div className="rounded-card-sm bg-gold/10 px-4 py-3 text-sm text-gold">
          Stroke indexes not available from API. Use &quot;Paste Scorecard&quot; to add them for net scoring.
        </div>
      )}

      {/* Hole Grid */}
      <Card className="p-0 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-bg-2 border-b border-stroke/60">
          <span className="text-xs text-text-2 uppercase">Hole</span>
          <span className="text-xs text-text-2 uppercase text-center">Par</span>
          <span className="text-xs text-text-2 uppercase text-center">SI</span>
        </div>

        {/* Front 9 */}
        {frontNine.map((hole) => (
          <HoleRow
            key={hole.number}
            hole={hole}
            isEditing={editingHole === hole.number}
            onEdit={() => setEditingHole(hole.number)}
            onUpdate={(field, value) => updateHole(hole.number, field, value)}
            onDone={() => setEditingHole(null)}
          />
        ))}

        {/* Front 9 Total */}
        <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-bg-2 border-y border-stroke/60">
          <span className="text-xs font-semibold text-text-1">OUT</span>
          <span className="text-xs font-semibold text-text-1 text-center">{frontPar}</span>
          <span className="text-xs text-text-2 text-center">—</span>
        </div>

        {/* Back 9 */}
        {backNine.map((hole) => (
          <HoleRow
            key={hole.number}
            hole={hole}
            isEditing={editingHole === hole.number}
            onEdit={() => setEditingHole(hole.number)}
            onUpdate={(field, value) => updateHole(hole.number, field, value)}
            onDone={() => setEditingHole(null)}
          />
        ))}

        {/* Back 9 Total */}
        <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-bg-2 border-t border-stroke/60">
          <span className="text-xs font-semibold text-text-1">IN</span>
          <span className="text-xs font-semibold text-text-1 text-center">{backPar}</span>
          <span className="text-xs text-text-2 text-center">—</span>
        </div>

        {/* Total */}
        <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-accent/10">
          <span className="text-sm font-bold text-accent">TOT</span>
          <span className="text-sm font-bold text-accent text-center">{totalPar}</span>
          <span className="text-xs text-text-2 text-center">—</span>
        </div>
      </Card>

      {/* Paste Helper Button */}
      <Button
        variant="secondary"
        onClick={() => setShowPasteHelper(true)}
      >
        Paste Scorecard
      </Button>

      {/* Save Button */}
      <Button
        variant="primary"
        size="large"
        onClick={handleSave}
        disabled={!isValid}
      >
        Save Course
      </Button>

      {/* Paste Helper Modal */}
      {showPasteHelper && (
        <PasteHelper
          onApply={handlePasteApply}
          onClose={() => setShowPasteHelper(false)}
        />
      )}
    </div>
  )
}

// ============================================================================
// Hole Row Component
// ============================================================================

interface HoleRowProps {
  hole: HoleInfo
  isEditing: boolean
  onEdit: () => void
  onUpdate: (field: 'par' | 'strokeIndex', value: number) => void
  onDone: () => void
}

function HoleRow({ hole, isEditing, onEdit, onUpdate, onDone }: HoleRowProps) {
  if (isEditing) {
    return (
      <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-accent/5 border-b border-stroke/60">
        <span className="text-sm font-medium text-text-0">{hole.number}</span>
        <select
          value={hole.par}
          onChange={(e) => onUpdate('par', parseInt(e.target.value))}
          className="bg-bg-2 border border-accent rounded px-2 py-1 text-sm text-text-0 text-center"
        >
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
        </select>
        <input
          type="number"
          min={1}
          max={18}
          value={hole.strokeIndex || ''}
          onChange={(e) => onUpdate('strokeIndex', parseInt(e.target.value) || 0)}
          onBlur={onDone}
          onKeyDown={(e) => e.key === 'Enter' && onDone()}
          autoFocus
          className="bg-bg-2 border border-accent rounded px-2 py-1 text-sm text-text-0 text-center w-full"
          placeholder="1-18"
        />
      </div>
    )
  }

  return (
    <button
      onClick={onEdit}
      className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 border-b border-stroke/60 w-full text-left hover:bg-bg-2 transition-colors duration-tap"
    >
      <span className="text-sm font-medium text-text-0">{hole.number}</span>
      <span className="text-sm text-text-0 text-center">{hole.par}</span>
      <span
        className={cn(
          'text-sm text-center',
          hole.strokeIndex > 0 ? 'text-text-0' : 'text-text-2'
        )}
      >
        {hole.strokeIndex > 0 ? hole.strokeIndex : '—'}
      </span>
    </button>
  )
}
