'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTripMediaAction } from '@/lib/supabase/media-actions'
import { Card } from '@/components/ui/Card'
import type { DbTripMedia } from '@/lib/supabase/types'

interface MediaItem extends DbTripMedia {
  publicUrl: string
}

interface MediaPreviewProps {
  tripId: string
}

export function MediaPreview({ tripId }: MediaPreviewProps) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadMedia() {
      try {
        const result = await getTripMediaAction(tripId)
        if (mounted && result.media.length > 0) {
          setMedia(result.media.slice(0, 6))
        }
      } catch {
        // Silently fail — preview is non-critical
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadMedia()
    return () => {
      mounted = false
    }
  }, [tripId])

  // Don't render anything if loading or no media
  if (loading || media.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-text-0">
          Recent Photos
        </h2>
        <Link
          href={`/trip/${tripId}/media`}
          className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
        >
          View all →
        </Link>
      </div>

      <Card className="overflow-hidden p-2">
        <div className="grid grid-cols-3 gap-1">
          {media.map((item) => (
            <Link
              key={item.id}
              href={`/trip/${tripId}/media`}
              className="relative aspect-square overflow-hidden rounded-card-sm bg-bg-2"
            >
              {item.media_type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.publicUrl}
                  alt={item.caption || 'Trip photo'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="relative h-full w-full bg-bg-2">
                  <video
                    src={item.publicUrl}
                    className="h-full w-full object-cover"
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50">
                      <PlayIcon />
                    </div>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      </Card>
    </section>
  )
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
