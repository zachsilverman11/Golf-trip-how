'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function FeedPage() {
  const params = useParams()
  const tripId = params.tripId as string

  return (
    <LayoutContainer className="py-6">
      <div className="mb-6">
        <Link
          href={`/trip/${tripId}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trip
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-0">
          Activity Feed
        </h1>
      </div>

      <Card className="p-8 text-center">
        <div className="mb-4 text-4xl opacity-50">
          <span role="img" aria-label="feed">📰</span>
        </div>
        <h2 className="mb-2 font-display text-xl font-bold text-text-0">
          Coming Soon
        </h2>
        <p className="mb-4 text-text-2">
          Live activity feed with score updates, notable shots, and trip highlights will be available in a future update.
        </p>
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
