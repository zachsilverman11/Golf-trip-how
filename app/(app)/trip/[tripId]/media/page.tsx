'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Tabs } from '@/components/ui/Tabs'
import { MediaGallery } from '@/components/trip/MediaGallery'
import { MediaFeed } from '@/components/trip/MediaFeed'
import { MediaUploadButton } from '@/components/trip/MediaUploadButton'
import { getTripMediaAction } from '@/lib/supabase/media-actions'
import { getCurrentUser } from '@/lib/supabase/auth-actions'
import type { DbTripMedia } from '@/lib/supabase/types'

type ViewMode = 'grid' | 'feed'

interface MediaItem extends DbTripMedia {
  publicUrl: string
}

export default function MediaPage() {
  const params = useParams()
  const tripId = params.tripId as string

  const [media, setMedia] = useState<MediaItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [loading, setLoading] = useState(true)

  const loadMedia = useCallback(async () => {
    const [mediaResult, user] = await Promise.all([
      getTripMediaAction(tripId),
      getCurrentUser(),
    ])

    setMedia(mediaResult.media)
    setCurrentUserId(user?.id)
    setLoading(false)
  }, [tripId])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  const viewTabs = [
    { id: 'grid', label: 'Grid' },
    { id: 'feed', label: 'Feed' },
  ]

  return (
    <LayoutContainer className="py-6">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/trip/${tripId}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors"
        >
          <BackIcon />
          Back to trip
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-bold text-text-0">
            Photos & Videos
          </h1>
          {media.length > 0 && (
            <span className="text-sm text-text-2">
              {media.length} item{media.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* View toggle */}
      {media.length > 0 && (
        <div className="mb-4">
          <Tabs
            tabs={viewTabs}
            activeTab={viewMode}
            onChange={(tab) => setViewMode(tab as ViewMode)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center text-text-2">Loading media...</div>
      )}

      {/* Content */}
      {!loading && viewMode === 'grid' && (
        <MediaGallery
          media={media}
          currentUserId={currentUserId}
          onMediaDeleted={loadMedia}
        />
      )}

      {!loading && viewMode === 'feed' && (
        <MediaFeed
          media={media}
          currentUserId={currentUserId}
          onMediaDeleted={loadMedia}
        />
      )}

      {/* Empty state for feed */}
      {!loading && viewMode === 'feed' && media.length === 0 && (
        <div className="rounded-card border border-stroke bg-bg-1 p-8 text-center">
          <div className="mb-3 text-3xl opacity-40">📸</div>
          <h3 className="mb-1 font-display text-lg font-bold text-text-0">
            No photos yet
          </h3>
          <p className="text-sm text-text-2">
            Tap the camera button to share moments from the trip
          </p>
        </div>
      )}

      {/* FAB */}
      <MediaUploadButton tripId={tripId} onUploadComplete={loadMedia} />
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
