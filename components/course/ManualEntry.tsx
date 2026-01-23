'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, Button, Tabs } from '@/components/ui'
import { HoleInfo } from '@/lib/api/types'
import { PasteHelper } from './PasteHelper'
import type { SavedCourseData } from './ReviewScorecard'

interface ManualEntryProps {
  onSave: (data: SavedCourseData) => void
  onBack: () => void
  className?: string
}

const DEFAULT_HOLES: HoleInfo[] = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1,
  par: 4,
  strokeIndex: 0,
}))

export function ManualEntry({ onSave, onBack, className }: ManualEntryProps) {
  const [courseName, setCourseName] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState<'US' | 'CA'>('US')
  const [teeName, setTeeName] = useState('')
  const [rating, setRating] = useState('')
  const [slope, setSlope] = useState('')
  const [holes, setHoles] = useState<HoleInfo[]>(DEFAULT_HOLES)
  const [showPasteHelper, setShowPasteHelper] = useState(false)
  const [step, setStep] = useState<'info' | 'scorecard'>('info')

  const totalPar = holes.reduce((sum, h) => sum + h.par, 0)

  const handlePasteApply = (pars: number[], strokeIndexes: number[]) => {
    setHoles((prev) =>
      prev.map((h, i) => ({
        ...h,
        par: pars[i] > 0 ? pars[i] : h.par,
        strokeIndex: strokeIndexes[i] > 0 ? strokeIndexes[i] : h.strokeIndex,
      }))
    )
    setShowPasteHelper(false)
  }

  const updateHole = (holeNumber: number, field: 'par' | 'strokeIndex', value: number) => {
    setHoles((prev) =>
      prev.map((h) =>
        h.number === holeNumber ? { ...h, [field]: value } : h
      )
    )
  }

  const handleSave = () => {
    onSave({
      courseName,
      location,
      country,
      externalId: '', // No external ID for manual entry
      teeName,
      rating: parseFloat(rating),
      slope: parseInt(slope),
      par: totalPar,
      holes,
    })
  }

  // Validation
  const isInfoValid = courseName.trim().length > 0 && rating && slope
  const ratingNum = parseFloat(rating)
  const slopeNum = parseInt(slope)
  const isScorecardValid =
    ratingNum > 0 &&
    slopeNum >= 55 &&
    slopeNum <= 155 &&
    holes.every((h) => h.par >= 3 && h.par <= 5)

  if (step === 'info') {
    return (
      <div className={cn('flex flex-col gap-6', className)}>
        <div>
          <button
            onClick={onBack}
            className="text-sm text-text-2 hover:text-accent transition-colors duration-tap mb-2"
          >
            ← Back to search
          </button>
          <h2 className="font-display text-xl font-semibold text-text-0">
            Add Course Manually
          </h2>
        </div>

        <Card className="p-4 flex flex-col gap-4">
          {/* Course Name */}
          <div>
            <label className="text-sm text-text-1 mb-1 block">
              Course Name *
            </label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Pebble Beach Golf Links"
              className={cn(
                'w-full bg-bg-2 border border-stroke rounded-button px-3 py-2',
                'text-body text-text-0 placeholder:text-text-2',
                'focus:outline-none focus:border-accent'
              )}
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-sm text-text-1 mb-1 block">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Pebble Beach, CA"
              className={cn(
                'w-full bg-bg-2 border border-stroke rounded-button px-3 py-2',
                'text-body text-text-0 placeholder:text-text-2',
                'focus:outline-none focus:border-accent'
              )}
            />
          </div>

          {/* Country */}
          <div>
            <label className="text-sm text-text-1 mb-2 block">
              Country
            </label>
            <Tabs
              tabs={[
                { id: 'US', label: 'United States' },
                { id: 'CA', label: 'Canada' },
              ]}
              activeTab={country}
              onChange={(id) => setCountry(id as 'US' | 'CA')}
            />
          </div>

          {/* Tee Name */}
          <div>
            <label className="text-sm text-text-1 mb-1 block">
              Tee Name
            </label>
            <input
              type="text"
              value={teeName}
              onChange={(e) => setTeeName(e.target.value)}
              placeholder="Blue"
              className={cn(
                'w-full bg-bg-2 border border-stroke rounded-button px-3 py-2',
                'text-body text-text-0 placeholder:text-text-2',
                'focus:outline-none focus:border-accent'
              )}
            />
          </div>

          {/* Rating & Slope */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-1 mb-1 block">
                Course Rating *
              </label>
              <input
                type="number"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="72.4"
                className={cn(
                  'w-full bg-bg-2 border border-stroke rounded-button px-3 py-2',
                  'text-body text-text-0 placeholder:text-text-2',
                  'focus:outline-none focus:border-accent'
                )}
              />
            </div>
            <div>
              <label className="text-sm text-text-1 mb-1 block">
                Slope Rating *
              </label>
              <input
                type="number"
                value={slope}
                onChange={(e) => setSlope(e.target.value)}
                placeholder="144"
                className={cn(
                  'w-full bg-bg-2 border border-stroke rounded-button px-3 py-2',
                  'text-body text-text-0 placeholder:text-text-2',
                  'focus:outline-none focus:border-accent'
                )}
              />
            </div>
          </div>
        </Card>

        <Button
          variant="primary"
          size="large"
          onClick={() => setStep('scorecard')}
          disabled={!isInfoValid}
        >
          Continue to Scorecard →
        </Button>
      </div>
    )
  }

  // Step 2: Scorecard
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div>
        <button
          onClick={() => setStep('info')}
          className="text-sm text-text-2 hover:text-accent transition-colors duration-tap mb-2"
        >
          ← Back to course info
        </button>
        <h2 className="font-display text-xl font-semibold text-text-0">
          Enter Scorecard
        </h2>
        <p className="text-body text-text-1">
          {courseName} — {teeName || 'Custom'} Tees
        </p>
      </div>

      {/* Quick tip */}
      <div className="rounded-card-sm bg-accent/10 px-4 py-3 text-sm text-accent">
        Tip: Use &quot;Paste Scorecard&quot; to quickly enter all 18 pars and stroke indexes at once.
      </div>

      {/* Hole Grid */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-bg-2 border-b border-stroke/60">
          <span className="text-xs text-text-2 uppercase">Hole</span>
          <span className="text-xs text-text-2 uppercase text-center">Par</span>
          <span className="text-xs text-text-2 uppercase text-center">SI</span>
        </div>

        {holes.map((hole) => (
          <div
            key={hole.number}
            className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 border-b border-stroke/60"
          >
            <span className="text-sm font-medium text-text-0">{hole.number}</span>
            <select
              value={hole.par}
              onChange={(e) => updateHole(hole.number, 'par', parseInt(e.target.value))}
              className="bg-bg-2 border border-stroke rounded px-2 py-1 text-sm text-text-0 text-center"
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
              onChange={(e) => updateHole(hole.number, 'strokeIndex', parseInt(e.target.value) || 0)}
              className="bg-bg-2 border border-stroke rounded px-2 py-1 text-sm text-text-0 text-center w-full"
              placeholder="—"
            />
          </div>
        ))}

        <div className="grid grid-cols-[40px_1fr_1fr] gap-1 px-3 py-2 bg-accent/10">
          <span className="text-sm font-bold text-accent">TOT</span>
          <span className="text-sm font-bold text-accent text-center">{totalPar}</span>
          <span className="text-xs text-text-2 text-center">—</span>
        </div>
      </Card>

      {/* Paste Helper Button */}
      <Button variant="secondary" onClick={() => setShowPasteHelper(true)}>
        Paste Scorecard
      </Button>

      {/* Save Button */}
      <Button
        variant="primary"
        size="large"
        onClick={handleSave}
        disabled={!isScorecardValid}
      >
        Save Course
      </Button>

      {/* Paste Helper Modal */}
      {showPasteHelper && (
        <PasteHelper onApply={handlePasteApply} onClose={() => setShowPasteHelper(false)} />
      )}
    </div>
  )
}
