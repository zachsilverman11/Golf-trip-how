'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createTripAction } from '@/lib/supabase/trip-actions'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function NewTripPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createTripAction({
      name,
      description: description || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    })

    if (result.success && result.tripId) {
      router.push(`/trip/${result.tripId}`)
    } else {
      setError(result.error || 'Failed to create trip')
      setLoading(false)
    }
  }

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/trips"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trips
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">
          Create New Trip
        </h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          {/* Trip Name */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-1">
              Trip Name <span className="text-bad">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Myrtle Beach 2024"
              required
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about your trip..."
              rows={3}
              className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          {/* Date Range */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-text-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-bad">{error}</p>
          )}

          <div className="flex gap-3">
            <Link href="/trips" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              loading={loading}
              disabled={!name.trim()}
              className="flex-1"
            >
              Create Trip
            </Button>
          </div>
        </form>
      </Card>
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
